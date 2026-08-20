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
    '...........###########',
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
    '.....######.........',
    '...##########.......',
    '..############......',
    '.###############....',
    '.################...',
    '..##############....',
    '....##########......',
    '....................'
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
        cloud: rasterise(CLOUD, SCALE, '#c8c8c8')
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
