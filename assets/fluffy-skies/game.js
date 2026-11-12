import { Flight, RULES, laneX, readProgress, recordFlight, SCORE_MILESTONES, FLIGHT_MILESTONES } from './core.mjs';

const $ = (id) => document.getElementById(id);
const asset = (path) => new URL(path, import.meta.url).href;
const canvas = $('game');
const ctx = canvas.getContext('2d');
const stage = $('game-stage');
const dialog = $('details-dialog');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let storage;
try { storage = window.localStorage; } catch { /* Private storage can be unavailable. */ }
let progress = readProgress(storage);
let storageWorks = Boolean(storage);
let mode = 'loading';
let paused = false;
let flight = new Flight();
let sceneTime = 0;
let worldTime = 0;
let overTime = 0;
let tally = 0;
let newBest = false;
let lastTime = 0;
let accumulator = 0;
let pointer = null;
let particles = [];
let pieces = [];
let particleClock = 0;
let images = {};
let particleTextures = [];

function announce(message) { $('status').textContent = message; }
function save() {
  try {
    storage.setItem('fluffy-skies-v1', JSON.stringify(progress));
  } catch {
    storageWorks = false;
  }
}

// The music file is the original recording. Sound effects use decoded buffers
// so repeated scoring sounds don't create a new media element on every frame.
class Soundtrack {
  constructor() {
    this.music = new Audio(asset('audio/Fluffy.mp3'));
    this.music.loop = true;
    this.music.preload = 'auto';
    this.music.volume = 0.65;
    this.context = null;
    this.buffers = {};
    this.unlocked = false;
    this.loading = null;
  }

  activate() {
    this.unlocked = true;
    if (!this.context) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.context = new AudioContext();
        this.loading = Promise.allSettled(['Wing', 'Point', 'Hit', 'Blop'].map(async (name) => {
          const response = await fetch(asset(`audio/${name}.mp3`));
          if (!response.ok) throw new Error(`Unable to load ${name}`);
          this.buffers[name] = await this.context.decodeAudioData(await response.arrayBuffer());
        }));
      }
    }
    if (this.context?.state === 'suspended' && !progress.muted) this.context.resume().catch(() => {});
    this.sync();
  }

  sync() {
    const silent = progress.muted || paused || document.hidden;
    this.music.muted = progress.muted;
    if (silent) {
      this.music.pause();
      this.context?.suspend().catch(() => {});
    } else if (this.unlocked) {
      this.music.play().catch(() => {
        // A later Play / Sound gesture can unlock audio if the browser denied it.
      });
      // Queue resume even when a preceding pause is still resolving. This also
      // handles a quick pause/resume gesture without leaving effects suspended.
      this.context?.resume().catch(() => {});
    }
  }

  effect(name) {
    if (progress.muted || paused || document.hidden || !this.buffers[name] || this.context?.state !== 'running') return;
    const source = this.context.createBufferSource();
    source.buffer = this.buffers[name];
    source.connect(this.context.destination);
    source.start();
  }

  restartMusic() {
    this.music.currentTime = 0;
    this.sync();
  }
}
const audio = new Soundtrack();

function syncSound() {
  const label = progress.muted ? 'Turn sound on' : 'Mute sound';
  for (const id of ['sound', 'menu-sound']) {
    $(id).setAttribute('aria-label', label);
    $(id).setAttribute('aria-pressed', String(progress.muted));
    $(id).title = label;
  }
  $('sound').textContent = progress.muted ? 'Sound off' : 'Sound on';
  $('sound-icon').src = asset(`images/icons/${progress.muted ? 'SoundOff' : 'SoundOn'}.png`);
}

function toggleSound() {
  progress.muted = !progress.muted;
  save();
  syncSound();
  audio.activate();
}

function syncUI() {
  $('menu-ui').hidden = mode !== 'menu';
  $('over-ui').hidden = mode !== 'over';
  $('pause-ui').hidden = !paused;
  const controllable = mode === 'flight' && flight.state === 'playing' && !paused;
  $('left').disabled = !controllable;
  $('right').disabled = !controllable;
  $('pause').disabled = mode !== 'flight' || !['ready', 'playing'].includes(flight.state);
  $('pause').textContent = paused ? 'Resume' : 'Pause';
  $('pause').setAttribute('aria-label', paused ? 'Resume game' : 'Pause game');
  $('sound').disabled = mode === 'loading';
  $('game-hint').hidden = !(mode === 'flight' && flight.age < 3 && flight.score === 0 && !paused && flight.state !== 'crashed');
  stage.dataset.state = paused ? 'paused' : mode === 'flight' ? flight.state : mode;
  stage.dataset.score = String(flight.score);
}

function goMenu() {
  mode = 'menu';
  paused = false;
  sceneTime = 0;
  pointer = null;
  particles = [];
  syncUI();
  audio.sync();
  announce(`Ready to fly. Best score: ${progress.best}.`);
  $('play').focus({ preventScroll: true });
}

function start() {
  audio.activate();
  audio.effect('Blop');
  audio.restartMusic();
  flight = new Flight();
  mode = 'flight';
  paused = false;
  newBest = false;
  sceneTime = 0;
  worldTime = 0;
  accumulator = 0;
  particles = [];
  pieces = [];
  particleClock = 0;
  pointer = null;
  syncUI();
  canvas.focus({ preventScroll: true });
  stage.scrollIntoView({ block: 'nearest', behavior: 'instant' });
  announce('Flight started. Find the gaps in the clouds.');
}

function setPaused(value) {
  if (mode !== 'flight' || !['ready', 'playing'].includes(flight.state)) return;
  paused = value;
  pointer = null;
  accumulator = 0;
  lastTime = performance.now();
  syncUI();
  audio.sync();
  if (paused) {
    $('resume').focus({ preventScroll: true });
    announce('Flight paused.');
  } else {
    canvas.focus({ preventScroll: true });
    announce('Flight resumed.');
  }
}

function move(direction) {
  if (mode !== 'flight' || paused) return;
  if (flight.move(direction)) audio.effect('Wing');
}

function onCrash() {
  audio.effect('Hit');
  newBest = flight.score > progress.best;
  progress = recordFlight(progress, flight.score);
  save();
  particles = [];
  pieces = ['burntCat', 'crashRocket'].map((image) => {
    const vx = (Math.random() * 4 - 2) * 60;
    return { image, x: flight.x, y: RULES.catY, vx, vy: -(1 + Math.floor(Math.random() * 3)) * 60, spin: vx / 15, angle: 0 };
  });
  pointer = null;
  syncUI();
}

function finish() {
  mode = 'over';
  overTime = 0;
  tally = 0;
  syncUI();
  const saving = storageWorks ? '' : ' Scores are kept for this visit; browser storage is unavailable.';
  announce(`Game over. ${flight.score} ${flight.score === 1 ? 'point' : 'points'}.${newBest ? ' A new best!' : ` Best: ${progress.best}.`}${saving}`);
  $('retry').focus({ preventScroll: true });
}

function spawnParticle() {
  const angle = (Math.random() * 24 - 12) * Math.PI / 180;
  const speed = 336 + (Math.random() * 268 - 134);
  particles.push({
    x: flight.x + Math.random() * 10 - 5,
    y: RULES.catY + 43 / 2 + Math.random() * 8 - 4,
    vx: Math.sin(angle) * speed,
    vy: Math.cos(angle) * speed,
    life: 0.39 + Math.random() * 0.4 - 0.2,
    age: 0,
    size: 26 + Math.random() * 20 - 10,
    texture: Math.floor(Math.random() * particleTextures.length),
  });
}

function simulate(dt) {
  worldTime += dt;
  const previousState = flight.state;
  flight.step(dt);
  for (const event of flight.events) {
    if (event === 'hit') onCrash();
    if (event === 'point') {
      audio.effect('Point');
      stage.dataset.score = String(flight.score);
    }
  }
  if (flight.state === 'playing') {
    particleClock += dt;
    const emissionRate = reducedMotion.matches ? 0.035 : 0.39 / 99;
    while (particleClock >= emissionRate) {
      particleClock -= emissionRate;
      if (particles.length < 99) spawnParticle();
    }
  }
  for (const p of particles) {
    p.age += dt;
    p.vy += 283 * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
  particles = particles.filter((p) => p.age < p.life);
  for (const piece of pieces) {
    piece.vy += 900 * dt;
    piece.x += piece.vx * dt;
    piece.y += piece.vy * dt;
    piece.angle += piece.spin * dt;
  }
  if (previousState !== flight.state) syncUI();
  if (flight.state === 'over') finish();
  if (flight.age >= 3) $('game-hint').hidden = true;
}

function picture(name, x, y, width, height, alpha = 1) {
  if (!images[name]) return;
  ctx.globalAlpha = alpha;
  ctx.drawImage(images[name], x, y, width, height);
  ctx.globalAlpha = 1;
}

function text(content, x, y, size, color = '#fff') {
  ctx.font = `${size}px Modak, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(String(content), x, y);
}

function sky(isMenu) {
  const { width: w, height: h } = RULES;
  picture(isMenu ? 'menuBackground' : 'background', 0, 0, w, h);
  if (!isMenu) {
    const y = (worldTime * h / 7) % h;
    picture('stars', 0, y, w, h);
    picture('stars', 0, y - h, w, h);
  }
  const x = reducedMotion.matches ? 0 : -((sceneTime * w / 10) % w);
  picture('starsEffect', x, 0, w, h);
  picture('starsEffect', x + w, 0, w, h);
}

function menuArt() {
  sky(true);
  picture('hills', 0, 0, RULES.width, RULES.height);
  const bob = reducedMotion.matches ? 0 : Math.sin(sceneTime * Math.PI) * 5;
  picture('title', 0, 2 + bob, 720, 428);
  text('BEST SCORE:', 360, 810, 32.4);
  text(progress.best, 360, 850.5, 40.5);
}

function render() {
  if (!ctx || mode === 'loading') return;
  ctx.setTransform(canvas.width / RULES.width, 0, 0, canvas.height / RULES.height, 0, 0);
  ctx.clearRect(0, 0, RULES.width, RULES.height);
  if (mode === 'splash') {
    picture('splash', 0, 0, 720, 1080);
    return;
  }
  if (mode === 'menu') {
    menuArt();
    return;
  }
  if (mode === 'over') {
    menuArt();
    text('Game Over', 360, 432, 54);
    text(tally, 360, 540, 108);
    text('Points', 360, 612, 32.4);
    if (newBest && tally === flight.score) {
      const age = overTime - flight.score * 0.025;
      const t = reducedMotion.matches ? 0 : Math.max(0, Math.min(1, (age - 0.25) / 3));
      const ease = t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2;
      picture('medal', 180 - 720 * ease - 64, 476, 128, 128);
    }
    return;
  }
  sky(false);
  for (const cloud of flight.clouds) {
    const center = laneX(cloud.lane);
    const y = cloud.y - RULES.cloudHeight / 2;
    picture('cloud', center - RULES.gap / 2 - RULES.cloudWidth, y, RULES.cloudWidth, RULES.cloudHeight);
    picture('cloud', center + RULES.gap / 2, y, RULES.cloudWidth, RULES.cloudHeight);
  }
  if (flight.state === 'playing') {
    picture('cat', flight.x - RULES.catWidth / 2, RULES.catY - RULES.catHeight / 2, RULES.catWidth, RULES.catHeight);
    picture('rocket', flight.x - 31 / 2, RULES.catY - 43 / 2, 31, 43);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of particles) {
      const size = p.size + (12 - p.size) * p.age / p.life;
      ctx.drawImage(particleTextures[p.texture], p.x - size / 2, p.y - size / 2, size, size);
    }
    ctx.restore();
  }
  for (const piece of pieces) {
    ctx.save();
    ctx.translate(piece.x, piece.y);
    ctx.rotate(piece.angle);
    picture(piece.image, -28.5, -50.5, 57, 101);
    ctx.restore();
  }
  text(flight.score, 360, 270, 108);
  // Match the original half-second entrance and 1.5-second crash transition.
  const fade = flight.state === 'ready' ? Math.max(0, 1 - flight.age / 0.5)
    : flight.state === 'crashed' ? Math.max(0, (flight.crashTime - 1) / 0.5) : 0;
  if (fade > 0) {
    ctx.fillStyle = `rgba(17, 12, 35, ${fade})`;
    ctx.fillRect(0, 0, 720, 1080);
  }
}

function frame(now) {
  const dt = Math.min(0.05, Math.max(0, (now - (lastTime || now)) / 1000));
  lastTime = now;
  if (!paused && !document.hidden) {
    sceneTime += dt;
    if (mode === 'splash' && sceneTime >= 2) goMenu();
    if (mode === 'flight') {
      accumulator += dt;
      while (accumulator >= RULES.step && mode === 'flight') {
        simulate(RULES.step);
        accumulator -= RULES.step;
      }
    } else if (mode === 'over') {
      overTime += dt;
      const next = Math.min(flight.score, Math.floor(overTime / 0.025));
      if (next !== tally) audio.effect('Blop');
      tally = next;
    }
  }
  render();
  requestAnimationFrame(frame);
}

function resize() {
  const box = canvas.getBoundingClientRect();
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(box.width * ratio);
  canvas.height = Math.round(box.height * ratio);
  render();
}

function openDetails(title) {
  audio.activate();
  audio.effect('Blop');
  $('dialog-title').textContent = title;
  $('dialog-content').replaceChildren();
  dialog.showModal();
}

function paragraph(content) {
  const p = document.createElement('p');
  p.textContent = content;
  $('dialog-content').append(p);
}

function milestoneList(title, milestones, value, unit) {
  const h = document.createElement('h3');
  h.textContent = title;
  const ul = document.createElement('ul');
  ul.className = 'milestones';
  for (const number of milestones) {
    const li = document.createElement('li');
    const earned = value >= number;
    li.className = earned ? 'earned' : '';
    li.textContent = `${earned ? '✓ ' : ''}${number.toLocaleString()} ${unit}`;
    li.setAttribute('aria-label', `${number} ${unit}: ${earned ? 'earned' : 'not yet earned'}`);
    ul.append(li);
  }
  $('dialog-content').append(h, ul);
}

async function share() {
  audio.activate();
  audio.effect('Blop');
  const url = new URL('../../fluffy-skies/', import.meta.url).href;
  const message = `I scored ${flight.score} in Fluffy Skies! Can you beat it?`;
  try {
    if (navigator.share) {
      await navigator.share({ title: 'Fluffy Skies', text: message, url });
      return;
    }
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(`${message}\n${url}`);
      announce('Score and game link copied.');
      return;
    }
  } catch (error) {
    if (error.name === 'AbortError') return;
  }
  openDetails('Share your flight');
  paragraph(message);
  const input = document.createElement('input');
  input.className = 'share-link';
  input.readOnly = true;
  input.value = `${message} ${url}`;
  input.setAttribute('aria-label', 'Copy this score and game link');
  $('dialog-content').append(input);
  input.focus();
  input.select();
}

$('play').addEventListener('click', start);
$('retry').addEventListener('click', start);
$('home').addEventListener('click', () => { audio.effect('Blop'); goMenu(); });
$('quit').addEventListener('click', goMenu);
$('pause').addEventListener('click', () => { audio.activate(); setPaused(!paused); });
$('resume').addEventListener('click', () => { audio.activate(); setPaused(false); });
$('sound').addEventListener('click', toggleSound);
$('menu-sound').addEventListener('click', toggleSound);
$('left').addEventListener('click', () => move(-1));
$('right').addEventListener('click', () => move(1));
$('share').addEventListener('click', share);
$('reload').addEventListener('click', () => location.reload());
$('close-dialog').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', (event) => {
  if (event.target === dialog) {
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  }
});
$('achievements').addEventListener('click', () => {
  openDetails('Achievements');
  paragraph('The original milestones, earned here in your browser.');
  milestoneList('Skies cleared in one flight', SCORE_MILESTONES, progress.best, 'skies');
  milestoneList('Flights completed', FLIGHT_MILESTONES, progress.flights, 'flights');
});
$('records').addEventListener('click', () => {
  openDetails('Your best flights');
  paragraph(`${progress.flights} ${progress.flights === 1 ? 'flight' : 'flights'} completed. These records belong to this browser.`);
  if (progress.scores.length === 0) paragraph('Your first flight is waiting.');
  else {
    const list = document.createElement('ol');
    list.className = 'flight-list';
    for (const score of progress.scores) {
      const li = document.createElement('li');
      li.textContent = `${score} ${score === 1 ? 'point' : 'points'}`;
      list.append(li);
    }
    $('dialog-content').append(list);
  }
});

for (const image of document.querySelectorAll('[data-pressed]')) {
  const button = image.closest('button');
  button.addEventListener('pointerdown', () => { image.src = asset(`images/icons/${image.dataset.pressed}.png`); });
  for (const event of ['pointerup', 'pointercancel', 'pointerleave', 'blur']) {
    button.addEventListener(event, () => { image.src = asset(`images/icons/${image.dataset.rest}.png`); });
  }
}

canvas.addEventListener('pointerdown', (event) => {
  if (mode === 'splash') { audio.activate(); goMenu(); return; }
  if (mode !== 'flight' || paused || flight.state !== 'playing' || !event.isPrimary) return;
  pointer = { id: event.pointerId, x: event.clientX, moved: false };
  canvas.setPointerCapture(event.pointerId);
  canvas.focus({ preventScroll: true });
});
function swipe(event) {
  if (!pointer || pointer.id !== event.pointerId || pointer.moved) return;
  const distance = event.clientX - pointer.x;
  // Same five-percent threshold as GameScene::update, scaled to the viewport.
  if (Math.abs(distance) > canvas.getBoundingClientRect().width * 0.05) {
    move(Math.sign(distance));
    pointer.moved = true;
  }
}
canvas.addEventListener('pointermove', swipe);
canvas.addEventListener('pointerup', (event) => {
  swipe(event);
  if (pointer?.id === event.pointerId) pointer = null;
});
for (const event of ['pointercancel', 'lostpointercapture']) {
  canvas.addEventListener(event, () => { pointer = null; });
}

document.addEventListener('keydown', (event) => {
  if (dialog.open || event.altKey || event.ctrlKey || event.metaKey) return;
  const key = event.key.toLowerCase();
  if (['arrowleft', 'arrowright', 'a', 'd'].includes(key) && mode === 'flight') {
    event.preventDefault();
    if (!event.repeat) move(key === 'arrowleft' || key === 'a' ? -1 : 1);
  } else if ((key === 'p' || key === 'escape') && mode === 'flight' && !event.repeat) {
    event.preventDefault();
    audio.activate();
    setPaused(!paused);
  } else if ((key === ' ' || key === 'enter') && event.target === canvas && !event.repeat) {
    event.preventDefault();
    if (mode === 'menu' || mode === 'over') start();
    else if (mode === 'splash') { audio.activate(); goMenu(); }
  }
});
window.addEventListener('blur', () => {
  setPaused(true);
  audio.music.pause();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) setPaused(true);
  lastTime = performance.now();
  audio.sync();
});

async function loadImage(path) {
  const image = new Image();
  image.src = asset(`images/${path}.png`);
  await image.decode();
  return image;
}

async function boot() {
  if (!ctx) throw new Error('Canvas is unavailable');
  const paths = {
    background: 'background', stars: 'stars', starsEffect: 'stars-effect',
    menuBackground: 'menu-background', hills: 'hills', title: 'title',
    cat: 'cat', rocket: 'rocket', cloud: 'cloud', burntCat: 'burnt-cat',
    crashRocket: 'crash-rocket', splash: 'splash', particle: 'particle', medal: 'icons/NewBest',
  };
  const loaded = await Promise.all(Object.entries(paths).map(async ([key, path]) => [key, await loadImage(path)]));
  images = Object.fromEntries(loaded);
  await document.fonts.load('32px Modak');
  particleTextures = ['#fabcf9', '#cca6ff', '#fff5a9', '#e2c6ff', '#9ad8f9', '#f1b6cc', '#cce9ff', '#fff'].map((color) => {
    const tile = document.createElement('canvas');
    tile.width = tile.height = 32;
    const c = tile.getContext('2d');
    c.drawImage(images.particle, 0, 0, 32, 32);
    c.globalCompositeOperation = 'source-in';
    c.fillStyle = color;
    c.fillRect(0, 0, 32, 32);
    return tile;
  });
  $('loading-ui').hidden = true;
  mode = 'splash';
  sceneTime = 0;
  syncSound();
  syncUI();
  new ResizeObserver(resize).observe(stage);
  resize();
  requestAnimationFrame(frame);
}

boot().catch(() => {
  $('loading-label').textContent = 'The rocket couldn’t load. Check your connection and try again.';
  $('reload').hidden = false;
  announce('Unable to load game assets.');
});
