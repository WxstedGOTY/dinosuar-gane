#!/usr/bin/env node
/*
 * Static server for playing locally.
 *
 *   node serve.js [port]     (default 8000)
 *
 * Binds to 127.0.0.1 only, so the page is reachable from this machine and
 * nothing else -- not the local network, not the internet. No dependencies.
 */

'use strict';

var http = require('http');
var fs = require('fs');
var path = require('path');

var PORT = Number(process.argv[2] || process.env.PORT || 8000);
var ROOT = __dirname;

var TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

var server = http.createServer(function (req, res) {
  var pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch (e) {
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    res.end('Bad request');
    return;
  }

  if (pathname === '/') {
    pathname = '/index.html';
  }

  var filePath = path.join(ROOT, path.normalize(pathname));

  // Refuse anything resolving outside the project directory.
  if (filePath !== ROOT && filePath.indexOf(ROOT + path.sep) !== 0) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, function (err, data) {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
      return;
    }
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(filePath).toLowerCase()] ||
                      'application/octet-stream',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow'
    });
    res.end(data);
  });
});

server.on('error', function (err) {
  if (err.code === 'EADDRINUSE') {
    console.error('Port ' + PORT + ' is busy. Try: node serve.js ' + (PORT + 1));
  } else {
    console.error(err.message);
  }
  process.exit(1);
});

server.listen(PORT, '127.0.0.1', function () {
  console.log('Offline Runner  ->  http://localhost:' + PORT + '/');
  console.log('Bound to 127.0.0.1; only this machine can reach it.');
  console.log('Ctrl+C to stop.');
});
