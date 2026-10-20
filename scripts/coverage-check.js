'use strict';
/*
 * Checks a coverage run against per-directory floors. `make coverage` runs
 * the tests with coverage over lib/ and the lib/ directory of every package
 * under packages/, writes an lcov report, then runs this script with the
 * floors set in the Makefile:
 *
 *   node scripts/coverage-check.js tmp/lcov.info lib=95/93 packages/swig-twig/lib=95/92
 *
 * Each floor is <directory>=<lines>/<branches>, in percent. For each
 * directory, the covered lines and branches of the files the report lists
 * under it are summed, and the check fails when either total is below its
 * floor. It also fails when a .js file under the directory is missing from
 * the report: node only measures the files that some test loads, so a file
 * that no test requires would otherwise go unnoticed. Exits 1 if any check
 * fails.
 */
var fs = require('fs'),
  path = require('path');

var failures = 0;

function check(ok, message) {
  if (!ok) {
    failures += 1;
  }
  console.log((ok ? 'PASS ' : 'FAIL ') + message);
}

function percent(hit, found) {
  return found ? 100 * hit / found : 100;
}

function shown(hit, found) {
  return found ? percent(hit, found).toFixed(2) + '%' : 'n/a';
}

function parseFloor(arg) {
  var m = /^([^=]+)=(\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)$/.exec(arg);
  if (!m) {
    throw new Error('Invalid floor "' + arg + '", expected <directory>=<lines>/<branches>.');
  }
  return { dir: m[1].replace(/\/+$/, ''), lines: Number(m[2]), branches: Number(m[3]) };
}

function readReport(file) {
  var records = {};
  fs.readFileSync(file, 'utf8').split('end_of_record').forEach(function (chunk) {
    var sf = /^SF:(.+)$/m.exec(chunk),
      record = { LF: 0, LH: 0, BRF: 0, BRH: 0 };
    if (!sf) {
      return;
    }
    Object.keys(record).forEach(function (key) {
      var m = new RegExp('^' + key + ':(\\d+)$', 'm').exec(chunk);
      record[key] = m ? Number(m[1]) : 0;
    });
    records[path.relative(process.cwd(), path.resolve(sf[1].trim()))] = record;
  });
  return records;
}

function sourceFiles(dir) {
  var found = [];
  fs.readdirSync(dir).forEach(function (name) {
    var file = path.join(dir, name);
    if (fs.statSync(file).isDirectory()) {
      found = found.concat(sourceFiles(file));
    } else if (/\.js$/.test(name)) {
      found.push(file);
    }
  });
  return found;
}

function checkFloor(floor, records, report) {
  var prefix = floor.dir + path.sep,
    onDisk = sourceFiles(floor.dir).sort(),
    sum = { files: 0, LF: 0, LH: 0, BRF: 0, BRH: 0 },
    problems = [],
    lines,
    branches;

  Object.keys(records).forEach(function (name) {
    var record = records[name];
    if (name.indexOf(prefix) !== 0) {
      return;
    }
    sum.files += 1;
    sum.LF += record.LF;
    sum.LH += record.LH;
    sum.BRF += record.BRF;
    sum.BRH += record.BRH;
  });
  lines = percent(sum.LH, sum.LF);
  branches = percent(sum.BRH, sum.BRF);

  if (!sum.files) {
    problems.push('no file under it appears in ' + report);
  }
  if (lines < floor.lines) {
    problems.push('lines are below their floor of ' + floor.lines + '%');
  }
  if (branches < floor.branches) {
    problems.push('branches are below their floor of ' + floor.branches + '%');
  }
  onDisk.forEach(function (name) {
    if (!Object.prototype.hasOwnProperty.call(records, name)) {
      problems.push(name + ' is never loaded by a test, so coverage cannot see it');
    }
  });

  check(!problems.length, floor.dir + ': lines ' + shown(sum.LH, sum.LF) + ' (floor ' + floor.lines + '), branches ' + shown(sum.BRH, sum.BRF) + ' (floor ' + floor.branches + '), ' + sum.files + ' of ' + onDisk.length + ' files loaded' + (problems.length ? '; ' + problems.join('; ') : ''));
}

function run(args) {
  var report = args[0],
    floors = args.slice(1).map(parseFloor),
    records;

  if (!report || !floors.length) {
    throw new Error('Usage: node scripts/coverage-check.js <lcov report> <directory>=<lines>/<branches> ...');
  }
  records = readReport(report);
  floors.forEach(function (floor) {
    checkFloor(floor, records, report);
  });
}

try {
  run(process.argv.slice(2));
} catch (e) {
  check(false, 'the coverage check ran: ' + (e.stack || e.message));
}
console.log(failures ? failures + ' coverage check(s) failed' : 'All coverage checks passed');
process.exit(failures ? 1 : 0);
