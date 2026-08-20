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

Releasing the jump key early cuts the jump short, so short hops and full jumps
are both available.

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
index.html        page shell
css/style.css     page styling, night-mode inversion, dark-mode handling
js/sprites.js     all artwork, as pixel grids rasterised at start-up
js/game.js        physics, obstacles, collision, scoring, day/night cycle
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
