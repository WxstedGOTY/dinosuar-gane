# Offline Runner

A from-scratch clone of the endless-runner game that browsers show when the
network is down. Built for personal use.

Open `index.html` in a browser. That's it -- no build step, no dependencies,
no server, no network calls.

## Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Start / jump | `Space`, `↑`, `Enter` or `W` | tap the upper part of the canvas |
| Duck | `↓` or `S` | hold the lower part of the canvas |
| Fall faster mid-jump | `↓` | -- |
| Mute | `M` | -- |
| Restart after a crash | any jump key | tap anywhere |
| Settings | -- | the gear, top-left |

Releasing the jump key early cuts the jump short, so short hops and full jumps
are both available.

## Modes

The gear in the top-left corner opens a small panel with two modes. The choice
is remembered in `localStorage`.

**Normal** — you play it.

**Hack mode** — it plays itself, and keeps playing: it starts a run on its own
and picks straight back up after a crash. Your keys still work at any time;
while you are holding one the autopilot stands down completely and hands
control back the moment you let go.

## How hack mode decides

It does not react at a tuned distance. Every frame it rolls the world forward
and asks what actually survives:

- Does doing nothing clear the next obstacle? Then do nothing — that is the
  answer for a high-flying pterodactyl.
- Does ducking clear it? Then duck, which is how the middle lane is handled.
- Otherwise it has to be jumped.

For a jump there is a window of frames in which starting the jump clears the
obstacle: go too early and the T-Rex lands in front of it, too late and it
never leaves the ground. Waiting keeps options open, so it holds until only a
few frames of that window remain.

Two details make the prediction trustworthy:

- The arc it plans against comes from `Trex.predictJump`, which runs the same
  physics the live T-Rex uses, so the two cannot drift apart.
- Obstacles move by `Math.floor(speed x frames)`, so the real per-frame step is
  either `floor(speed)` or a pixel more depending on how long the frame took.
  Every plan is checked against both, and only counts as safe if it survives
  both.

Lookahead stops once the obstacle being planned around has gone by and the
T-Rex is back on the ground. Anything further out gets its own decision on a
later frame — judging a single jump against obstacles it will clear separately
rejects every option and leaves nothing but panic jumps.

## How it plays

- Starts at speed 6 and accelerates by 0.001 per frame up to a cap of 13.
- Cacti come in small and large variants, in groups of one to three. Groups
  only appear once the game is fast enough for them to be fair.
- Pterodactyls start showing up at speed 8.5 (roughly 450 points) in three
  lanes: low (jump it), middle (duck or jump) and high (safe if you hold your
  nerve and keep running).
- The score flashes every 100 points.
- Every 700 points the world flips to night for 12 seconds.
- The high score is kept in `localStorage` under `offline-runner.highScore`.

## Layout

```
index.html        page shell and the settings panel
css/style.css     page styling, night-mode inversion, dark-mode handling
js/sprites.js     all artwork, as pixel grids rasterised at start-up
js/game.js        physics, obstacles, collision, scoring, day/night cycle
js/autopilot.js   hack mode
```

## Artwork

Every sprite -- the runner, the cacti, the pterodactyl, the clouds and the
5x7 score font -- is defined as a pixel grid in `js/sprites.js` and drawn onto
offscreen canvases when the page loads. Nothing is copied from anyone else's
sprite sheet and there are no image files to ship. Sound is three synthesised
WebAudio blips, so there are no audio files either.

## Scope

This is a personal project, kept private and not distributed. The page carries
a `noindex, nofollow` robots tag so it will not be indexed if it is ever served
over a network.
