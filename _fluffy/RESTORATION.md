# Fluffy Skies browser restoration

The original game was released under Looper Studios in 2016. The web version lives at `/fluffy-skies/` and runs as static HTML, CSS, and JavaScript on the existing Jekyll/GitHub Pages site. There are no runtime packages, accounts, backend services, or external asset requests.

## Sources

- Gameplay: the recovered `Fluffy Skies/Classes` Cocos2d-x C++ files.
- Artwork, music, sound effects, font, and emitter: the recovered `Fluffy` asset folder.
- `asset-provenance.json` records the source of each included asset and SHA-256 digests for unchanged copies. The original files are retained in their source folders.
- The Modak font and its OFL license were extracted from `Fonts/modak.zip`.
- `images/particle.png` is the original texture decoded from the base64/gzip data in `Resources/ParticleEffects/jetThrower.plist`.

Only the runtime assets are published. C++ sources, PSDs, Android signing material, SDK credentials/identifiers, and unused asset variants are not included. This `_fluffy` directory is excluded from the generated site by Jekyll's underscore-directory convention.

## Preserved behavior

- Logical portrait dimensions: 720 × 1080, matching the original high-resolution Android design configuration. Canvas resizing never changes the game world or difficulty.
- Lane centers: 25%, 50%, and 75% of the width; cat center at 60% of height measured from the top.
- Cat: 57 × 125 artwork plus the separate 31 × 43 rocket, matching the composition in `Cat.cpp`. The alternate Resources cat already includes a rocket and is intentionally not used.
- Cat circle radius 28.5; cloud rectangle 500 × 54; gap width 171.
- One lane per swipe beyond 5% of screen width; 0.025-second sine easing; input during a lane transition is ignored as in the original position checks.
- 0.55-second entrance delay. Cloud rows spawn every `0.0011 × 474.5 = 0.52195` seconds and travel 1.5 screen heights over `0.0021 × 947 = 1.9887` seconds. Random gaps are uniform across three lanes. No additional difficulty ramp.
- Original point-sensor behavior, collision ending the flight, and 1.5-second crash transition.
- Original title, hills, moon, menu buttons, Looper Studios splash, scrolling star layers, music, effects, score tally, and new-best medal.
- Original score and flight-count achievement thresholds, now stored locally with the top five scores and sound preference.

## Browser adaptations

- A fixed 120 Hz simulation makes movement and hit detection independent of display refresh rate. Animated debris converts the original frame-based velocity/gravity using its 60 FPS target.
- Background layers are fitted to the shared 720 × 1080 world; the archive mixes 608 × 1080 and 720 × 1080 exports. This avoids the original resolution-specific gaps.
- The original particle texture, emission count/lifetime/speed/size, and additive blending are retained. The browser emitter uses a small tint palette for the original color variation.
- Arrow keys / A and D, accessible HTML buttons, pause/resume, visibility pause, and pointer swipes supplement touch controls. Reduced-motion settings suppress decorative bobbing/drift and reduce particles; obstacle motion remains necessary for play.
- Audio begins after a user gesture. The game remains playable when audio or persistent storage is unavailable. A flight paused by a tab/app switch requires an explicit resume.
- Native sharing or clipboard copying replaces social SDK integrations. Ads, Google Play sign-in, analytics, and remote leaderboards are omitted. Records are accurately labeled as browser-local.
- `Sounds/Best.mp3` was absent from the recovered assets. The medal remains, without inventing a replacement celebration sound.
- The title/menu composition and game-over transition are reconstructed from source and assets. No recording or runnable release was supplied for a frame-by-frame comparison.

## Checks and preview

```sh
node --test _fluffy/game.test.mjs
node --check assets/fluffy-skies/game.js
bundle exec jekyll build
bundle exec jekyll serve --host 127.0.0.1 --port 4000
```

Use the Ruby version matching the installed bundle (Ruby 3.3 for the recovered local environment). The game page can also be previewed directly with a static HTTP server; it has no Liquid or build dependency. Do not open it with `file://`, because browser modules require HTTP.

Manual checks: play → score → collision → restart → menu; three-lane keyboard and swipe input; mute/unmute; pause and background/resume; records and achievements; share fallback; reload persistence; portrait phone layout and desktop layout. Test on a physical phone for actual touch/audio behavior before release.

## Verification completed

- All nine Node tests passed: source timing, lane controls, scoring, collision/game-over/reset, changing-gap playability, circular hitboxes, storage resilience, and original-asset checksums.
- Jekyll production build passed using Ruby 3.3; generated-page assets and links resolve, and development notes/signing material are absent from the output.
- In-app browser: homepage link, original menu, scoring and collision, retry, keyboard and pointer swipe movement, pause/resume, records, achievement lists, mute preference and best-score persistence after reload. No browser errors or warnings were reported.
- Responsive layout checked at 390 × 844, with no horizontal overflow. A physical phone and the original native release were not available for comparison.
