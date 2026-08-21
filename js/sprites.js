/*
 * sprites.js
 *
 * All artwork for the game is drawn here as pixel grids and rasterised onto
 * offscreen canvases at start-up. Nothing is loaded from the network and no
 * third-party image assets are used -- every sprite below is hand-authored
 * pixel art.
 *
 * Grid legend:
 *   '#'  solid pixel
 *   'o'  hole (left transparent -- used for eyes / mouths)
 *   '.'  empty
 */

(function (global) {
  'use strict';

  var SCALE = 2; // one grid cell === SCALE x SCALE device-independent pixels

  // ---------------------------------------------------------------- T-Rex --

  // Shared upper body: head, jaw, neck, tail, torso and forelimb.
  var TREX_TOP = [
    '............#########.',
    '...........###########',
    '...........######oo###',
    '...........######oo###',
    '...........###########',
    '...........###########',
    '...........###########',
    '...........###########',
    '...........#####...###',
    '.........#########....',
    '.#......##########....',
    '.##....###########....',
    '.###.#############....',
    '.#################....',
    '..##################..',
    '...##############.##..',
    '....###########...#...',
    '.....#########........'
  ];

  var TREX_LEGS_IDLE = [
    '.....####.####........',
    '.....###..###.........',
    '.....###..###.........',
    '.....##...###.........',
    '.....##...###.........',
    '...#####..#####.......'
  ];

  var TREX_LEGS_RUN_1 = [
    '.....####.####........',
    '.....###..###.........',
    '.....###..###.........',
    '.....###..###.........',
    '...#####..##..........',
    '..######..............'
  ];

  var TREX_LEGS_RUN_2 = [
    '.....####.####........',
    '.....###..###.........',
    '.....###..###.........',
    '......##..###.........',
    '......##..#####.......',
    '..........######......'
  ];

  // Ducking: the whole animal flattens out and stretches forwards.
  var TREX_DUCK_TOP = [
    '......................#######.',
    '.....................#########',
    '.....................#########',
    '.....................#####oo##',
    '.....................#########',
    '...................######...##',
    '..#######################.....',
    '.#######################......',
    '..####################........',
    '...################...........'
  ];

  var TREX_DUCK_LEGS_1 = [
    '....##########................',
    '....###...####................',
    '....###....###................',
    '..#####....###................'
  ];

  var TREX_DUCK_LEGS_2 = [
    '....##########................',
    '....###...####................',
    '.....##....###................',
    '.....##....#####..............'
  ];

  // -------------------------------------------------------------- Obstacles --

  var CACTUS_SMALL = [
    '...###...',
    '...###...',
    '...###...',
    '...###...',
    '##.###...',
    '##.###...',
    '##.###.##',
    '######.##',
    '######.##',
    '...######',
    '...######',
    '...###...',
    '...###...',
    '...###...',
    '...###...',
    '...###...',
    '...###...'
  ];

  var CACTUS_LARGE = [
    '.....####....',
    '.....####....',
    '.....####....',
    '.....####....',
    '.....####....',
    '.##..####....',
    '.##..####....',
    '.##..####....',
    '.##..####.##.',
    '.##..####.##.',
    '.########.##.',
    '.########.##.',
    '.....####.##.',
    '.....####.##.',
    '.....########',
    '.....########',
    '.....####....',
    '.....####....',
    '.....####....',
    '.....####....',
    '.....####....',
    '.....####....',
    '.....####....',
    '.....####....',
    '.....####....'
  ];

  // Facing left, into its direction of travel: beak and open mouth on the
  // left, body across the middle, and one swept wing that alternates up and
  // down. The body occupies the same rows in both frames, which is what lets a
  // single set of collision boxes stay correct across the flap.
  var PTERODACTYL_1 = [
    '...............######..',
    '..............######...',
    '.............######....',
    '............######.....',
    '...........######......',
    '..........######.......',
    '.........######........',
    '........######.........',
    '.......######..........',
    '..#########............',
    '############...........',
    '############...........',
    '###...#######..........',
    '.........########......',
    '..............######...',
    '..................###..',
    '.......................',
    '.......................',
    '.......................',
    '.......................'
  ];

  var PTERODACTYL_2 = [
    '.......................',
    '.......................',
    '.......................',
    '.......................',
    '.......................',
    '.......................',
    '.......................',
    '.......................',
    '.......................',
    '..#########............',
    '############...........',
    '############...........',
    '###...#######..........',
    '.......#######.........',
    '........######.........',
    '.........######........',
    '..........######.......',
    '...........######......',
    '............######.....',
    '.............######....'
  ];

  // ---------------------------------------------------------------- Scenery --

  var CLOUD = [
    '......#####.........',
    '....#########.......',
    '...###########......',
    '..#############.....',
    '.################...',
    '.#################..',
    '..###############...',
    '....###########.....'
  ];

  // ------------------------------------------------------------------- Font --

  // 5x7 pixel font. Only the glyphs the game actually renders are defined.
  var FONT = {
    '0': ['#####', '#...#', '#...#', '#...#', '#...#', '#...#', '#####'],
    '1': ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '#####'],
    '2': ['#####', '....#', '....#', '#####', '#....', '#....', '#####'],
    '3': ['#####', '....#', '....#', '#####', '....#', '....#', '#####'],
    '4': ['#...#', '#...#', '#...#', '#####', '....#', '....#', '....#'],
    '5': ['#####', '#....', '#....', '#####', '....#', '....#', '#####'],
    '6': ['#####', '#....', '#....', '#####', '#...#', '#...#', '#####'],
    '7': ['#####', '....#', '....#', '...#.', '..#..', '..#..', '..#..'],
    '8': ['#####', '#...#', '#...#', '#####', '#...#', '#...#', '#####'],
    '9': ['#####', '#...#', '#...#', '#####', '....#', '....#', '#####'],
    'A': ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
    'C': ['.####', '#....', '#....', '#....', '#....', '#....', '.####'],
    'E': ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
    'G': ['.####', '#....', '#....', '#.###', '#...#', '#...#', '.###.'],
    'H': ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
    'I': ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '#####'],
    'M': ['#...#', '##.##', '#.#.#', '#...#', '#...#', '#...#', '#...#'],
    'O': ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
    'P': ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
    'R': ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
    'S': ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
    'T': ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
    'V': ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
    ' ': ['.....', '.....', '.....', '.....', '.....', '.....', '.....']
  };

  // ---------------------------------------------------------------- Restart --

  /**
   * The restart button: a ring with a bite taken out of the top right and an
   * arrow head on the loose end. Generated rather than hand-drawn so the ring
   * stays perfectly symmetrical, but still built one whole cell at a time so
   * it matches the rest of the artwork instead of being a smooth arc.
   * @param {number} size grid cells across
   * @return {!Array<string>}
   */
  function buildRestartGrid(size) {
    var centre = (size - 1) / 2;
    var outer = size / 2 - 0.6;
    var inner = outer - 2.6;

    // The ring is open from just past the top round to three o'clock. Angles
    // run clockwise from due right, so -PI/2 is straight up.
    var gapFrom = -Math.PI * 0.46;
    var gapTo = -Math.PI * 0.17;

    var cells = [];
    var x, y;
    for (y = 0; y < size; y++) {
      cells.push([]);
      for (x = 0; x < size; x++) {
        var dx = x - centre;
        var dy = y - centre;
        var dist = Math.sqrt(dx * dx + dy * dy);
        var angle = Math.atan2(dy, dx);
        var onRing = dist <= outer && dist >= inner;
        var inGap = angle >= gapFrom && angle <= gapTo;
        cells[y].push(onRing && !inGap);
      }
    }

    // Arrow head: a solid triangle capping the open end of the ring, its base
    // across the ring's width and its point leading the way the ring turns.
    var mid = (outer + inner) / 2;
    var baseX = centre + Math.cos(gapFrom) * mid;
    var baseY = centre + Math.sin(gapFrom) * mid;
    var half = (outer - inner) / 2 + 0.6;
    var reach = 4.4;

    for (y = 0; y < size; y++) {
      for (x = 0; x < size; x++) {
        var ax = x - baseX;
        var ay = y - baseY;
        if (ax >= -0.7 && ax <= reach &&
            Math.abs(ay) <= half * (1 - ax / reach) + 0.4) {
          cells[y][x] = true;
        }
      }
    }

    var grid = [];
    for (y = 0; y < size; y++) {
      var row = '';
      for (x = 0; x < size; x++) {
        row += cells[y][x] ? '#' : '.';
      }
      grid.push(row);
    }
    return grid;
  }

  // ------------------------------------------------------------- Rasterising --

  /**
   * Turn a pixel grid into an offscreen canvas.
   * @param {!Array<string>} grid
   * @param {number} scale
   * @param {string} colour
   * @return {!HTMLCanvasElement}
   */
  function rasterise(grid, scale, colour) {
    var cols = grid[0].length;
    var rows = grid.length;
    var canvas = document.createElement('canvas');
    canvas.width = cols * scale;
    canvas.height = rows * scale;

    var ctx = canvas.getContext('2d');
    ctx.fillStyle = colour;

    for (var y = 0; y < rows; y++) {
      var row = grid[y];
      var runStart = -1;
      // Batch horizontal runs of solid pixels into single fillRect calls.
      for (var x = 0; x <= cols; x++) {
        var solid = x < cols && row.charAt(x) === '#';
        if (solid && runStart === -1) {
          runStart = x;
        } else if (!solid && runStart !== -1) {
          ctx.fillRect(runStart * scale, y * scale, (x - runStart) * scale, scale);
          runStart = -1;
        }
      }
    }
    return canvas;
  }

  /** Stack a shared upper body on top of a set of legs. */
  function join(top, legs) {
    return top.concat(legs);
  }

  /** Swap the eye hole for a solid pixel -- used for the crashed T-Rex. */
  function closeEye(grid) {
    return grid.map(function (row) {
      return row.replace('o', '#');
    });
  }

  // ------------------------------------------------------------------- API --

  var Sprites = {
    SCALE: SCALE,
    FONT_WIDTH: 5 * SCALE,
    FONT_HEIGHT: 7 * SCALE,
    LETTER_SPACING: SCALE,

    /** @type {?Object<string, !HTMLCanvasElement>} */
    images: null,

    /** @type {?Object<string, !HTMLCanvasElement>} */
    glyphs: null,

    /**
     * Build every sprite. Called once at boot.
     * @param {string=} colour
     */
    build: function (colour) {
      colour = colour || '#535353';

      this.images = {
        trexIdle: rasterise(join(TREX_TOP, TREX_LEGS_IDLE), SCALE, colour),
        trexRun1: rasterise(join(TREX_TOP, TREX_LEGS_RUN_1), SCALE, colour),
        trexRun2: rasterise(join(TREX_TOP, TREX_LEGS_RUN_2), SCALE, colour),
        trexCrashed: rasterise(closeEye(join(TREX_TOP, TREX_LEGS_IDLE)), SCALE, colour),
        trexDuck1: rasterise(join(TREX_DUCK_TOP, TREX_DUCK_LEGS_1), SCALE, colour),
        trexDuck2: rasterise(join(TREX_DUCK_TOP, TREX_DUCK_LEGS_2), SCALE, colour),
        cactusSmall: rasterise(CACTUS_SMALL, SCALE, colour),
        cactusLarge: rasterise(CACTUS_LARGE, SCALE, colour),
        pterodactyl1: rasterise(PTERODACTYL_1, SCALE, colour),
        pterodactyl2: rasterise(PTERODACTYL_2, SCALE, colour),
        cloud: rasterise(CLOUD, SCALE, '#c8c8c8'),
        restart: rasterise(buildRestartGrid(18), SCALE, colour)
      };

      this.glyphs = {};
      for (var ch in FONT) {
        if (Object.prototype.hasOwnProperty.call(FONT, ch)) {
          this.glyphs[ch] = rasterise(FONT[ch], SCALE, colour);
        }
      }
    },

    /**
     * Width in pixels of a string rendered with the pixel font.
     * @param {string} text
     * @param {number=} extraSpacing
     * @return {number}
     */
    measureText: function (text, extraSpacing) {
      extraSpacing = extraSpacing || 0;
      var advance = this.FONT_WIDTH + this.LETTER_SPACING + extraSpacing;
      return text.length * advance - this.LETTER_SPACING - extraSpacing;
    },

    /**
     * Draw a string using the pixel font.
     * @param {!CanvasRenderingContext2D} ctx
     * @param {string} text
     * @param {number} x
     * @param {number} y
     * @param {number=} extraSpacing
     */
    drawText: function (ctx, text, x, y, extraSpacing) {
      extraSpacing = extraSpacing || 0;
      var advance = this.FONT_WIDTH + this.LETTER_SPACING + extraSpacing;
      for (var i = 0; i < text.length; i++) {
        var glyph = this.glyphs[text.charAt(i)];
        if (glyph) {
          ctx.drawImage(glyph, Math.round(x + i * advance), Math.round(y));
        }
      }
    }
  };

  global.Sprites = Sprites;
})(window);
