var swig = require('../lib/swig'),
  expect = require('./lib/expect.js'),
  Swig = swig.Swig;

/*!
 * A chunk is a comment only when it opens with the comment open and closes
 * with the comment close; any other chunk is text, kept as written. Every
 * expected output below is what Django 5.2.18 renders for the same source
 * (and Jinja2 3.1.6, which raises instead for an unclosed comment open), and
 * what swig-twig, swig-jinja2 and swig-django already render.
 */
function render(src, opts) {
  return new Swig(opts || { cache: false }).render(src, { locals: {} });
}

describe('Text that is not a whole comment', function () {
  it('keeps text that ends with the comment close', function () {
    expect(render('a #}')).to.equal('a #}');
    expect(render('#}')).to.equal('#}');
    expect(render('line\n#}')).to.equal('line\n#}');
  });

  it('keeps the comment close that follows a comment', function () {
    expect(render('{# c #}#}')).to.equal('#}');
    expect(render('x {# c #} y #}')).to.equal('x  y #}');
  });

  it('keeps an unclosed comment open as text', function () {
    expect(render('{# unclosed')).to.equal('{# unclosed');
    expect(render('{# a #}{# b')).to.equal('{# b');
  });

  it('keeps an unclosed variable open that ends with the comment close', function () {
    expect(render('a {{ b #}')).to.equal('a {{ b #}');
  });

  it('keeps such text inside a tag body', function () {
    expect(render('{% if 1 %}a #}{% endif %}')).to.equal('a #}');
  });

  it('applies whitespace control to such text', function () {
    expect(render('{% if 1 -%}  a #}{% endif %}')).to.equal('a #}');
    expect(render('{% if 1 -%}  a #}{# c #}  b{% endif %}')).to.equal('a #}  b');
  });

  it('keeps such text with custom comment controls', function () {
    var opts = { cache: false, cmtControls: ['<!--', '-->'] };
    expect(render('x -->', opts)).to.equal('x -->');
    expect(render('<!-- c -->y -->', opts)).to.equal('y -->');
  });

  it('counts the line breaks of such text in error lines', function () {
    expect(function () {
      render('a\n#}{% nosuch %}');
    }).to.throwError(/^Unexpected tag "nosuch" on line 2\.$/);
  });

  it('still removes whole comments', function () {
    expect(render('{# c #}')).to.equal('');
    expect(render('a{# c #}b')).to.equal('ab');
    expect(render('{#\n{% if 1 %}x{% endif %}\n#}')).to.equal('');
    expect(render('<!-- c -->', { cache: false, cmtControls: ['<!--', '-->'] })).to.equal('');
  });

  it('still keeps a comment inside raw as text', function () {
    expect(render('{% raw %}a #}{# c #}{% endraw %}')).to.equal('a #}{# c #}');
  });

  it('keeps such text on the async compile path', function (done) {
    var out = new Swig({ cache: false }).compile('{# c #}a #}', { codegenMode: 'async' })({});
    Promise.resolve(out).then(function (r) {
      try {
        expect(r.output).to.equal('a #}');
        done();
      } catch (e) {
        done(e);
      }
    }, done);
  });
});
