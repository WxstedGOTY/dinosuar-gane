# Offline Runner

A from-scratch clone of the endless-runner game that browsers show when the
network is down. Built for personal use.

The game fills the browser window, the way the original does once you start
playing: the canvas scales up to the window and the page behind it is painted
the same colour, so there is no border around the play area at any size.

## Running it

Either works, and neither reaches the network:

```
node serve.js            # then open http://localhost:8000/
```

or just open `index.html` in a browser. The server is worth using because some
browsers refuse `localStorage` on `file://`, which is where the high score and
your mode choice are kept.

`serve.js` binds to `127.0.0.1`, so the page is reachable from that machine and
nowhere else -- not the local network, not the internet. Pass a port to change
it: `node serve.js 9000`. It has no dependencies.

No build step, no packages to install, no network calls at any point.

## Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Start / jump | `Space`, `Up`, `Enter` or `W` | tap the upper part of the canvas |
| Duck | `Down` or `S` | hold the lower part of the canvas |
| Fall faster mid-jump | `Down` | -- |
| Mute | `M` | -- |
| Restart after a crash | any jump key | tap anywhere |
| Settings | -- | the gear, top-left |

Releasing the jump key early cuts the jump short, so short hops and full jumps
are both available.

## Modes

The gear in the top-left corner opens a small panel with two modes. The choice
is remembered in `localStorage`.

**Normal** -- you play it.

**Hack mode** -- it plays itself, and keeps playing: it starts a run on its own
and picks straight back up after a crash. Your keys still work at any time;
while you are holding one the autopilot stands down completely and hands
control back the moment you let go.

## How hack mode decides

It does not react at a tuned distance. Every frame it rolls the world forward
and asks what actually survives:

- Does doing nothing clear the next obstacle? Then do nothing -- that is the
  answer for a high-flying pterodactyl.
- Does ducking clear it? Then duck, which is how the middle lane is handled.
- Otherwise it has to be jumped.

For a jump there is a window of frames in which starting the jump clears the
obstacle: go too early and the T-Rex lands in front of it, too late and it
never leaves the ground. Waiting keeps options open, so it holds until only a
few frames of that window remain.

Once airborne the arc is mostly committed, but the down key still works, and
falling fast is the one move left. It drops the T-Rex under a high pterodactyl
it would otherwise clip, and it lands sooner, which can buy back the frames
needed to jump again before the next obstacle arrives. Mid-air it checks
whether riding the arc out still ends well, and if not, whether dropping does.

Two details make the prediction trustworthy:

- The arc it plans against comes from `Trex.predictJump`, which runs the same
  physics the live T-Rex uses, so the two cannot drift apart.
- Obstacles move by `Math.floor(speed x frames)`, so the real per-frame step is
  either `floor(speed)` or a pixel more depending on how long the frame took.
  Every plan is checked against both, and only counts as safe if it survives
  both.

Lookahead stops once the obstacle being planned around has gone by and the
T-Rex is back on the ground. Anything further out gets its own decision on a
later frame -- judging a single jump against obstacles it will clear separately
rejects every option and leaves nothing but panic jumps.

## How it plays

- Starts at speed 6 and accelerates by 0.001 per frame up to a cap of 13.
- Cacti come in small and large variants, in groups of one to three. Groups
  only appear once the game is fast enough for them to be fair.
- Pterodactyls start showing up at speed 8.5 (roughly 450 points) in three
  lanes: low (jump it), middle (duck or jump) and high (safe if you hold your
  nerve and keep running).
- The score flashes every 100 points.
- Every 700 points the world flips to night for 12 seconds. A run always
  starts in daylight, including on a device set to a dark theme -- only the
  page around the canvas follows the device.
- The high score is kept in `localStorage` under `offline-runner.highScore`.

## Fitting the window

The canvas is stretched to the window by CSS, and the backing store is resized
to match so the pixels stay square and hard-edged rather than being smeared by
the browser. Everything in the game is still drawn in a fixed 600x150
coordinate space, so the window size never touches physics, collision boxes or
obstacle spacing -- a 4K screen plays exactly like a phone, just larger.

At night the page background is repainted along with the canvas. Inverting
white gives exactly black, so the two agree and the game reads as filling the
screen instead of sitting in a lit frame.

## Why a run has no ceiling

Difficulty is derived entirely from speed, and speed stops rising at 13, which
it reaches after about two minutes. Gap sizes, how often obstacles spawn and
which ones are eligible all come off that one number, so from two minutes in
the game is as hard as it will ever get and simply repeats. Nothing scales
with the score.

That makes an unbounded run a question of whether anything degrades rather
than whether the game gets too fast:

- The score has no digit limit. It pads to five and then grows, and the
  readout is right-aligned, so six and seven digit scores stay clear of the
  high score rather than running off the edge.
- Distance is a double accumulating about 780 per second, which stays an exact
  integer for longer than the hardware will last.
- Obstacles and clouds are filtered out once off-screen, and the type history
  is truncated to two entries.
- The two ground tiles are repainted in place as they recycle. They used to be
  rebuilt, which allocated a fresh canvas roughly every three quarters of a
  second at full speed -- fine for a few minutes, needless churn for a run
  meant to carry on.

## Layout

```
index.html             page shell and the settings panel
css/style.css          full-window layout, night-mode inversion
js/sprites.js          all artwork, as pixel grids rasterised at start-up
js/game.js             physics, obstacles, collision, scoring, day/night cycle
js/autopilot.js        hack mode
serve.js               localhost-only static server
build-single-file.js   bundles the page into one HTML file
```

`node build-single-file.js` writes `offline-runner.html`, a single file with
everything inlined -- handy for dropping somewhere that only takes one file.
The multi-file version stays the source of truth; the bundler only inlines it,
so the two cannot drift apart.

## Artwork

Every sprite -- the runner, the cacti, the pterodactyl, the clouds and the
10x13 score font -- is defined as a pixel grid in `js/sprites.js` and drawn
onto offscreen canvases when the page loads. Nothing is copied from anyone
else's sprite sheet and there are no image files to ship. Sound is three
synthesised WebAudio blips, so there are no audio files either.

Everything is authored at 1x, at the sizes the original draws: 44x47 for the
runner, 59x30 ducking, 17x35 and 25x50 for the cacti, 46x40 for the
pterodactyl, 46x14 for a cloud. An earlier version drew half-resolution grids
scaled up by two, which meant every apparent pixel was really a 2x2 block --
about a quarter of the original's detail, and visibly coarse once the canvas
filled a window.

Collision boxes are measured off those grids rather than estimated, one box per
contiguous run of pixels so that no box spans a gap: the space between the tail
and the neck, or between a cactus arm and its trunk, must not count as solid.

The ground is generated per tile rather than drawn once: a one pixel line, a
bump every few pixels riding on top of it, a handful of shallow dips where the
line steps down, and grit scattered underneath in loose clusters. The density
is the point -- a sparse line reads as ruled, not as ground.

## What has been checked

Driven through a headless browser:

- Every obstacle the game can spawn -- both cacti at each group size, the
  pterodactyl at each of its three heights -- across speeds 6 to 13.
  54 of 54 cleared.
- Collision boxes against the drawn pixels: 13 cases covering what should and
  should not hit while standing, ducking and at the top of a jump. The high
  pterodactyl is the interesting one -- harmless if you keep running, fatal if
  you panic-jump into it.
- A forty-five minute autopilot run: score 52,029, no deaths, 2,560 jumps,
  357 ducks, 74 night cycles, no console errors. Score grew linearly at about
  5,850 per five minutes throughout, and the JS heap held at 9.5 MB from the
  first sample to the last.
- The mid-air fast-fall, run twice per case with the recovery enabled and
  stubbed out: it turned a death into a survival in 8 of 24 cases and never
  made one worse.

## Scope

This is a personal project, kept private and not distributed. The page carries
a `noindex, nofollow` robots tag so it will not be indexed if it is ever served
over a network.
