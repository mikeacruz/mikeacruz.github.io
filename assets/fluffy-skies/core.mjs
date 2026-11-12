// Gameplay recovered from the 2016 Cocos2d-x source. Distances use a 720×1080
// portrait world; resizing the canvas must never change these values.
export const RULES = Object.freeze({
  width: 720,
  height: 1080,
  catWidth: 57,
  catHeight: 125,
  catY: 1080 * 0.6,
  radius: 57 / 2,
  cloudWidth: 500,
  cloudHeight: 54,
  gap: 57 * 3,
  spawnInterval: 0.0011 * 474.5,
  cloudSpeed: (1080 * 1.5) / (0.0021 * 947),
  moveDuration: 0.025,
  startDelay: 0.55,
  crashDuration: 1.5,
  step: 1 / 120,
});

export const SCORE_MILESTONES = [10, 25, 50, 75, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];
export const FLIGHT_MILESTONES = [3, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000];
export const laneX = (lane) => RULES.width * (lane + 1) / 4;

export function circleHitsBox(x, y, radius, left, top, width, height) {
  const dx = x - Math.max(left, Math.min(x, left + width));
  const dy = y - Math.max(top, Math.min(y, top + height));
  return dx * dx + dy * dy <= radius * radius;
}

export class Flight {
  constructor(random = Math.random) {
    this.random = random;
    this.reset();
  }

  reset() {
    this.state = 'ready';
    this.age = 0;
    this.crashTime = 0;
    this.spawnClock = 0;
    this.score = 0;
    this.lane = 1;
    this.x = laneX(1);
    this.moveFrom = this.x;
    this.moveTime = RULES.moveDuration;
    this.clouds = [];
    this.events = [];
  }

  move(direction) {
    if (this.state !== 'playing' || this.moveTime < RULES.moveDuration) return false;
    const next = Math.max(0, Math.min(2, this.lane + Math.sign(direction)));
    if (next === this.lane) return false;
    this.moveFrom = this.x;
    this.lane = next;
    this.moveTime = 0;
    return true;
  }

  step(dt) {
    this.events = [];
    if (this.state === 'over') return;
    this.age += dt;
    if (this.state === 'crashed') {
      this.crashTime += dt;
      if (this.crashTime >= RULES.crashDuration) this.state = 'over';
      return;
    }
    if (this.state === 'ready') {
      if (this.age < RULES.startDelay) return;
      this.state = 'playing';
      // Only advance the portion of this tick after the entrance transition.
      dt = Math.max(0, this.age - RULES.startDelay);
    }

    this.moveTime = Math.min(RULES.moveDuration, this.moveTime + dt);
    const ease = (1 - Math.cos(Math.PI * this.moveTime / RULES.moveDuration)) / 2;
    this.x = this.moveFrom + (laneX(this.lane) - this.moveFrom) * ease;

    for (const cloud of this.clouds) cloud.y += RULES.cloudSpeed * dt;
    this.spawnClock += dt;
    while (this.spawnClock >= RULES.spawnInterval) {
      this.spawnClock -= RULES.spawnInterval;
      const lane = Math.min(2, Math.floor(this.random() * 3));
      this.clouds.push({ lane, y: -RULES.cloudHeight + RULES.cloudSpeed * this.spawnClock, scored: false });
    }
    for (const cloud of this.clouds) {
      const center = laneX(cloud.lane);
      const top = cloud.y - RULES.cloudHeight / 2;
      const leftEdge = center - RULES.gap / 2;
      const rightEdge = center + RULES.gap / 2;
      if (
        circleHitsBox(this.x, RULES.catY, RULES.radius, leftEdge - RULES.cloudWidth, top, RULES.cloudWidth, RULES.cloudHeight) ||
        circleHitsBox(this.x, RULES.catY, RULES.radius, rightEdge, top, RULES.cloudWidth, RULES.cloudHeight)
      ) {
        this.state = 'crashed';
        this.events.push('hit');
        return;
      }
      // The original point sensor is a one-pixel line through the opening.
      if (!cloud.scored && cloud.y >= RULES.catY - RULES.radius) {
        cloud.scored = true;
        this.score++;
        this.events.push('point');
      }
    }
    this.clouds = this.clouds.filter((cloud) => cloud.y < RULES.height + RULES.cloudHeight);
  }
}

export function readProgress(storage) {
  const empty = { best: 0, flights: 0, muted: false, scores: [] };
  try {
    const data = JSON.parse(storage.getItem('fluffy-skies-v1'));
    if (!data || typeof data !== 'object') return empty;
    const integer = (v) => Number.isSafeInteger(v) && v >= 0 ? v : 0;
    return {
      best: integer(data.best),
      flights: integer(data.flights),
      muted: data.muted === true,
      scores: Array.isArray(data.scores) ? data.scores
        .filter((s) => Number.isSafeInteger(s) && s >= 0).sort((a, b) => b - a).slice(0, 5) : [],
    };
  } catch {
    return empty;
  }
}

export function recordFlight(progress, score) {
  return {
    ...progress,
    best: Math.max(progress.best, score),
    flights: progress.flights + 1,
    scores: [...progress.scores, score].sort((a, b) => b - a).slice(0, 5),
  };
}
