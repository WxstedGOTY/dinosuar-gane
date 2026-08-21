#!/usr/bin/env node
/*
 * Bundles the game into one self-contained HTML file.
 *
 * The multi-file version is the source of truth; this only inlines it, so the
 * two cannot drift apart. Run it after changing anything under js/ or css/.
 *
 *   node build-single-file.js [outfile]
 */

'use strict';

var fs = require('fs');
var path = require('path');

var root = __dirname;
var out = process.argv[2] || path.join(root, 'offline-runner.html');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

/** Pull the markup inside <main> out of the page shell. */
function extractMain(html) {
  var match = html.match(/<main[\s\S]*?<\/main>/);
  if (!match) throw new Error('index.html has no <main> block');
  return match[0];
}

/**
 * Inline scripts run before the closing tag is parsed, so any literal
 * "</script>" inside the source would end the block early.
 */
function escapeForInlineScript(js) {
  return js.replace(/<\/script>/gi, '<\\/script>');
}

var page = [
  '<title>Offline Runner</title>',
  '<meta name="robots" content="noindex, nofollow, noarchive, noimageindex">',
  '',
  '<style>',
  read('css/style.css').trim(),
  '</style>',
  '',
  extractMain(read('index.html')),
  '',
  '<script>',
  escapeForInlineScript(read('js/sprites.js').trim()),
  '</script>',
  '<script>',
  escapeForInlineScript(read('js/autopilot.js').trim()),
  '</script>',
  '<script>',
  escapeForInlineScript(read('js/game.js').trim()),
  '</script>',
  ''
].join('\n');

fs.writeFileSync(out, page);
console.log('wrote ' + out + ' (' + Math.round(page.length / 1024) + ' KB)');
