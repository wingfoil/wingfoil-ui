#!/usr/bin/env node
// wingfoil-ui — package bin (spec-007 §2). Keep this file parseable by old Node.js (CommonJS,
// ES2020 syntax at most): it must be able to refuse an unsupported version with a clear message.
'use strict';

var fs = require('fs');
var path = require('path');
var url = require('url');

var parts = process.versions.node.split('.');
var major = Number(parts[0]);
var minor = Number(parts[1]);

if (major < 22 || (major === 22 && minor < 12)) {
  var catalogue = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'server', 'src', 'i18n', 'en.json'), 'utf8'));
  var text = catalogue['launcher.nodeTooOld'].replace('{major}', String(major)).replace('{minor}', String(minor));
  process.stderr.write(text + '\n');
  process.exit(1);
}

import(url.pathToFileURL(path.join(__dirname, '..', 'server', 'dist', 'main.js')).href)
  .then(function (entry) {
    return entry.main(process.argv.slice(2));
  })
  .catch(function (error) {
    process.stderr.write(String((error && error.stack) || error) + '\n');
    process.exitCode = 70;
  });
