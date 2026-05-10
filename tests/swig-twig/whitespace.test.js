var twig = require('@rhinostone/swig-twig'),
  expect = require('expect.js');

var opts = {
  locals: {
    tacos: 'tacos'
  }
};

/*!
 * #T24 — Twig/Jinja2-style whitespace control via `{{-` / `-}}` and
 * `{%-` / `-%}` markers. Mirrors tests/whitespace.test.js's six native
 * cases against the @rhinostone/swig-twig surface plus three
 * negative-literal cases that verify the post-#T23 strip-regex shape
 * (no greedy `-?` after `\s*`) carries over.
 */
describe('@rhinostone/swig-twig — whitespace control', function () {
  describe('strips before', function () {
    it('"burritos\\n \\n{{- tacos }}\\n"', function () {
      expect(twig.render('burritos\n \n{{- tacos }}\n', opts))
        .to.equal('burritostacos\n');
    });
    it('"burritos\\n \\n{%- if tacos %}\\ntacos\\r\\n{%- endif %}\\n"', function () {
      expect(twig.render('burritos\n \n{%- if tacos %}\ntacos\r\n{%- endif %}\n', opts))
        .to.equal('burritos\ntacos\n');
    });
  });

  describe('strips after', function () {
    it('"burritos\\n \\n{{ tacos -}}\\n"', function () {
      expect(twig.render('burritos\n \n{{ tacos -}}\n', opts))
        .to.equal('burritos\n \ntacos');
    });
    it('"burritos\\n \\n{% if tacos -%}\\ntacos\\r\\n{% endif -%}\\n"', function () {
      expect(twig.render('burritos\n \n{% if tacos -%}\ntacos\n{% endif -%}\n', opts))
        .to.equal('burritos\n \ntacos\n');
    });
  });

  describe('strips both', function () {
    it('"burritos\\n \\n{{- tacos -}}\\n"', function () {
      expect(twig.render('burritos\n \n{{- tacos -}}\n', opts))
        .to.equal('burritostacos');
    });
    it('"burritos\\n \\n{%- if tacos -%}\\ntacos\\r\\n{%- endif -%}\\n"', function () {
      expect(twig.render('burritos\n \n{%- if tacos -%}\ntacos\n{%- endif -%}\n', opts))
        .to.equal('burritostacos');
    });
  });

  describe('composes with negative-literal expressions (#T23 shape carries over)', function () {
    it('strips both around a bare negative literal', function () {
      expect(twig.render('a\n{{- -5 -}}\nb')).to.equal('a-5b');
    });
    it('does not eat the expression `-` when no strip-control marker is present', function () {
      expect(twig.render('{{ -5 }}')).to.equal('-5');
      expect(twig.render('{{ -1.5 }}')).to.equal('-1.5');
    });
    it('strips before only, around a negative literal', function () {
      expect(twig.render('a\n{{- -5 }}\nb')).to.equal('a-5\nb');
    });
    it('strips after only, around a negative literal', function () {
      expect(twig.render('a\n{{ -5 -}}\nb')).to.equal('a\n-5b');
    });
  });
});
