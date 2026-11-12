import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { Flight, RULES, laneX, circleHitsBox, readProgress, recordFlight } from '../assets/fluffy-skies/core.mjs';

function advance(flight, seconds) {
  for (let elapsed = 0; elapsed < seconds - 1e-9; elapsed += RULES.step) flight.step(RULES.step);
}

test('original entrance and spawn timing are preserved', () => {
  const flight = new Flight(() => 0.5);
  advance(flight, 0.5);
  assert.equal(flight.state, 'ready');
  assert.equal(flight.clouds.length, 0);
  advance(flight, 0.5);
  assert.equal(flight.state, 'playing');
  assert.equal(flight.clouds.length, 0);
  advance(flight, 0.08);
  assert.equal(flight.clouds.length, 1);
  assert.equal(flight.clouds[0].lane, 1);
  assert.ok(Math.abs(RULES.spawnInterval - 0.52195) < 1e-10);
  assert.ok(flight.clouds[0].y < 0);
});

test('one input moves one lane in 25ms and cannot leave the field', () => {
  const flight = new Flight();
  assert.equal(flight.move(-1), false);
  advance(flight, 0.6);
  assert.equal(flight.move(-1), true);
  flight.step(RULES.step);
  assert.ok(flight.x < 360 && flight.x > 180);
  assert.equal(flight.move(-1), false, 'ignore new gestures during the short tween');
  advance(flight, 2 * RULES.step);
  assert.equal(flight.x, laneX(0));
  assert.equal(flight.move(-1), false);
  assert.equal(flight.move(1), true);
  advance(flight, 0.025);
  assert.equal(flight.x, laneX(1));
  assert.equal(flight.move(1), true);
  advance(flight, 0.025);
  assert.equal(flight.x, laneX(2));
  assert.equal(flight.move(1), false);
});

test('safe passage awards exactly one point per row', () => {
  const flight = new Flight(() => 0.5);
  advance(flight, 2);
  assert.equal(flight.state, 'playing');
  assert.equal(flight.score, 1);
  advance(flight, 0.2);
  assert.equal(flight.score, 1);
  advance(flight, 4);
  assert.ok(flight.score >= 9);
  assert.equal(flight.state, 'playing');
  assert.ok(flight.clouds.length <= 4, 'off-screen rows are removed');
});

test('a cloud collision ends the flight before awarding a point, exactly once', () => {
  const flight = new Flight(() => 0);
  let hits = 0;
  for (let i = 0; i < 240; i++) {
    flight.step(RULES.step);
    hits += flight.events.filter((event) => event === 'hit').length;
  }
  assert.equal(flight.state, 'crashed');
  assert.equal(flight.score, 0);
  assert.equal(hits, 1);
  assert.equal(flight.move(-1), false);
  const y = flight.clouds[0].y;
  advance(flight, 2);
  assert.equal(flight.state, 'over');
  assert.equal(flight.clouds[0].y, y, 'obstacles stop on impact');
  flight.reset();
  assert.equal(flight.state, 'ready');
  assert.equal(flight.score, 0);
  assert.equal(flight.clouds.length, 0);
});

test('following changing openings remains playable with real lane inputs', () => {
  let count = 0;
  const sequence = [0, 1, 2, 0, 2, 1];
  const flight = new Flight(() => (sequence[count++ % sequence.length] + 0.5) / 3);
  for (let tick = 0; tick < 120 * 20; tick++) {
    // Wait until a previous row is clear of the circular hitbox before crossing.
    const next = flight.clouds.find((row) => row.y < RULES.catY + RULES.radius + RULES.cloudHeight / 2 + 2);
    if (next) flight.move(Math.sign(next.lane - flight.lane));
    flight.step(RULES.step);
    if (flight.state === 'crashed') break;
  }
  assert.equal(flight.state, 'playing');
  assert.ok(flight.score > 30);
});

test('collision geometry preserves the circular cat hitbox at cloud corners', () => {
  assert.equal(circleHitsBox(0, 0, 10, 10, -5, 50, 10), true);
  assert.equal(circleHitsBox(0, 0, 10, 8, 8, 50, 10), false);
  assert.equal(circleHitsBox(0, 0, 10, 7, 7, 50, 10), true);
});

test('scores survive a storage round trip and records stay bounded', () => {
  let progress = readProgress(undefined);
  for (const score of [3, 8, 1, 20, 4, 10, 2]) progress = recordFlight(progress, score);
  assert.equal(progress.best, 20);
  assert.equal(progress.flights, 7);
  assert.deepEqual(progress.scores, [20, 10, 8, 4, 3]);
  assert.deepEqual(readProgress({ getItem: () => JSON.stringify(progress) }), progress);
});

test('unavailable or damaged browser storage never prevents a flight', () => {
  const empty = { best: 0, flights: 0, muted: false, scores: [] };
  assert.deepEqual(readProgress({ getItem() { throw new Error('Blocked'); } }), empty);
  assert.deepEqual(readProgress({ getItem: () => '{broken' }), empty);
  assert.deepEqual(readProgress({ getItem: () => '{"best":-10,"flights":"oops","scores":[null,8,-1,"9"]}' }), { ...empty, scores: [8] });
});

test('original artwork and audio are byte-for-byte preserved', async () => {
  const provenance = JSON.parse(await readFile(new URL('./asset-provenance.json', import.meta.url)));
  for (const [file, origin] of Object.entries(provenance)) {
    const url = new URL(`../assets/fluffy-skies/${file}`, import.meta.url);
    assert.ok((await stat(url)).size > 0, file);
    if (origin.sha256) assert.equal(createHash('sha256').update(await readFile(url)).digest('hex'), origin.sha256, file);
  }
});
