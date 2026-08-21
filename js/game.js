/*
 * game.js -- an offline-runner clone.
 *
 * Physics, speed curve, obstacle spacing, scoring and the night-mode cycle are
 * tuned to match the feel of the original browser offline game. All artwork
 * comes from sprites.js and is generated at runtime.
 */

(function (global) {
  'use strict';

  // ------------------------------------------------------------- Constants --

  var FPS = 60;
  var CANVAS_WIDTH = 600;
  var CANVAS_HEIGHT = 150;

  // Longest step a single frame may advance the world by: three frames' worth.
  var MAX_FRAME_TIME = 3 * (1000 / FPS);

  // The y coordinate the T-Rex's feet rest on.
  var GROUND_Y = 140;
  // Top of the horizon line.
  var HORIZON_Y = 138;
  // Where the line sits inside a horizon tile, leaving room for mounds above it.
  var LINE_TOP = 2;

  var CONFIG = {
    ACCELERATION: 0.001,
    BG_CLOUD_SPEED: 0.2,
    CLEAR_TIME: 3000,
    CLOUD_FREQUENCY: 0.5,
    GAMEOVER_CLEAR_TIME: 750,
    GAP_COEFFICIENT: 0.6,
    GRAVITY: 0.6,
    INVERT_FADE_DURATION: 12000,
    INVERT_DISTANCE: 700,
    MAX_CLOUDS: 6,
    MAX_OBSTACLE_LENGTH: 3,
    MAX_OBSTACLE_DUPLICATION: 2,
    MAX_SPEED: 13,
    SPEED: 6,
    SPEED_DROP_COEFFICIENT: 3
  };

  var KEYCODES = {
    JUMP: { ' ': 1, 'ArrowUp': 1, 'Enter': 1, 'w': 1, 'W': 1 },
    DUCK: { 'ArrowDown': 1, 's': 1, 'S': 1 }
  };

  // ------------------------------------------------------------- Utilities --

  function randomNum(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * A collision rectangle relative to an entity's top-left corner.
   * @constructor
   */
  function CollisionBox(x, y, w, h) {
    this.x = x;
    this.y = y;
    this.width = w;
    this.height = h;
  }

  function boxesIntersect(a, b) {
    return a.x < b.x + b.width &&
           a.x + a.width > b.x &&
           a.y < b.y + b.height &&
           a.y + a.height > b.y;
  }

  /** Translate a relative collision box into world space. */
  function toWorld(box, x, y) {
    return new CollisionBox(box.x + x, box.y + y, box.width, box.height);
  }

  // ----------------------------------------------------------------- Sound --

  /**
   * Tiny WebAudio blip synthesiser. No audio files, no network.
   * @constructor
   */
  function Sound() {
    this.ctx = null;
    this.muted = false;
  }

  Sound.prototype = {
    /** Lazily create the audio context -- browsers require a user gesture. */
    init: function () {
      if (this.ctx) return;
      var Ctor = global.AudioContext || global.webkitAudioContext;
      if (Ctor) {
        this.ctx = new Ctor();
      }
    },

    tone: function (freq, endFreq, duration, type, gain) {
      if (this.muted || !this.ctx) return;
      if (this.ctx.state === 'suspended') this.ctx.resume();

      var now = this.ctx.currentTime;
      var osc = this.ctx.createOscillator();
      var amp = this.ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      if (endFreq !== freq) {
        osc.frequency.exponentialRampToValueAtTime(endFreq, now + duration);
      }

      amp.gain.setValueAtTime(gain, now);
      amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      osc.connect(amp);
      amp.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + duration);
    },

    jump: function () {
      this.tone(520, 760, 0.08, 'square', 0.05);
    },

    achievement: function () {
      var self = this;
      this.tone(880, 880, 0.07, 'square', 0.05);
      setTimeout(function () { self.tone(1180, 1180, 0.09, 'square', 0.05); }, 90);
    },

    hit: function () {
      this.tone(320, 90, 0.28, 'sawtooth', 0.07);
    }
  };

  // ------------------------------------------------------------------ T-Rex --

  /**
   * The player character.
   * @constructor
   */
  function Trex(canvasCtx) {
    this.ctx = canvasCtx;

    this.config = {
      WIDTH: 44,
      HEIGHT: 48,
      WIDTH_DUCK: 60,
      HEIGHT_DUCK: 28,
      START_X_POS: 30,
      INITIAL_JUMP_VELOCITY: -10,
      DROP_VELOCITY: -5,
      // An absolute y ceiling; rising past it bleeds off upward velocity.
      MAX_JUMP_HEIGHT: 30,
      // Distance above the ground past which a jump can be cut short.
      MIN_JUMP_HEIGHT: 30
    };

    // Boxes below are measured off the sprite grids in sprites.js.
    this.collisionBoxes = {
      RUNNING: [
        new CollisionBox(24, 1, 19, 16),   // head and jaw
        new CollisionBox(17, 18, 18, 6),   // neck
        new CollisionBox(2, 21, 6, 6),     // tail
        new CollisionBox(6, 24, 30, 8),    // torso
        new CollisionBox(9, 32, 20, 4),    // hips
        new CollisionBox(9, 36, 19, 12)    // legs
      ],
      DUCKING: [
        new CollisionBox(42, 2, 16, 10),   // head
        new CollisionBox(4, 12, 44, 8),    // flattened body
        new CollisionBox(6, 20, 24, 7)     // legs
      ]
    };

    this.xPos = this.config.START_X_POS;
    this.groundYPos = GROUND_Y - this.config.HEIGHT;
    this.duckYPos = GROUND_Y - this.config.HEIGHT_DUCK;
    this.minJumpHeight = this.groundYPos - this.config.MIN_JUMP_HEIGHT;
    this.yPos = this.groundYPos;

    this.currentFrame = 0;
    this.msPerFrame = 1000 / 12;
    this.timer = 0;

    this.jumping = false;
    this.ducking = false;
    this.jumpVelocity = 0;
    this.reachedMinHeight = false;
    this.speedDrop = false;
    this.jumpCount = 0;
    this.crashed = false;

    this.blinkDelay = this.nextBlinkDelay();
    this.blinkTimer = 0;
    this.blinking = false;

    this.status = 'WAITING';
  }

  Trex.prototype = {
    nextBlinkDelay: function () {
      return Math.ceil(Math.random() * 5000) + 1500;
    },

    /** Reset to the start-of-run state. */
    reset: function () {
      this.yPos = this.groundYPos;
      this.jumpVelocity = 0;
      this.jumping = false;
      this.ducking = false;
      this.crashed = false;
      this.speedDrop = false;
      this.jumpCount = 0;
      this.currentFrame = 0;
      this.timer = 0;
      this.status = 'RUNNING';
    },

    setDuck: function (isDucking) {
      if (isDucking && !this.jumping) {
        this.ducking = true;
        this.status = 'DUCKING';
      } else if (!isDucking && this.ducking) {
        this.ducking = false;
        this.status = this.jumping ? 'JUMPING' : 'RUNNING';
      }
    },

    startJump: function (speed) {
      if (this.jumping || this.ducking) return;
      this.jumping = true;
      this.status = 'JUMPING';
      this.jumpVelocity = this.config.INITIAL_JUMP_VELOCITY - (speed / 10);
      this.reachedMinHeight = false;
      this.speedDrop = false;
    },

    /** Cut the jump short when the key is released early. */
    endJump: function () {
      if (this.reachedMinHeight && this.jumpVelocity < this.config.DROP_VELOCITY) {
        this.jumpVelocity = this.config.DROP_VELOCITY;
      }
    },

    /** Drop out of a jump quickly -- the down arrow while airborne. */
    setSpeedDrop: function () {
      this.speedDrop = true;
      this.jumpVelocity = 1;
    },

    updateJump: function (deltaTime) {
      var framesElapsed = deltaTime / (1000 / FPS);

      if (this.speedDrop) {
        this.yPos += Math.round(this.jumpVelocity * CONFIG.SPEED_DROP_COEFFICIENT * framesElapsed);
      } else {
        this.yPos += Math.round(this.jumpVelocity * framesElapsed);
      }

      this.jumpVelocity += CONFIG.GRAVITY * framesElapsed;

      if (this.yPos < this.minJumpHeight || this.speedDrop) {
        this.reachedMinHeight = true;
      }

      // Near the top of the canvas the climb bleeds off rather than stopping
      // dead, which is what gives the jump its floaty apex.
      if (this.yPos < this.config.MAX_JUMP_HEIGHT || this.speedDrop) {
        this.endJump();
      }

      if (this.yPos >= this.groundYPos) {
        this.yPos = this.groundYPos;
        this.jumping = false;
        this.jumpVelocity = 0;
        this.speedDrop = false;
        this.jumpCount++;
        this.status = this.ducking ? 'DUCKING' : 'RUNNING';
      }
    },

    update: function (deltaTime) {
      this.timer += deltaTime;

      if (this.status === 'WAITING') {
        this.blinkTimer += deltaTime;
        if (!this.blinking && this.blinkTimer >= this.blinkDelay) {
          this.blinking = true;
          this.blinkTimer = 0;
        } else if (this.blinking && this.blinkTimer >= 120) {
          this.blinking = false;
          this.blinkTimer = 0;
          this.blinkDelay = this.nextBlinkDelay();
        }
        return;
      }

      if (this.jumping) {
        this.updateJump(deltaTime);
      }

      var frameRate = this.ducking ? 1000 / 8 : this.msPerFrame;
      if (this.timer >= frameRate) {
        this.currentFrame = (this.currentFrame + 1) % 2;
        this.timer = 0;
      }
    },

    draw: function () {
      var sprites = global.Sprites.images;
      var image;
      var y = this.yPos;

      if (this.status === 'CRASHED') {
        image = sprites.trexCrashed;
      } else if (this.status === 'WAITING') {
        image = this.blinking ? sprites.trexCrashed : sprites.trexIdle;
      } else if (this.ducking) {
        image = this.currentFrame === 0 ? sprites.trexDuck1 : sprites.trexDuck2;
        y = this.duckYPos;
      } else if (this.jumping) {
        image = sprites.trexIdle;
      } else {
        image = this.currentFrame === 0 ? sprites.trexRun1 : sprites.trexRun2;
      }

      this.ctx.drawImage(image, Math.round(this.xPos), Math.round(y));
    },

    /**
     * Roll an arc forward from anywhere in a jump without touching live state,
     * using exactly the physics updateJump applies. Hack mode plans against
     * this, so the two can never drift apart.
     * @param {number} yPos starting height
     * @param {number} velocity starting vertical velocity
     * @param {boolean} speedDrop whether the down key is being held
     * @param {number} maxFrames
     * @return {!Array<number>} y position after each frame, ending on the ground
     */
    predictArc: function (yPos, velocity, speedDrop, maxFrames) {
      var y = yPos;
      var vel = velocity;
      var reachedMin = speedDrop;
      var arc = [];

      if (speedDrop) {
        vel = 1;
      }

      for (var f = 0; f < maxFrames; f++) {
        y += Math.round(speedDrop ? vel * CONFIG.SPEED_DROP_COEFFICIENT : vel);
        vel += CONFIG.GRAVITY;

        if (y < this.minJumpHeight) {
          reachedMin = true;
        }
        if ((y < this.config.MAX_JUMP_HEIGHT || speedDrop) &&
            reachedMin && vel < this.config.DROP_VELOCITY) {
          vel = this.config.DROP_VELOCITY;
        }
        if (y >= this.groundYPos) {
          arc.push(this.groundYPos);
          break;
        }
        arc.push(y);
      }
      return arc;
    },

    /**
     * The arc of a jump started from standing.
     * @param {number} speed
     * @param {number} maxFrames
     * @return {!Array<number>}
     */
    predictJump: function (speed, maxFrames) {
      return this.predictArc(this.groundYPos,
          this.config.INITIAL_JUMP_VELOCITY - (speed / 10), false, maxFrames);
    },

    /** @return {!Array<!CollisionBox>} world-space collision boxes. */
    getCollisionBoxes: function () {
      var boxes = this.ducking ? this.collisionBoxes.DUCKING : this.collisionBoxes.RUNNING;
      var y = this.ducking ? this.duckYPos : this.yPos;
      var self = this;
      return boxes.map(function (box) {
        return toWorld(box, self.xPos, y);
      });
    },

    /** @return {!CollisionBox} a cheap outer bound for early-out testing. */
    getBounds: function () {
      if (this.ducking) {
        return new CollisionBox(this.xPos, this.duckYPos,
            this.config.WIDTH_DUCK, this.config.HEIGHT_DUCK);
      }
      return new CollisionBox(this.xPos, this.yPos,
          this.config.WIDTH, this.config.HEIGHT);
    }
  };

  // ------------------------------------------------------------- Obstacles --

  var OBSTACLE_TYPES = [
    {
      type: 'CACTUS_SMALL',
      sprite: 'cactusSmall',
      width: 18,
      height: 34,
      yPos: GROUND_Y - 34,
      multipleSpeed: 4,
      minGap: 120,
      minSpeed: 0,
      collisionBoxes: [
        new CollisionBox(6, 0, 6, 34),    // trunk
        new CollisionBox(0, 8, 4, 10),    // left arm
        new CollisionBox(14, 12, 4, 10)   // right arm
      ]
    },
    {
      type: 'CACTUS_LARGE',
      sprite: 'cactusLarge',
      width: 26,
      height: 50,
      yPos: GROUND_Y - 50,
      multipleSpeed: 7,
      minGap: 120,
      minSpeed: 0,
      collisionBoxes: [
        new CollisionBox(10, 0, 8, 50),   // trunk
        new CollisionBox(2, 10, 4, 14),   // left arm
        new CollisionBox(20, 16, 4, 16)   // right arm
      ]
    },
    {
      type: 'PTERODACTYL',
      sprite: 'pterodactyl1',
      spriteAlt: 'pterodactyl2',
      width: 46,
      height: 40,
      // Low: must be jumped. Middle: duck or jump. High: safe unless you
      // panic-jump into it.
      yPos: [GROUND_Y - 42, GROUND_Y - 62, GROUND_Y - 94],
      multipleSpeed: 999,
      minSpeed: 8.5,
      minGap: 150,
      speedOffset: 0.8,
      numFrames: 2,
      frameRate: 1000 / 6,
      // Only the body and beak collide -- the wing sweeps between frames and
      // hitting one would feel arbitrary.
      collisionBoxes: [
        new CollisionBox(0, 22, 8, 5),    // beak
        new CollisionBox(4, 19, 22, 7)    // head and body
      ]
    }
  ];

  /**
   * A single obstacle, possibly a group of 2-3 identical cacti.
   * @constructor
   */
  function Obstacle(canvasCtx, typeConfig, gapCoefficient, speed) {
    this.ctx = canvasCtx;
    this.typeConfig = typeConfig;
    this.gapCoefficient = gapCoefficient;

    this.size = randomNum(1, CONFIG.MAX_OBSTACLE_LENGTH);
    // Groups only appear once the game is fast enough to make them fair.
    if (this.size > 1 && typeConfig.multipleSpeed > speed) {
      this.size = 1;
    }

    this.width = typeConfig.width * this.size;
    this.xPos = CANVAS_WIDTH;
    this.remove = false;

    if (Array.isArray(typeConfig.yPos)) {
      this.yPos = typeConfig.yPos[randomNum(0, typeConfig.yPos.length - 1)];
    } else {
      this.yPos = typeConfig.yPos;
    }

    this.currentFrame = 0;
    this.timer = 0;

    this.gap = this.getGap(gapCoefficient, speed);

    // Pterodactyls fly slightly faster or slower than the ground speed.
    this.speedOffset = 0;
    if (typeConfig.speedOffset) {
      this.speedOffset = Math.random() > 0.5 ?
          typeConfig.speedOffset : -typeConfig.speedOffset;
    }
  }

  Obstacle.prototype = {
    getGap: function (gapCoefficient, speed) {
      var minGap = Math.round(
          this.width * speed + this.typeConfig.minGap * gapCoefficient);
      return randomNum(minGap, Math.round(minGap * 1.5));
    },

    update: function (deltaTime, speed) {
      if (this.remove) return;

      if (this.typeConfig.speedOffset) {
        speed += this.speedOffset;
      }
      this.xPos -= Math.floor((speed * FPS / 1000) * deltaTime);

      if (this.typeConfig.numFrames) {
        this.timer += deltaTime;
        if (this.timer >= this.typeConfig.frameRate) {
          this.currentFrame = (this.currentFrame + 1) % this.typeConfig.numFrames;
          this.timer = 0;
        }
      }

      if (this.xPos + this.width < 0) {
        this.remove = true;
      }
    },

    draw: function () {
      var sprites = global.Sprites.images;
      var name = this.typeConfig.sprite;
      if (this.typeConfig.spriteAlt && this.currentFrame === 1) {
        name = this.typeConfig.spriteAlt;
      }
      var image = sprites[name];

      for (var i = 0; i < this.size; i++) {
        this.ctx.drawImage(image,
            Math.round(this.xPos + i * this.typeConfig.width),
            Math.round(this.yPos));
      }
    },

    getCollisionBoxes: function () {
      var boxes = [];
      for (var i = 0; i < this.size; i++) {
        var offsetX = this.xPos + i * this.typeConfig.width;
        for (var j = 0; j < this.typeConfig.collisionBoxes.length; j++) {
          boxes.push(toWorld(this.typeConfig.collisionBoxes[j], offsetX, this.yPos));
        }
      }
      return boxes;
    },

    getBounds: function () {
      return new CollisionBox(this.xPos, this.yPos, this.width, this.typeConfig.height);
    }
  };

  // ---------------------------------------------------------------- Clouds --

  /** @constructor */
  function Cloud(canvasCtx, containerWidth) {
    this.ctx = canvasCtx;
    this.width = 40;
    this.height = 16;
    this.xPos = containerWidth;
    this.yPos = randomNum(20, 70);
    this.remove = false;
    this.cloudGap = randomNum(100, 400);
  }

  Cloud.prototype = {
    update: function (speed) {
      if (this.remove) return;
      this.xPos -= Math.ceil(speed);
      if (this.xPos + this.width < 0) {
        this.remove = true;
      }
    },

    draw: function () {
      this.ctx.drawImage(global.Sprites.images.cloud,
          Math.round(this.xPos), Math.round(this.yPos));
    }
  };

  // ----------------------------------------------------------- Horizon line --

  /**
   * The scrolling ground. Two tiles are generated procedurally and recycled,
   * so the terrain never visibly repeats.
   * @constructor
   */
  function HorizonLine(canvasCtx) {
    this.ctx = canvasCtx;
    this.tileWidth = CANVAS_WIDTH;
    this.tileHeight = 14;

    this.tiles = [
      { canvas: this.makeTile(), xPos: 0 },
      { canvas: this.makeTile(), xPos: this.tileWidth }
    ];
  }

  HorizonLine.prototype = {
    /** Allocate a tile canvas. Only ever called twice, at start-up. */
    makeTile: function () {
      var canvas = document.createElement('canvas');
      canvas.width = this.tileWidth;
      canvas.height = this.tileHeight;
      this.paintTile(canvas);
      return canvas;
    },

    /**
     * Paint one tile: an unbroken ground line, a few low mounds sitting on it
     * and scattered pebbles below. The line itself never changes height, so
     * tiles butt together seamlessly in any order.
     *
     * Tiles are repainted in place rather than rebuilt, because a tile is
     * recycled roughly every three quarters of a second at full speed and a
     * run is meant to be able to carry on indefinitely.
     */
    paintTile: function (canvas) {
      var ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, this.tileWidth, this.tileHeight);
      ctx.fillStyle = '#535353';

      ctx.fillRect(0, LINE_TOP, this.tileWidth, 2);

      var x = randomNum(20, 120);
      while (x < this.tileWidth - 12) {
        var moundWidth = randomNum(3, 10);
        var moundHeight = Math.random() < 0.3 ? 2 : 1;
        ctx.fillRect(x, LINE_TOP - moundHeight, moundWidth, moundHeight);
        x += moundWidth + randomNum(30, 150);
      }

      var speckCount = randomNum(12, 22);
      for (var i = 0; i < speckCount; i++) {
        var sx = randomNum(0, this.tileWidth - 2);
        var sy = randomNum(LINE_TOP + 4, this.tileHeight - 2);
        ctx.fillRect(sx, sy, Math.random() < 0.35 ? 2 : 1, 1);
      }
    },

    update: function (deltaTime, speed) {
      var increment = Math.floor(speed * (FPS / 1000) * deltaTime);

      for (var i = 0; i < this.tiles.length; i++) {
        this.tiles[i].xPos -= increment;
      }

      // Recycle any tile that has scrolled fully off the left edge.
      for (var j = 0; j < this.tiles.length; j++) {
        if (this.tiles[j].xPos + this.tileWidth <= 0) {
          var other = this.tiles[(j + 1) % this.tiles.length];
          this.tiles[j].xPos = other.xPos + this.tileWidth;
          this.paintTile(this.tiles[j].canvas);
        }
      }
    },

    draw: function () {
      for (var i = 0; i < this.tiles.length; i++) {
        this.ctx.drawImage(this.tiles[i].canvas,
            Math.round(this.tiles[i].xPos), HORIZON_Y - LINE_TOP);
      }
    },

    reset: function () {
      this.tiles[0].xPos = 0;
      this.tiles[1].xPos = this.tileWidth;
    }
  };

  // --------------------------------------------------------------- Horizon --

  /**
   * Owns the scenery and the obstacle queue.
   * @constructor
   */
  function Horizon(canvasCtx, gapCoefficient) {
    this.ctx = canvasCtx;
    this.gapCoefficient = gapCoefficient;
    this.obstacles = [];
    this.obstacleHistory = [];
    this.clouds = [];
    this.cloudFrequency = CONFIG.CLOUD_FREQUENCY;
    this.horizonLine = new HorizonLine(canvasCtx);
    // Seed the sky so the first few seconds are not empty.
    for (var i = 0; i < 3; i++) {
      this.addCloud();
      this.clouds[i].xPos = randomNum(0, CANVAS_WIDTH);
    }
  }

  Horizon.prototype = {
    update: function (deltaTime, currentSpeed, updateObstacles) {
      this.horizonLine.update(deltaTime, currentSpeed);
      this.updateClouds(deltaTime, currentSpeed);
      if (updateObstacles) {
        this.updateObstacles(deltaTime, currentSpeed);
      }
    },

    draw: function () {
      // Clouds sit behind everything else.
      for (var i = 0; i < this.clouds.length; i++) {
        this.clouds[i].draw();
      }
      this.horizonLine.draw();
      for (var j = 0; j < this.obstacles.length; j++) {
        this.obstacles[j].draw();
      }
    },

    updateClouds: function (deltaTime, speed) {
      var cloudSpeed = CONFIG.BG_CLOUD_SPEED / 1000 * deltaTime * speed;
      var numClouds = this.clouds.length;

      if (numClouds) {
        for (var i = numClouds - 1; i >= 0; i--) {
          this.clouds[i].update(cloudSpeed);
        }

        var last = this.clouds[numClouds - 1];
        if (numClouds < CONFIG.MAX_CLOUDS &&
            (CANVAS_WIDTH - last.xPos) > last.cloudGap &&
            this.cloudFrequency > Math.random()) {
          this.addCloud();
        }

        this.clouds = this.clouds.filter(function (cloud) {
          return !cloud.remove;
        });
      } else {
        this.addCloud();
      }
    },

    addCloud: function () {
      this.clouds.push(new Cloud(this.ctx, CANVAS_WIDTH));
    },

    updateObstacles: function (deltaTime, currentSpeed) {
      for (var i = 0; i < this.obstacles.length; i++) {
        this.obstacles[i].update(deltaTime, currentSpeed);
      }
      this.obstacles = this.obstacles.filter(function (obstacle) {
        return !obstacle.remove;
      });

      if (this.obstacles.length) {
        var last = this.obstacles[this.obstacles.length - 1];
        if (last && !last.followingObstacleCreated &&
            last.xPos + last.width + last.gap < CANVAS_WIDTH) {
          this.addNewObstacle(currentSpeed);
          last.followingObstacleCreated = true;
        }
      } else {
        this.addNewObstacle(currentSpeed);
      }
    },

    addNewObstacle: function (currentSpeed) {
      var typeIndex = randomNum(0, OBSTACLE_TYPES.length - 1);
      var typeConfig = OBSTACLE_TYPES[typeIndex];

      // Skip obstacles that are too fast for the current speed, or that would
      // repeat the same type too many times in a row.
      if (currentSpeed < typeConfig.minSpeed || this.duplicateObstacle(typeConfig.type)) {
        this.addNewObstacle(currentSpeed);
        return;
      }

      this.obstacles.push(
          new Obstacle(this.ctx, typeConfig, this.gapCoefficient, currentSpeed));

      this.obstacleHistory.unshift(typeConfig.type);
      if (this.obstacleHistory.length > 1) {
        this.obstacleHistory.splice(CONFIG.MAX_OBSTACLE_DUPLICATION);
      }
    },

    duplicateObstacle: function (type) {
      if (this.obstacleHistory.length < CONFIG.MAX_OBSTACLE_DUPLICATION) {
        return false;
      }
      for (var i = 0; i < CONFIG.MAX_OBSTACLE_DUPLICATION; i++) {
        if (this.obstacleHistory[i] !== type) {
          return false;
        }
      }
      return true;
    },

    reset: function () {
      this.obstacles = [];
      this.obstacleHistory = [];
      this.horizonLine.reset();
    }
  };

  // --------------------------------------------------------- Distance meter --

  /**
   * The score readout, including the high-score display and the flash that
   * fires every 100 points.
   * @constructor
   */
  function DistanceMeter(canvasCtx, canvasWidth) {
    this.ctx = canvasCtx;
    this.achievementDistance = 100;
    this.coefficient = 0.025;
    this.flashDuration = 1000 / 4;
    this.flashIterations = 6;

    this.currentDistance = 0;
    this.highScore = 0;

    this.flashingTimer = 0;
    this.flashIterationsLeft = 0;
    this.invertFlash = false;

    this.y = 10;
    this.minDigits = 5;
    // Both readouts are right-aligned to this edge, so a score that outgrows
    // five digits -- which a long hack-mode run will -- just extends leftwards
    // instead of being clipped.
    this.rightEdge = canvasWidth - 12;
  }

  DistanceMeter.prototype = {
    getActualDistance: function (distance) {
      return distance ? Math.round(distance * this.coefficient) : 0;
    },

    /**
     * @return {boolean} true when a 100-point milestone was just crossed.
     */
    update: function (deltaTime, distance) {
      var milestone = false;
      var value = this.getActualDistance(distance);

      if (this.flashIterationsLeft <= 0) {
        if (value > 0 && value % this.achievementDistance === 0 &&
            value !== this.currentDistance) {
          this.flashIterationsLeft = this.flashIterations;
          this.flashingTimer = 0;
          milestone = true;
        }
        this.currentDistance = value;
      } else {
        this.flashingTimer += deltaTime;
        if (this.flashingTimer >= this.flashDuration) {
          this.flashingTimer = 0;
          this.invertFlash = !this.invertFlash;
          this.flashIterationsLeft--;
          if (this.flashIterationsLeft <= 0) {
            this.invertFlash = false;
            this.currentDistance = value;
          }
        }
      }

      return milestone;
    },

    pad: function (value) {
      var str = String(value);
      while (str.length < this.minDigits) {
        str = '0' + str;
      }
      return str;
    },

    draw: function () {
      var score = this.pad(this.currentDistance);
      var scoreX = this.rightEdge - global.Sprites.measureText(score);

      // The score blinks off on alternate flash frames.
      if (!(this.flashIterationsLeft > 0 && this.invertFlash)) {
        global.Sprites.drawText(this.ctx, score, scoreX, this.y);
      }

      if (this.highScore > 0) {
        var hi = this.pad(this.highScore);
        var hiX = scoreX - 22 - global.Sprites.measureText(hi);
        var labelX = hiX - 12 - global.Sprites.measureText('HI');

        this.ctx.save();
        this.ctx.globalAlpha = 0.5;
        global.Sprites.drawText(this.ctx, 'HI', labelX, this.y);
        global.Sprites.drawText(this.ctx, hi, hiX, this.y);
        this.ctx.restore();
      }
    },

    setHighScore: function (distance) {
      this.highScore = this.getActualDistance(distance);
    },

    reset: function () {
      this.currentDistance = 0;
      this.flashIterationsLeft = 0;
      this.flashingTimer = 0;
      this.invertFlash = false;
    }
  };

  // -------------------------------------------------------- Game over panel --

  /** @constructor */
  function GameOverPanel(canvasCtx) {
    this.ctx = canvasCtx;
    this.textY = 40;
    this.buttonSize = 32;
    this.buttonY = 72;
  }

  GameOverPanel.prototype = {
    draw: function () {
      var text = 'GAME OVER';
      var spacing = 6;
      var width = global.Sprites.measureText(text, spacing);
      global.Sprites.drawText(this.ctx, text,
          Math.round((CANVAS_WIDTH - width) / 2), this.textY, spacing);
      this.drawRestartButton();
    },

    /** The circular-arrow restart icon, drawn from the same pixel grid as
     *  everything else rather than as a smooth arc. */
    drawRestartButton: function () {
      var icon = global.Sprites.images.restart;
      this.ctx.drawImage(icon,
          Math.round((CANVAS_WIDTH - icon.width) / 2),
          this.buttonY);
    }
  };

  // ---------------------------------------------------------------- Runner --

  /**
   * The game itself.
   * @constructor
   */
  function Runner(containerSelector) {
    this.container = document.querySelector(containerSelector);
    this.canvas = this.container.querySelector('canvas');
    this.ctx = this.canvas.getContext('2d');

    this.dimensions = { WIDTH: CANVAS_WIDTH, HEIGHT: CANVAS_HEIGHT };

    this.currentSpeed = CONFIG.SPEED;
    this.distanceRan = 0;
    this.highestScore = 0;
    this.runningTime = 0;
    this.msPerFrame = 1000 / FPS;
    this.time = 0;
    this.rafId = null;

    this.playing = false;
    this.crashed = false;

    this.inverted = false;
    this.invertTimer = 0;

    // True while the player is holding a jump or duck input. Hack mode stands
    // down entirely for as long as this is set.
    this.manualControl = false;
    this.heldJump = false;
    this.heldDuck = false;

    this.sound = new Sound();
    this.storageKey = 'offline-runner.highScore';
    this.modeKey = 'offline-runner.mode';

    this.setupCanvas();

    global.Sprites.build('#535353');

    this.trex = new Trex(this.ctx);
    this.horizon = new Horizon(this.ctx, CONFIG.GAP_COEFFICIENT);
    this.distanceMeter = new DistanceMeter(this.ctx, this.dimensions.WIDTH);
    this.gameOverPanel = new GameOverPanel(this.ctx);
    this.autopilot = new global.Autopilot(this);

    this.loadHighScore();
    this.bindEvents();
    this.bindSettings();
    this.play();
  }

  Runner.prototype = {
    /** Size the backing store for the display's pixel density. */
    /**
     * Match the backing store to however large the stylesheet is showing the
     * canvas, then stretch a fixed 600x150 drawing space over it.
     *
     * Everything else in the game -- physics, collision boxes, obstacle
     * positions -- works in that fixed space and never learns the window size,
     * so filling a 4K screen plays exactly like a phone.
     */
    setupCanvas: function () {
      var dpr = global.devicePixelRatio || 1;
      var rect = this.canvas.getBoundingClientRect();
      var width = Math.max(1, Math.round(rect.width * dpr));
      var height = Math.max(1, Math.round(rect.height * dpr));

      // Assigning width or height wipes the context, so only do it on a real
      // change and always restore the transform afterwards.
      if (this.canvas.width !== width || this.canvas.height !== height) {
        this.canvas.width = width;
        this.canvas.height = height;
      }

      this.ctx.setTransform(width / this.dimensions.WIDTH, 0,
                            0, height / this.dimensions.HEIGHT, 0, 0);
      // Nearest-neighbour, so scaling up keeps the pixels square and hard
      // edged instead of smearing them.
      this.ctx.imageSmoothingEnabled = false;
    },

    /** Re-fit after the window changes size or the device rotates. */
    handleResize: function () {
      var self = this;
      if (this.resizeTimer) global.clearTimeout(this.resizeTimer);
      this.resizeTimer = global.setTimeout(function () {
        self.resizeTimer = null;
        self.setupCanvas();
        self.draw();
      }, 80);
    },

    loadHighScore: function () {
      try {
        var stored = global.localStorage.getItem(this.storageKey);
        if (stored) {
          this.highestScore = parseFloat(stored) || 0;
          this.distanceMeter.setHighScore(this.highestScore);
        }
      } catch (e) {
        // Private browsing or blocked storage -- run without a saved score.
      }
    },

    saveHighScore: function () {
      try {
        global.localStorage.setItem(this.storageKey, String(this.highestScore));
      } catch (e) {
        // Ignore.
      }
    },

    // -------------------------------------------------------------- Input --

    bindEvents: function () {
      var self = this;

      document.addEventListener('keydown', function (e) { self.onKeyDown(e); });
      document.addEventListener('keyup', function (e) { self.onKeyUp(e); });

      this.canvas.addEventListener('pointerdown', function (e) { self.onPointerDown(e); });
      this.canvas.addEventListener('pointerup', function (e) { self.onPointerUp(e); });
      this.canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });

      global.addEventListener('resize', function () { self.handleResize(); });
      global.addEventListener('orientationchange', function () { self.handleResize(); });

      document.addEventListener('visibilitychange', function () {
        if (document.hidden) {
          self.stop();
        } else if (!self.crashed) {
          // Resume whether a run is in progress or the T-Rex is idling.
          self.play();
        }
      });
    },

    // ----------------------------------------------------------- Settings --

    bindSettings: function () {
      var self = this;

      this.settings = this.container.querySelector('.settings');
      if (!this.settings) return;

      this.settingsToggle = this.settings.querySelector('.settings__toggle');
      this.settingsPanel = this.settings.querySelector('.settings__panel');
      this.settingsBadge = this.settings.querySelector('.settings__badge');
      this.modeInputs = this.settings.querySelectorAll('input[name="mode"]');

      this.settingsToggle.addEventListener('click', function () {
        self.openSettings(self.settingsPanel.hidden);
      });

      for (var i = 0; i < this.modeInputs.length; i++) {
        this.modeInputs[i].addEventListener('change', function () {
          if (!this.checked) return;
          self.setMode(this.value);
          // Close and hand focus back, otherwise the radio keeps it and eats
          // the spacebar the player expects to jump with.
          self.openSettings(false);
          this.blur();
        });
      }

      // A click anywhere else closes the panel.
      document.addEventListener('pointerdown', function (e) {
        if (!self.settings.contains(e.target)) self.openSettings(false);
      }, true);

      var saved = 'normal';
      try {
        saved = global.localStorage.getItem(this.modeKey) || 'normal';
      } catch (e) {
        // Storage unavailable -- start in normal mode.
      }
      this.setMode(saved === 'hack' ? 'hack' : 'normal');
    },

    openSettings: function (open) {
      if (!this.settingsPanel) return;
      this.settingsPanel.hidden = !open;
      this.settingsToggle.setAttribute('aria-expanded', String(open));
    },

    /**
     * @param {string} mode 'normal' or 'hack'
     */
    setMode: function (mode) {
      var hack = mode === 'hack';
      this.mode = hack ? 'hack' : 'normal';
      this.autopilot.enabled = hack;

      for (var i = 0; i < this.modeInputs.length; i++) {
        this.modeInputs[i].checked = this.modeInputs[i].value === this.mode;
      }
      if (this.settingsBadge) this.settingsBadge.hidden = !hack;
      this.container.classList.toggle('hacking', hack);

      try {
        global.localStorage.setItem(this.modeKey, this.mode);
      } catch (e) {
        // Ignore.
      }

      // Turning hack mode on from a crash screen should pick the game back up.
      if (hack && this.crashed) {
        this.scheduleAutoRestart();
      }
    },

    /** In hack mode a crash is only ever a pause. */
    scheduleAutoRestart: function () {
      var self = this;
      if (this.autoRestartTimer) global.clearTimeout(this.autoRestartTimer);
      this.autoRestartTimer = global.setTimeout(function () {
        self.autoRestartTimer = null;
        if (self.autopilot.enabled && self.crashed) self.restart();
      }, CONFIG.GAMEOVER_CLEAR_TIME + 250);
    },

    onKeyDown: function (e) {
      if (e.repeat) return;
      // While the panel is open its own controls own the keyboard.
      if (this.settingsPanel && !this.settingsPanel.hidden &&
          this.settings.contains(e.target)) {
        if (e.key === 'Escape') this.openSettings(false);
        return;
      }
      this.sound.init();

      if (KEYCODES.JUMP[e.key]) {
        e.preventDefault();
        this.heldJump = true;
        this.manualControl = true;
        this.handleJumpStart();
      } else if (KEYCODES.DUCK[e.key]) {
        e.preventDefault();
        this.heldDuck = true;
        this.manualControl = true;
        this.handleDuckStart();
      } else if (e.key === 'm' || e.key === 'M') {
        this.sound.muted = !this.sound.muted;
        this.setStateClass('muted', this.sound.muted);
      } else if (e.key === 'Escape') {
        this.openSettings(false);
      }
    },

    onKeyUp: function (e) {
      if (KEYCODES.JUMP[e.key]) {
        this.heldJump = false;
        this.handleJumpEnd();
      } else if (KEYCODES.DUCK[e.key]) {
        this.heldDuck = false;
        this.handleDuckEnd();
      }
      this.manualControl = this.heldJump || this.heldDuck;
    },

    onPointerDown: function (e) {
      e.preventDefault();
      this.sound.init();

      var rect = this.canvas.getBoundingClientRect();
      var y = (e.clientY - rect.top) * (this.dimensions.HEIGHT / rect.height);

      this.openSettings(false);
      this.manualControl = true;

      if (this.crashed) {
        this.handleJumpStart();
        return;
      }

      // Touching the lower quarter of the canvas ducks instead of jumping.
      if (this.playing && y > this.dimensions.HEIGHT * 0.72) {
        this.heldDuck = true;
        this.handleDuckStart();
      } else {
        this.heldJump = true;
        this.handleJumpStart();
      }
    },

    onPointerUp: function () {
      this.heldJump = false;
      this.heldDuck = false;
      this.manualControl = false;
      this.handleJumpEnd();
      this.handleDuckEnd();
    },

    handleJumpStart: function () {
      if (this.crashed) {
        // A short delay so you cannot restart by accident on the crash frame.
        if (global.performance.now() - this.crashTime >= CONFIG.GAMEOVER_CLEAR_TIME) {
          this.restart();
        }
        return;
      }

      if (!this.playing) {
        this.startGame();
      }

      if (!this.trex.jumping && !this.trex.ducking) {
        this.sound.jump();
        this.trex.startJump(this.currentSpeed);
      }
    },

    handleJumpEnd: function () {
      if (this.playing && this.trex.jumping) {
        this.trex.endJump();
      }
    },

    handleDuckStart: function () {
      if (!this.playing || this.crashed) return;

      if (this.trex.jumping) {
        this.trex.setSpeedDrop();
      } else {
        this.trex.setDuck(true);
      }
    },

    handleDuckEnd: function () {
      if (this.trex.ducking) {
        this.trex.setDuck(false);
      }
      this.trex.speedDrop = false;
    },

    // ------------------------------------------------------- Game control --

    startGame: function () {
      this.playing = true;
      this.crashed = false;
      this.runningTime = 0;
      this.trex.reset();
      this.setStateClass('playing', true);
      this.play();
    },

    restart: function () {
      this.runningTime = 0;
      this.playing = true;
      this.crashed = false;
      this.distanceRan = 0;
      this.currentSpeed = CONFIG.SPEED;
      this.invertTimer = 0;
      this.setInverted(false);
      this.distanceMeter.reset();
      this.horizon.reset();
      this.trex.reset();
      this.setStateClass('playing', true);
      this.play();
    },

    play: function () {
      if (this.crashed) return;
      this.stop();
      this.time = global.performance.now();
      this.scheduleNextUpdate();
    },

    stop: function () {
      if (this.rafId) {
        global.cancelAnimationFrame(this.rafId);
        this.rafId = null;
      }
    },

    scheduleNextUpdate: function () {
      // Idempotent on purpose. update() can reach play() indirectly -- hack
      // mode starting a run is the usual way -- and without this guard that
      // path leaves two request-animation-frame loops running against one
      // shared clock, halving every deltaTime and breaking jump physics.
      if (this.rafId !== null) return;

      var self = this;
      this.rafId = global.requestAnimationFrame(function (now) {
        self.rafId = null;
        self.update(now);
      });
    },

    gameOver: function () {
      this.sound.hit();
      this.stop();
      this.crashed = true;
      this.playing = false;
      this.crashTime = global.performance.now();
      this.trex.status = 'CRASHED';
      this.trex.crashed = true;
      this.setStateClass('playing', false);

      if (this.distanceRan > this.highestScore) {
        this.highestScore = Math.ceil(this.distanceRan);
        this.distanceMeter.setHighScore(this.highestScore);
        this.saveHighScore();
      }

      this.draw();

      if (this.autopilot.enabled) {
        this.scheduleAutoRestart();
      }
    },

    // -------------------------------------------------------------- Frame --

    update: function (now) {
      // Clamp the step so a stalled frame cannot teleport the world forward.
      // At 100ms an obstacle moves most of a T-Rex width in a single tick,
      // which is unreactable for a player and unplannable for hack mode; three
      // frames' worth means a hitch briefly slows the game instead.
      var deltaTime = Math.min(now - this.time, MAX_FRAME_TIME);
      this.time = now;

      // Decide before the world moves, exactly where a keypress would land.
      this.autopilot.step();

      if (this.playing) {
        this.runningTime += deltaTime;
        var hasObstacles = this.runningTime > CONFIG.CLEAR_TIME;

        this.trex.update(deltaTime);
        this.horizon.update(deltaTime, this.currentSpeed, hasObstacles);

        if (hasObstacles && this.checkCollision()) {
          this.gameOver();
          return;
        }

        this.distanceRan += this.currentSpeed * deltaTime / this.msPerFrame;

        if (this.currentSpeed < CONFIG.MAX_SPEED) {
          this.currentSpeed += CONFIG.ACCELERATION;
        }

        if (this.distanceMeter.update(deltaTime, Math.ceil(this.distanceRan))) {
          this.sound.achievement();
        }

        this.updateInvert(deltaTime);
      } else {
        this.trex.update(deltaTime);
        this.horizon.update(deltaTime, 0, false);
      }

      this.draw();
      this.scheduleNextUpdate();
    },

    /** Flip to night mode every INVERT_DISTANCE points for a fixed spell. */
    updateInvert: function (deltaTime) {
      if (this.invertTimer > CONFIG.INVERT_FADE_DURATION) {
        this.invertTimer = 0;
        this.setInverted(false);
      } else if (this.invertTimer) {
        this.invertTimer += deltaTime;
      } else {
        var actualDistance =
            this.distanceMeter.getActualDistance(Math.ceil(this.distanceRan));
        if (actualDistance > 0 && actualDistance % CONFIG.INVERT_DISTANCE === 0) {
          this.invertTimer += deltaTime;
          this.setInverted(true);
        }
      }
    },

    /**
     * Mirror a state class onto the page as well as the canvas wrapper. The
     * settings and the hint sit outside the canvas now, and at night the page
     * itself has to darken with it or the game ends up in a lit border.
     */
    setStateClass: function (name, on) {
      this.container.classList.toggle(name, on);
      document.body.classList.toggle(name, on);
    },

    setInverted: function (inverted) {
      if (this.inverted === inverted) return;
      this.inverted = inverted;
      this.setStateClass('inverted', inverted);
    },

    checkCollision: function () {
      var obstacles = this.horizon.obstacles;
      if (!obstacles.length) return false;

      var trexBounds = this.trex.getBounds();

      for (var i = 0; i < obstacles.length; i++) {
        var obstacle = obstacles[i];
        // Cheap rejection before testing the detailed boxes.
        if (!boxesIntersect(trexBounds, obstacle.getBounds())) continue;

        var trexBoxes = this.trex.getCollisionBoxes();
        var obstacleBoxes = obstacle.getCollisionBoxes();

        for (var t = 0; t < trexBoxes.length; t++) {
          for (var o = 0; o < obstacleBoxes.length; o++) {
            if (boxesIntersect(trexBoxes[t], obstacleBoxes[o])) {
              return true;
            }
          }
        }
      }
      return false;
    },

    draw: function () {
      this.ctx.clearRect(0, 0, this.dimensions.WIDTH, this.dimensions.HEIGHT);
      this.horizon.draw();
      this.trex.draw();
      this.distanceMeter.draw();
      if (this.crashed) {
        this.gameOverPanel.draw();
      }
    }
  };

  global.Runner = Runner;

  document.addEventListener('DOMContentLoaded', function () {
    global.game = new Runner('.runner-container');
  });
})(window);
