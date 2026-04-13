#!/usr/bin/env node
/*jslint es5: true */

var swig = require('../index'),
  yargs = require('yargs'),
  fs = require('fs'),
  path = require('path'),
  filters = require('../lib/filters'),
  utils = require('../lib/utils'),
  terser = require('terser');

var command,
  wrapstart = 'var tpl = ',
  wrapend = ';',
  argv = yargs
    .usage('\n Usage:\n' +
      '    $0 compile [files] [options]\n' +
      '    $0 compile --recursive <dir> [options]\n' +
      '    $0 run [files] [options]\n' +
      '    $0 render [files] [options]\n'
      )
    .describe({
      v: 'Show the Swig version number.',
      o: 'Output location.',
      h: 'Show this help screen.',
      j: 'Variable context as a JSON file.',
      c: 'Variable context as a CommonJS-style file. Used only if option `j` is not provided.',
      m: 'Minify compiled functions with terser',
      r: 'Recursively compile every template in <dir> into a single AOT bundle module.',
      'ext': 'Comma-separated list of file extensions to include when using --recursive (e.g. ".html,.swig"). Defaults to no filter.',
      'filters': 'Custom filters as a CommonJS-style file',
      'tags': 'Custom tags as a CommonJS-style file',
      'options': 'Customize Swig\'s Options from a CommonJS-style file',
      'wrap-start': 'Template wrapper beginning for "compile".',
      'wrap-end': 'Template wrapper end for "compile".',
      'method-name': 'Method name to set template to and run from.'
    })
    .alias('v', 'version')
    .alias('o', 'output')
    .default('o', 'stdout')
    .alias('h', 'help')
    .alias('j', 'json')
    .alias('c', 'context')
    .alias('m', 'minify')
    .alias('r', 'recursive')
    .default('wrap-start', wrapstart)
    .default('wrap-end', wrapend)
    .default('method-name', 'tpl')
    .check(function (argv) {
      if (argv.v) {
        return true;
      }

      if (!argv._.length) {
        throw new Error('');
      }

      command = argv._.shift();
      if (command !== 'compile' && command !== 'render' && command !== 'run') {
        throw new Error('Unrecognized command "' + command + '". Use -h for help.');
      }

      if (argv['method-name'] !== 'tpl' && argv['wrap-start'] !== wrapstart) {
        throw new Error('Cannot use arguments "--method-name" and "--wrap-start" together.');
      }

      if (argv['method-name'] !== 'tpl') {
        argv['wrap-start'] = 'var ' + argv['method-name'] + ' = ';
      }

      if (argv.r) {
        if (command !== 'compile') {
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

      return true;
    })
    .argv,
  ctx = {},
  out = function (file, str) {
    console.log(str);
  },
  efn = function () {},
  anonymous,
  files,
  fn;

// What version?
if (argv.v) {
  console.log(require('../package').version);
  process.exit(0);
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
    if (e.errno !== 47) {
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
      r = terser.minify_sync(r).code;
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
    output = terser.minify_sync(output).code;
  }

  if (argv.o === 'stdout') {
    console.log(output);
    return;
  }

  fs.writeFileSync(argv.o, output, { flags: 'w' });
  console.log('Wrote', argv.o);
}
