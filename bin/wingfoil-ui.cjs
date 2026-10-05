#!/usr/bin/env node
// wingfoil-ui — package bin (spec-007 §2). Keep this file parseable by old Node.js (CommonJS,
// ES2020 syntax at most): it must be able to refuse an unsupported version with a clear message.
'use strict';

var fs = require('fs');
var path = require('path');
var url = require('url');

/** A message of the server catalogue, read as plain JSON (no FormatJS before the check). */
function launcherMessage(key, args) {
  var file = path.join(__dirname, '..', 'server', 'src', 'i18n', 'en.json');
  var text = JSON.parse(fs.readFileSync(file, 'utf8'))[key];
  Object.keys(args).forEach(function (name) {
    text = text.split('{' + name + '}').join(String(args[name]));
  });
  return text;
}

var parts = process.versions.node.split('.');
var major = Number(parts[0]);
var minor = Number(parts[1]);

if (major < 22 || (major === 22 && minor < 12)) {
  process.stderr.write(launcherMessage('launcher.nodeTooOld', { major: major, minor: minor }) + '\n');
  process.exit(1);
}

import(url.pathToFileURL(path.join(__dirname, '..', 'server', 'dist', 'main.js')).href)
  .then(function (entry) {
    return entry.main(process.argv.slice(2));
  })
  .catch(function (error) {
    process.stderr.write(launcherMessage('launcher.unexpected', { message: (error && error.message) || error }) + '\n');
    process.exitCode = 70;
  });
