var swig = require('../../lib/swig'),
  expect = require('../lib/expect.js'),
  Swig = swig.Swig;

function render(src, locals, opts) {
  return new Swig({ cache: false }).render(src, { locals: locals || {}, filename: opts && opts.filename });
}

var MULTIPLE = /^Multiple "else" branches in "if" tag on line 1\.$/;

describe('Tag: else, one per if', function () {
  it('a second else fails at compile', function () {
    expect(function () {
      render('{% if x %}A{% else %}B{% else %}C{% endif %}', { x: 1 });
    }).to.throwError(MULTIPLE);
  });

  it('an elseif after else fails at compile', function () {
    expect(function () {
      render('{% if x %}A{% else %}B{% elseif y %}C{% endif %}', { x: 0, y: 1 });
    }).to.throwError(MULTIPLE);
  });

  it('an elif after else fails at compile', function () {
    expect(function () {
      render('{% if x %}A{% else %}B{% elif y %}C{% endif %}', { x: 0, y: 1 });
    }).to.throwError(MULTIPLE);
  });

  it('names the line and the file', function () {
    expect(function () {
      render('{% if x %}A{% else %}\nB{% else %}C{% endif %}', { x: 1 }, { filename: 'page.html' });
    }).to.throwError(/^Multiple "else" branches in "if" tag on line 2 in file page\.html\.$/);
  });

  it('keeps elseif branches before a single else', function () {
    var src = '{% if x == 1 %}A{% elseif x == 2 %}B{% elif x == 3 %}C{% else %}D{% endif %}';
    expect(render(src, { x: 1 }) + render(src, { x: 2 }) + render(src, { x: 3 }) + render(src, { x: 4 })).to.equal('ABCD');
  });

  it('counts only the branches of its own if', function () {
    var src = '{% if x %}{% if y %}A{% else %}B{% endif %}{% else %}{% if y %}C{% else %}D{% endif %}{% endif %}';
    expect(render(src, { x: 1, y: 0 }) + render(src, { x: 0, y: 1 })).to.equal('BC');
  });

  it('allows one else in each of two sibling ifs', function () {
    var src = '{% if x %}A{% else %}B{% endif %}{% if x %}C{% else %}D{% endif %}';
    expect(render(src, { x: 0 })).to.equal('BD');
  });
});
