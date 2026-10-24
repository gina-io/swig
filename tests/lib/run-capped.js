var cp = require('child_process');

/*!
 * Run `code` with `node -e` in a child process whose heap is capped at 64 MB
 * and return its exit status, signal and trimmed standard output. A builder
 * that allocates an array from a huge number aborts that child (SIGABRT,
 * heap out of memory) within a fraction of a second, instead of exhausting
 * the memory of the test run; with its size guard in place, the child prints
 * its result and exits with status 0.
 *
 * @param  {string} code  Script that prints one line.
 * @return {string}       '<signal> <status> <output>', e.g. 'null 0 []'.
 */
module.exports = function runCapped(code) {
  var res = cp.spawnSync(process.execPath, ['--max-old-space-size=64', '-e', code], {
    encoding: 'utf8',
    timeout: 60000
  });
  return res.signal + ' ' + res.status + ' ' + (res.stdout || '').trim();
};
