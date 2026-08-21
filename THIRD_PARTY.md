# Third-party material

## Offline game sprites

The pixel grids in `js/sprites.js` — the runner, the cacti, the pterodactyl,
the cloud, the ground tiles, the score glyphs and the "GAME OVER" lettering —
are the browser offline game's own artwork, sliced out of:

    components/neterror/resources/images/default_100_percent/offline/
    100-offline-sprite.png

from the Chromium source tree. The sprite offsets used to cut them come from
`components/neterror/resources/dino_game/offline_sprite_definitions.ts`, and
the animation frame offsets from `components/neterror/resources/dino_game/trex.ts`.

The same files are the source of the gameplay constants this project uses:
sprite sizes, ground positions, minimum gaps, multiple-speed thresholds and
every collision box.

Chromium is published under a BSD 3-Clause licence:

> Copyright 2015 The Chromium Authors. All rights reserved.
>
> Redistribution and use in source and binary forms, with or without
> modification, are permitted provided that the following conditions are met:
>
> 1. Redistributions of source code must retain the above copyright notice,
>    this list of conditions and the following disclaimer.
> 2. Redistributions in binary form must reproduce the above copyright notice,
>    this list of conditions and the following disclaimer in the documentation
>    and/or other materials provided with the distribution.
> 3. Neither the name of Google LLC nor the names of its contributors may be
>    used to endorse or promote products derived from this software without
>    specific prior written permission.
>
> THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
> AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
> IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
> ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE
> LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
> CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
> SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
> INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
> CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
> ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
> POSSIBILITY OF SUCH DAMAGE.

The licence permits reuse with the notice above retained, which this file does.
Google's name and marks are not used to endorse this project.

## Not from Chromium

Everything else is this project's own work: the game loop, physics integration,
obstacle scheduling, day/night handling, the autopilot in `js/autopilot.js`,
the page and its styling, the local server, and the restart button, which is
generated in `js/sprites.js` because the modern sprite sheet carries a browser
logo in that slot rather than the circular arrow the classic game shows.

Sound is three synthesised WebAudio tones. No audio files are used.
