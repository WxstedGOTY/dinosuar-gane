/*
 * autopilot.js -- "hack mode".
 *
 * Rather than reacting at a hand-tuned distance, this rolls the world forward
 * and asks what actually survives. Every frame it answers three questions:
 *
 *   - does doing nothing survive the next HORIZON frames?
 *   - does ducking and holding it survive?
 *   - does jumping survive, and how much longer could it be put off?
 *
 * The prediction runs the same jump physics the live T-Rex uses
 * (Trex.predictJump) and the same collision boxes, so it cannot drift out of
 * sync with the game.
 */

(function (global) {
  'use strict';

  // Frames of lookahead. Long enough to contain a whole jump arc at top speed.
  var HORIZON = 70;

  // Slack around obstacles when planning, to absorb the odd dropped frame.
  var MARGIN_X = 4;
  var MARGIN_Y = 2;

  // The live game moves obstacles by Math.floor(speed * frames), so the true
  // per-frame step is either floor(speed) or one pixel more depending on how
  // long the frame took. Planning against a single average drifts several
  // pixels over a jump arc, which is enough to clip a cactus, so every plan is
  // checked against both extremes and only counts as safe if it survives both.
  var STEP_VARIANTS = 2;

  // How far ahead to look when measuring how much longer a jump can be put
  // off, and how many of those frames to leave unspent when committing.
  var MAX_DELAY = 12;
  var LATE_CUSHION = 3;

  function intersects(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }

  /**
   * @param {!Object} runner
   * @constructor
   */
  function Autopilot(runner) {
    this.runner = runner;
    this.enabled = false;

    this.arc = null;
    this.arcKey = -1;
  }

  Autopilot.prototype = {
    /** The jump arc only changes as the game speeds up, so cache it. */
    jumpArc: function (speed) {
      var key = Math.round(speed * 50);
      if (this.arcKey !== key) {
        this.arc = this.runner.trex.predictJump(speed, HORIZON + 5);
        this.arcKey = key;
      }
      return this.arc;
    },

    /** Freeze the obstacle queue into plain numbers for the simulation. */
    snapshot: function (speed) {
      var live = this.runner.horizon.obstacles;
      var trexX = this.runner.trex.xPos;
      var out = [];
      for (var i = 0; i < live.length; i++) {
        var o = live[i];
        // Anything already behind the T-Rex can never be hit again.
        if (o.xPos + o.width < trexX) continue;

        var slow = Math.floor(speed + o.speedOffset);
        out.push({
          x: o.xPos,
          y: o.yPos,
          steps: [slow, slow + 1],
          size: o.size,
          unitWidth: o.typeConfig.width,
          width: o.width,
          height: o.typeConfig.height,
          boxes: o.typeConfig.collisionBoxes
        });
      }
      return out;
    },

    /**
     * Collision test for one simulated frame.
     * @param {number} trexY
     * @param {boolean} ducking
     * @param {!Array<!Object>} obstacles
     * @param {number} frame how many frames the obstacles have advanced
     * @param {number} variant which per-frame obstacle step to assume
     * @return {boolean}
     */
    hits: function (trexY, ducking, obstacles, frame, variant) {
      var trex = this.runner.trex;
      var boxes = ducking ? trex.collisionBoxes.DUCKING : trex.collisionBoxes.RUNNING;
      var ty = ducking ? trex.duckYPos : trexY;
      var tw = ducking ? trex.config.WIDTH_DUCK : trex.config.WIDTH;
      var th = ducking ? trex.config.HEIGHT_DUCK : trex.config.HEIGHT;

      for (var i = 0; i < obstacles.length; i++) {
        var o = obstacles[i];
        var ox = o.x - o.steps[variant] * frame;

        // Whole-obstacle rejection before the per-part boxes.
        if (!intersects(trex.xPos, ty, tw, th,
                        ox - MARGIN_X, o.y - MARGIN_Y,
                        o.width + MARGIN_X * 2, o.height + MARGIN_Y * 2)) {
          continue;
        }

        for (var u = 0; u < o.size; u++) {
          var ux = ox + u * o.unitWidth;
          for (var b = 0; b < o.boxes.length; b++) {
            var ob = o.boxes[b];
            for (var t = 0; t < boxes.length; t++) {
              var tb = boxes[t];
              if (intersects(
                    trex.xPos + tb.x, ty + tb.y, tb.width, tb.height,
                    ux + ob.x - MARGIN_X, o.y + ob.y - MARGIN_Y,
                    ob.width + MARGIN_X * 2, ob.height + MARGIN_Y * 2)) {
                return true;
              }
            }
          }
        }
      }
      return false;
    },

    /**
     * Roll the world forward and report whether a plan survives.
     * @param {string} plan 'run', 'duck' or 'jump'
     * @param {number} delay frames to wait before a jump starts
     * @param {number=} horizon frames to look ahead, defaults to HORIZON
     * @return {boolean}
     */
    survives: function (plan, delay, horizon) {
      var trex = this.runner.trex;
      var speed = this.runner.currentSpeed;
      var obstacles = this.snapshot(speed);
      if (!obstacles.length) return true;

      var frames = horizon || HORIZON;
      var arc = plan === 'jump' ? this.jumpArc(speed) : null;
      var ducking = plan === 'duck';
      var target = obstacles[0];

      for (var v = 0; v < STEP_VARIANTS; v++) {
        for (var f = 1; f <= frames; f++) {
          var y = trex.groundYPos;
          if (arc) {
            var step = f - delay - 1;
            if (step >= 0) {
              y = step < arc.length ? arc[step] : trex.groundYPos;
            }
          }
          if (this.hits(y, ducking, obstacles, f, v)) return false;

          // Stop once the obstacle being planned around has gone by and the
          // T-Rex is back on the ground. Whatever is further out gets its own
          // decision on a later frame, and a plan that only has to survive one
          // action cannot be judged on obstacles it will jump separately --
          // doing so rejects every option and leaves nothing but panic jumps.
          if (y >= trex.groundYPos &&
              target.x - target.steps[v] * f + target.width < trex.xPos) {
            break;
          }
        }
      }
      return true;
    },

    /**
     * Walk one full plan and report whether it survives: finish the fall the
     * T-Rex is already in, land, wait, then jump again.
     * @param {!Array<number>} fall remaining descent, ending on the ground
     * @param {!Array<number>} jump arc of the re-jump
     * @param {number} jumpFrame frame the re-jump starts on
     * @param {!Array<!Object>} obstacles
     * @return {boolean}
     */
    pathSurvives: function (fall, jump, jumpFrame, obstacles) {
      var trex = this.runner.trex;
      var target = obstacles[0];

      for (var v = 0; v < STEP_VARIANTS; v++) {
        for (var f = 1; f <= HORIZON; f++) {
          var y;
          if (f <= fall.length) {
            y = fall[f - 1];
          } else if (f < jumpFrame) {
            y = trex.groundYPos;
          } else {
            var step = f - jumpFrame;
            y = step < jump.length ? jump[step] : trex.groundYPos;
          }

          if (this.hits(y, false, obstacles, f, v)) return false;

          if (y >= trex.groundYPos && f >= jumpFrame &&
              target.x - target.steps[v] * f + target.width < trex.xPos) {
            break;
          }
        }
      }
      return true;
    },

    /**
     * Mid-air, is there any way out of this jump? Tries landing and re-jumping
     * at every opportunity.
     * @param {boolean} speedDrop whether to fall fast
     * @return {boolean}
     */
    recoverable: function (speedDrop) {
      var trex = this.runner.trex;
      var speed = this.runner.currentSpeed;
      var obstacles = this.snapshot(speed);
      if (!obstacles.length) return true;

      var fall = trex.predictArc(trex.yPos, trex.jumpVelocity, speedDrop, HORIZON);
      var jump = this.jumpArc(speed);

      for (var d = 0; d <= MAX_DELAY; d++) {
        if (this.pathSurvives(fall, jump, fall.length + d, obstacles)) return true;
      }
      return false;
    },

    /**
     * How many more frames the T-Rex could wait and still clear everything.
     * @return {number} largest safe delay, capped at MAX_DELAY
     */
    slack: function () {
      for (var d = 1; d <= MAX_DELAY; d++) {
        if (!this.survives('jump', d)) return d - 1;
      }
      return MAX_DELAY;
    },

    /** One decision. Called once per frame while hack mode is on. */
    step: function () {
      var r = this.runner;
      if (!this.enabled) return;

      // Keep a run going: start when idle, restart once the crash clears.
      if (!r.playing) {
        r.handleJumpStart();
        return;
      }

      var trex = r.trex;

      // The player always wins. While a key is held, stand down completely.
      if (r.manualControl) return;

      // Mid-air the arc is mostly committed, but the down key still works, and
      // it is the one move left: falling fast drops under a high pterodactyl
      // and lands sooner, which can buy back the frames needed to re-jump
      // before the next obstacle arrives.
      if (trex.jumping) {
        if (!trex.speedDrop && !this.recoverable(false) && this.recoverable(true)) {
          trex.setSpeedDrop();
        }
        return;
      }

      if (this.survives('run', 0)) {
        if (trex.ducking) trex.setDuck(false);
        return;
      }

      if (this.survives('duck', 0)) {
        if (!trex.ducking) trex.setDuck(true);
        return;
      }

      // Anything else has to be jumped, so stand up first.
      if (trex.ducking) trex.setDuck(false);

      // There is a window of frames in which starting a jump clears the
      // obstacle: jump before it and the T-Rex lands in front of the obstacle,
      // jump after it and it never gets off the ground. Waiting keeps the
      // options open, so hold on until only LATE_CUSHION frames of that window
      // are left. Every delay tested here already had to survive both obstacle
      // speeds, so the far edge is a measured limit rather than a guess.
      if (this.survives('jump', 0)) {
        if (this.slack() <= LATE_CUSHION) {
          this.jump();
        }
        return;
      }

      // No plan is provably safe. If the hit is about to land, jumping is
      // still a better bet than running into it.
      if (!this.survives('run', 0, 4)) {
        this.jump();
      }
    },

    jump: function () {
      var r = this.runner;
      r.sound.jump();
      r.trex.startJump(r.currentSpeed);
    }
  };

  global.Autopilot = Autopilot;
})(window);
