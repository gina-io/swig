#!/usr/bin/env node
/*jslint es5: true */

var swig = require('../index'),
  fs = require('fs'),
  path = require('path'),
  filters = require('../lib/filters'),
  utils = require('../lib/utils');

var wrapstart = 'var tpl = ',
  wrapend = ';';

/**
 * CLI flag table. Each entry is keyed by the canonical name the rest of this
 * file reads. <code>alias</code> is the long-form name folded onto that key,
 * <code>boolean</code> marks flags that never consume the following token,
 * and <code>default</code> seeds a value when the flag is absent.
 *
 * @private
 */
var FLAGS = {
  'v': { alias: 'version', boolean: true },
  'o': { alias: 'output', default: 'stdout' },
  'h': { alias: 'help', boolean: true },
  'j': { alias: 'json' },
  'c': { alias: 'context' },
  'm': { alias: 'minify', boolean: true },
  'r': { alias: 'recursive' },
  'ext': {},
  'filters': {},
  'tags': {},
  'options': {},
  'wrap-start': { default: wrapstart },
  'wrap-end': { default: wrapend },
  'method-name': { default: 'tpl' }
};

var argv = parseArgs(process.argv.slice(2)),
  command,
  ctx = {},
  out = function (file, str) {
    console.log(str);
  },
  efn = function () {},
  fn;

// Show this help screen.
if (argv.h) {
  console.log(usage());
  process.exit(0);
}

// What version?
if (argv.v) {
  console.log(require('../package').version);
  process.exit(0);
}

// Validate the parsed arguments and resolve the subcommand. On any invalid
// combination, print the message (when there is one) plus the usage screen
// and exit non-zero — the behaviour the former yargs `.check()` gate had.
try {
  command = validate(argv);
} catch (e) {
  if (e.message) {
    console.error(e.message);
  }
  console.error(usage());
  process.exit(1);
}

// Pull in any context data provided
if (argv.j) {
  ctx = JSON.parse(fs.readFileSync(argv.j, 'utf8'));
} else if (argv.c) {
  ctx = require(argv.c);
}

if (argv.o !== 'stdout' && !argv.r) {
  argv.o += '/';
  argv.o = path.normalize(argv.o);

  try {
    fs.mkdirSync(argv.o);
  } catch (e) {
    // EEXIST (output dir already exists) is expected. Match on e.code; the
    // legacy numeric errno 47 no longer identifies EEXIST on modern Node.
    if (e.code !== 'EEXIST') {
      throw e;
    }
  }

  out = function (file, str) {
    file = path.basename(file);
    fs.writeFileSync(argv.o + file, str, { flags: 'w' });
    console.log('Wrote', argv.o + file);
  };
}

// Set any custom filters
if (argv.filters) {
  utils.each(require(path.resolve(argv.filters)), function (filter, name) {
    swig.setFilter(name, filter);
  });
}

// Set any custom tags
if (argv.tags) {
  utils.each(require(path.resolve(argv.tags)), function (tag, name) {
    swig.setTag(name, tag.parse, tag.compile, tag.ends, tag.block);
  });
}

// Specify swig default options
if (argv.options) {
  swig.setDefaults(require(argv.options));
}

switch (command) {
case 'compile':
  fn = function (file, str) {
    var r = swig.precompile(str, { filename: file, locals: ctx }).tpl.toString().replace('anonymous', '');

    r = argv['wrap-start'] + r + argv['wrap-end'];

    if (argv.m) {
      r = loadTerser().minify_sync(r).code;
    }

    out(file, r);
  };
  break;

case 'run':
  fn = function (file, str) {
    (function () {
      eval(str);
      var __tpl = eval(argv['method-name']);
      out(file, __tpl(swig, ctx, filters, utils, efn));
    }());
  };
  break;

case 'render':
  fn = function (file, str) {
    out(file, swig.render(str, { filename: file, locals: ctx }));
  };
  break;
}

if (argv.r) {
  bundleRecursive(argv.r);
} else {
  argv._.forEach(function (file) {
    var str = fs.readFileSync(file, 'utf8');
    fn(file, str);
  });
}

/**
 * Parse a <code>process.argv</code> tail into a flag / positional map.
 * Supports <code>--name</code>, <code>--name=value</code>,
 * <code>--name value</code>, <code>-x</code>, <code>-x value</code>,
 * <code>-x=value</code>, and a <code>--</code> terminator after which every
 * token is positional. Long-form aliases are folded onto their canonical
 * {@link FLAGS} key; boolean flags never consume the following token. Bare
 * tokens collect into <code>argv._</code>. Unknown flags are tolerated and
 * kept verbatim, matching the former non-strict yargs behaviour.
 *
 * @param  {string[]} args  <code>process.argv.slice(2)</code>.
 * @return {object}         <code>{ _: [positionals], &lt;flag&gt;: value }</code>.
 * @private
 */
function parseArgs(args) {
  var argv = { _: [] },
    i,
    token,
    body,
    eq,
    name,
    canonical,
    value,
    key;

  for (i = 0; i < args.length; i += 1) {
    token = args[i];

    if (token === '--') {
      argv._ = argv._.concat(args.slice(i + 1));
      break;
    }

    if (token.slice(0, 2) === '--') {
      body = token.slice(2);
    } else if (token.charAt(0) === '-' && token.length > 1) {
      body = token.slice(1);
    } else {
      argv._.push(token);
      continue;
    }

    eq = body.indexOf('=');
    if (eq !== -1) {
      name = body.slice(0, eq);
      value = body.slice(eq + 1);
    } else {
      name = body;
      value = undefined;
    }

    canonical = aliasToCanonical(name);

    if (value === undefined) {
      if (FLAGS[canonical] && FLAGS[canonical].boolean) {
        value = true;
      } else if (i + 1 < args.length && !isFlagToken(args[i + 1])) {
        i += 1;
        value = args[i];
      } else {
        value = true;
      }
    }

    argv[canonical] = value;
  }

  // Seed defaults for any flag the caller did not pass.
  for (key in FLAGS) {
    if (FLAGS.hasOwnProperty(key) && FLAGS[key].hasOwnProperty('default') && !argv.hasOwnProperty(key)) {
      argv[key] = FLAGS[key].default;
    }
  }

  return argv;
}

/**
 * Resolve a flag name to its canonical {@link FLAGS} key. A name that is
 * already canonical, or that matches no known alias, is returned unchanged.
 *
 * @param  {string} name  Flag name as written on the command line.
 * @return {string}       Canonical key.
 * @private
 */
function aliasToCanonical(name) {
  var key;
  if (FLAGS.hasOwnProperty(name)) {
    return name;
  }
  for (key in FLAGS) {
    if (FLAGS.hasOwnProperty(key) && FLAGS[key].alias === name) {
      return key;
    }
  }
  return name;
}

/**
 * Is <var>token</var> a flag rather than a value? Used to decide whether a
 * value-taking flag should consume the next token.
 *
 * @param  {string}  token  Candidate token.
 * @return {boolean}        True when the token looks like a flag.
 * @private
 */
function isFlagToken(token) {
  return token.charAt(0) === '-' && token.length > 1;
}

/**
 * Validate the parsed arguments and resolve the subcommand. Mirrors the gate
 * the former yargs <code>.check()</code> chain enforced — same checks, same
 * messages, same <code>--method-name</code> &rarr; <code>--wrap-start</code>
 * rewrite. Throws on any invalid combination; the caller prints the message
 * plus the usage screen and exits non-zero.
 *
 * @param  {object} argv  Parsed argv from {@link parseArgs}.
 * @return {string}       The resolved subcommand: compile, render, or run.
 * @private
 */
function validate(argv) {
  var cmd;

  if (!argv._.length) {
    throw new Error('');
  }

  cmd = argv._.shift();
  if (cmd !== 'compile' && cmd !== 'render' && cmd !== 'run') {
    throw new Error('Unrecognized command "' + cmd + '". Use -h for help.');
  }

  if (argv['method-name'] !== 'tpl' && argv['wrap-start'] !== wrapstart) {
    throw new Error('Cannot use arguments "--method-name" and "--wrap-start" together.');
  }

  if (argv['method-name'] !== 'tpl') {
    argv['wrap-start'] = 'var ' + argv['method-name'] + ' = ';
  }

  if (argv.r) {
    if (cmd !== 'compile') {
      throw new Error('--recursive can only be used with "compile".');
    }
    if (argv._.length) {
      throw new Error('--recursive does not accept positional file arguments; pass a single directory via --recursive <dir>.');
    }
    if (argv['method-name'] !== 'tpl') {
      throw new Error('--recursive cannot be combined with --method-name; the bundle exports a map of templates, not a single named function.');
    }
    if (argv['wrap-start'] !== wrapstart || argv['wrap-end'] !== wrapend) {
      throw new Error('--recursive cannot be combined with --wrap-start / --wrap-end; the bundle wrapper is fixed.');
    }
  }

  if (argv.ext && !argv.r) {
    throw new Error('--ext is only meaningful with --recursive.');
  }

  return cmd;
}

/**
 * Build the CLI usage screen — the command synopsis plus the option table.
 *
 * @return {string}  The full usage text.
 * @private
 */
function usage() {
  return [
    '',
    ' Usage:',
    '    swig compile [files] [options]',
    '    swig compile --recursive <dir> [options]',
    '    swig run [files] [options]',
    '    swig render [files] [options]',
    '',
    ' Options:',
    '    -v, --version       Show the Swig version number.',
    '    -o, --output        Output location.',
    '    -h, --help          Show this help screen.',
    '    -j, --json          Variable context as a JSON file.',
    '    -c, --context       Variable context as a CommonJS-style file. Used only if option `j` is not provided.',
    '    -m, --minify        Minify compiled functions with terser',
    '    -r, --recursive     Recursively compile every template in <dir> into a single AOT bundle module.',
    '    --ext               Comma-separated list of file extensions to include when using --recursive (e.g. ".html,.swig"). Defaults to no filter.',
    '    --filters           Custom filters as a CommonJS-style file',
    '    --tags              Custom tags as a CommonJS-style file',
    '    --options           Customize Swig\'s Options from a CommonJS-style file',
    '    --wrap-start        Template wrapper beginning for "compile".',
    '    --wrap-end          Template wrapper end for "compile".',
    '    --method-name       Method name to set template to and run from.',
    ''
  ].join('\n');
}

/**
 * Lazily load the optional <code>terser</code> package, used only by the
 * <code>--minify</code> flag. terser is a CLI-only dependency — the library
 * entry point never needs it — so it ships as a devDependency rather than a
 * runtime one, and a plain <code>npm install @rhinostone/swig</code> does not
 * pull it in. Print a friendly install hint and exit non-zero if a CLI user
 * reaches <code>--minify</code> without it.
 *
 * @return {object}  The terser module.
 * @private
 */
function loadTerser() {
  try {
    return require('terser');
  } catch (e) {
    if (e.code !== 'MODULE_NOT_FOUND') {
      throw e;
    }
    console.error('The --minify flag needs the "terser" package, which is not installed.');
    console.error('Install it with:  npm install terser');
    process.exit(1);
  }
}

/**
 * Walk a directory recursively, returning every regular-file path found.
 * Skips dotfile entries and dot-directories so platform metadata such as
 * <code>.DS_Store</code> never reaches the compiler.
 *
 * @param  {string} dir Directory to walk.
 * @return {string[]}   Absolute file paths in deterministic, sorted order.
 * @private
 */
function walkSync(dir) {
  var out = [],
    entries = fs.readdirSync(dir, { withFileTypes: true });

  entries.sort(function (a, b) {
    return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
  });

  entries.forEach(function (entry) {
    if (entry.name.charAt(0) === '.') {
      return;
    }
    var full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out = out.concat(walkSync(full));
    } else if (entry.isFile()) {
      out.push(full);
    }
  });

  return out;
}

/**
 * Compile every template under <var>dir</var> into a single CommonJS module
 * mapping resolved relative paths to compiled template functions.
 *
 * Note: <code>extends</code>, <code>include</code>, and <code>import</code>
 * resolution still happens at render time through the consumer's loader. The
 * bundle is not a closed module against inheritance chains.
 *
 * @param  {string}  dir Directory to walk.
 * @return {undefined}   Writes to stdout or to <code>argv.o</code>.
 * @private
 */
function bundleRecursive(dir) {
  var extFilter = null,
    files,
    parts = [],
    output;

  if (argv.ext) {
    extFilter = String(argv.ext).split(',').map(function (e) {
      e = e.trim();
      return e.charAt(0) === '.' ? e : '.' + e;
    });
  }

  files = walkSync(dir).filter(function (file) {
    if (!extFilter) {
      return true;
    }
    return extFilter.indexOf(path.extname(file)) !== -1;
  });

  files.forEach(function (file) {
    var src = fs.readFileSync(file, 'utf8'),
      key = path.relative(dir, file).split(path.sep).join('/'),
      tpl = swig.precompile(src, { filename: file, locals: ctx }).tpl
        .toString()
        .replace('anonymous', '');

    parts.push(JSON.stringify(key) + ': ' + tpl);
  });

  output = 'module.exports = {\n' + parts.join(',\n') + '\n};\n';

  if (argv.m) {
    output = loadTerser().minify_sync(output).code;
  }

  if (argv.o === 'stdout') {
    console.log(output);
    return;
  }

  fs.writeFileSync(argv.o, output, { flags: 'w' });
  console.log('Wrote', argv.o);
}
