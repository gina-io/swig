var swigModule = require('../../lib/swig'),
  runtimeModule = require('../../lib/runtime'),
  twigModule = require('@rhinostone/swig-twig'),
  jinja2Module = require('@rhinostone/swig-jinja2'),
  djangoModule = require('@rhinostone/swig-django'),
  expect = require('../lib/expect.js');

/*!
 * Default locals that are not a plain object, such as a class instance, keep
 * their prototype in the copy a render without call locals works on: the copy
 * has the same prototype and the same own enumerable properties, as the copy
 * of call locals has, so prototype methods and getters still resolve.
 */

function Helpers() {
  this.own = 'O';
}
Helpers.prototype.hello = function () {
  return 'P';
};
Object.defineProperty(Helpers.prototype, 'getter', {
  get: function () {
    return 'G';
  }
});

function created() {
  var o = Object.create({
    hello: function () {
      return 'P';
    },
    get getter() {
      return 'G';
    }
  });
  o.own = 'O';
  return o;
}

var flavors = [
  ['native', swigModule, 'Swig', '[{{ own }}|{{ hello() }}|{{ getter }}]'],
  ['twig', twigModule, 'Twig', '[{{ own }}|{{ hello() }}|{{ getter }}]'],
  ['jinja2', jinja2Module, 'Jinja2', '[{{ own }}|{{ hello() }}|{{ getter }}]'],
  ['django', djangoModule, 'Django', '[{{ own }}|{{ hello }}|{{ getter }}]']
];

var writers = {
  native: '{% set own = "W" %}{% set hello = "W" %}{{ own }}',
  twig: '{% set own = "W" %}{% set hello = "W" %}{{ own }}',
  jinja2: '{% set own = "W" %}{% set hello = "W" %}{{ own }}',
  django: '{% for x in "ab" %}{% cycle "a" "b" %}{% endfor %}'
};

flavors.forEach(function (flavor) {
  var name = flavor[0],
    lib = flavor[1],
    Ctor = lib[flavor[2]],
    src = flavor[3],
    files = { '/t.html': src, '/w.html': writers[name] };

  function instance(defaults, loader) {
    return new Ctor({ loader: loader || lib.loaders.memory(files, '/'), locals: defaults });
  }

  function asyncLoader() {
    var mem = lib.loaders.memory(files, '/');
    return {
      async: true,
      resolve: mem.resolve,
      load: function (id, cb) {
        if (!cb) {
          return mem.load(id);
        }
        setImmediate(function () {
          var s;
          try {
            s = mem.load(id);
          } catch (e) {
            cb(e);
            return;
          }
          cb(null, s);
        });
      }
    };
  }

  describe(name + ' — default locals with a prototype', function () {
    [['a class instance', function () { return new Helpers(); }], ['an Object.create(proto) object', created]].forEach(function (kind) {
      it('keeps the prototype of ' + kind[0] + ' in render, renderFile and run without call locals', function () {
        var s = instance(kind[1]());
        expect(s.render(src)).to.equal('[O|P|G]');
        expect(s.renderFile('/t.html')).to.equal('[O|P|G]');
        expect(s.run(s.precompile(src).tpl)).to.equal('[O|P|G]');
      });

      it('keeps the prototype of ' + kind[0] + ' in an async render without call locals', function (done) {
        instance(kind[1](), asyncLoader()).renderFile('/t.html', undefined, function (err, out) {
          if (err) {
            done(err);
            return;
          }
          try {
            expect(out).to.equal('[O|P|G]');
          } catch (e) {
            done(e);
            return;
          }
          done();
        });
      });

      it('leaves ' + kind[0] + ' unchanged after a render without call locals', function () {
        var d = kind[1](), proto = Object.getPrototypeOf(d), s = instance(d);
        s.renderFile('/w.html');
        s.run(s.precompile(writers[name]).tpl);
        expect(Object.keys(d)).to.eql(['own']);
        expect(d.own).to.equal('O');
        expect(Object.getPrototypeOf(d)).to.be(proto);
        expect(Object.keys(proto).indexOf('own')).to.equal(-1);
        expect(s.render(src)).to.equal('[O|P|G]');
      });
    });
  });
});

describe('runtime — default locals with a prototype', function () {
  var src = '[{{ own }}|{{ hello() }}|{{ getter }}]';

  it('keeps the prototype of a class instance in a registered template and run without call locals', function () {
    var rt = new runtimeModule.Swig({ locals: new Helpers() });
    rt.register('/reg.html', swigModule.precompile(src).tpl);
    expect(rt.renderFile('/reg.html')).to.equal('[O|P|G]');
    expect(rt.run(swigModule.precompile(src).tpl)).to.equal('[O|P|G]');
  });

  it('leaves a class instance unchanged after a registered template writes without call locals', function () {
    var d = new Helpers(), rt = new runtimeModule.Swig({ locals: d });
    rt.register('/w.html', swigModule.precompile('{% set own = "W" %}{% set hello = "W" %}{{ own }}').tpl);
    expect(rt.renderFile('/w.html')).to.equal('W');
    expect(Object.keys(d)).to.eql(['own']);
    expect(d.own).to.equal('O');
    expect(Object.getPrototypeOf(d)).to.be(Helpers.prototype);
  });
});
