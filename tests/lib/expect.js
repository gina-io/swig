/*!
 * In-repo assertion shim — a dependency-free replacement for `expect.js@0.2.0`.
 *
 * The test suite uses only a fixed subset of the expect.js API; this module
 * reproduces that subset with byte-for-byte behavioral parity so the existing
 * assertions pass unchanged. It deliberately matches expect.js@0.2.0 quirks
 * (verified against node_modules/expect.js/expect.js), NOT a "more correct"
 * variant — the goal is an exact drop-in, so no test changes.
 *
 * Surface reproduced (the only forms the suite uses):
 *   equal(x) / be(x)        strict === (NOT coercive)
 *   eql(x)                  coercive deep-equal (node 0.x assert.deepEqual)
 *   be.a(t) / be.an(t)      typeof, with 'array' -> isArray, 'object' -> non-null object
 *   be.ok()                 truthiness
 *   be.greaterThan(n)/above strict >
 *   be.lessThan(n)/below    strict <
 *   match(re)               re.exec(subject) != null
 *   contain(x)              string indexOf substring / array indexOf membership
 *   have.length(n)          coercive n == obj.length
 *   have.property(k)        existence (key in obj); drills this.obj = obj[k]
 *   throwError / throwException(fn)
 *                           fn=function -> fn(err) for side effects (inner
 *                             asserts bubble up; return ignored)
 *                           fn=regexp   -> match err.message (or raw if a
 *                             string was thrown), honoring `not`
 *                           fn=string   -> IGNORED (expect.js@0.2.0 only checks
 *                             that it threw — do not "improve" this)
 *                           fn=absent   -> assert that it threw
 *   chainable getters: to, be, have, not   (`not` reachable from root and `to`)
 *
 * Negation: a single `not` flag, consulted by `assert`, `throwException`, and
 * `property`. Intentionally NOT implemented (unused by the suite): keys/key,
 * empty, within, fail, string, include, and, been, with, getter-style ok/a/an.
 */

'use strict';

function inspect(o) {
  if (typeof o === 'string') { return '"' + o + '"'; }
  try { return JSON.stringify(o); } catch (e) { return String(o); }
}

function isArray(o) {
  return Object.prototype.toString.call(o) === '[object Array]';
}

// node 0.x assert.deepEqual algorithm (what expect.js@0.2.0's expect.eql is).
function eql(actual, expected) {
  if (actual === expected) {
    return true;
  }
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(actual) && Buffer.isBuffer(expected)) {
    if (actual.length !== expected.length) { return false; }
    for (var bi = 0; bi < actual.length; bi += 1) {
      if (actual[bi] !== expected[bi]) { return false; }
    }
    return true;
  }
  if (actual instanceof Date && expected instanceof Date) {
    return actual.getTime() === expected.getTime();
  }
  // Both non-objects: coercive `==` at the leaves (the key expect.js quirk).
  if (typeof actual !== 'object' && typeof expected !== 'object') {
    return actual == expected;
  }
  return objEquiv(actual, expected);
}

function objEquiv(a, b) {
  if (a === null || a === undefined || b === null || b === undefined) {
    return false;
  }
  if (a.prototype !== b.prototype) { return false; }
  var ka, kb, i, key;
  try {
    ka = Object.keys(a);
    kb = Object.keys(b);
  } catch (e) {
    // one is a primitive wrapper / string literal, the other isn't
    return false;
  }
  if (ka.length !== kb.length) { return false; }
  ka.sort();
  kb.sort();
  for (i = ka.length - 1; i >= 0; i -= 1) {
    if (ka[i] != kb[i]) { return false; }
  }
  for (i = ka.length - 1; i >= 0; i -= 1) {
    key = ka[i];
    if (!eql(a[key], b[key])) { return false; }
  }
  return true;
}

function Assertion(obj) {
  this.obj = obj;
  this._not = false;
}

// The funnel every matcher calls. `posMsg`/`negMsg` may be strings or thunks.
Assertion.prototype.assert = function (truth, posMsg, negMsg) {
  var ok = this._not ? !truth : truth;
  if (!ok) {
    var msg = this._not ? negMsg : posMsg;
    throw new Error(typeof msg === 'function' ? msg.call(this) : msg);
  }
  return this;
};

Assertion.prototype.equal = function (obj) {
  var self = this;
  return this.assert(
    this.obj === obj,
    function () { return 'expected ' + inspect(self.obj) + ' to equal ' + inspect(obj); },
    function () { return 'expected ' + inspect(self.obj) + ' to not equal ' + inspect(obj); }
  );
};

Assertion.prototype.eql = function (obj) {
  var self = this;
  return this.assert(
    eql(obj, this.obj),
    function () { return 'expected ' + inspect(self.obj) + ' to sort of equal ' + inspect(obj); },
    function () { return 'expected ' + inspect(self.obj) + ' to sort of not equal ' + inspect(obj); }
  );
};

Assertion.prototype.a = Assertion.prototype.an = function (type) {
  var self = this, ok;
  if (typeof type === 'string') {
    if (type === 'array') {
      ok = isArray(this.obj);
    } else if (type === 'object') {
      ok = typeof this.obj === 'object' && this.obj !== null;
    } else {
      ok = (typeof this.obj === type);
    }
    return this.assert(
      ok,
      function () { return 'expected ' + inspect(self.obj) + ' to be a ' + type; },
      function () { return 'expected ' + inspect(self.obj) + ' not to be a ' + type; }
    );
  }
  // constructor form: instanceof
  return this.assert(
    this.obj instanceof type,
    function () { return 'expected ' + inspect(self.obj) + ' to be an instance of supplied constructor'; },
    function () { return 'expected ' + inspect(self.obj) + ' not to be an instance of supplied constructor'; }
  );
};

Assertion.prototype.ok = function () {
  var self = this;
  return this.assert(
    !!this.obj,
    function () { return 'expected ' + inspect(self.obj) + ' to be truthy'; },
    function () { return 'expected ' + inspect(self.obj) + ' to be falsy'; }
  );
};

Assertion.prototype.greaterThan = Assertion.prototype.above = function (n) {
  var self = this;
  return this.assert(
    this.obj > n,
    function () { return 'expected ' + inspect(self.obj) + ' to be above ' + n; },
    function () { return 'expected ' + inspect(self.obj) + ' to be below ' + n; }
  );
};

Assertion.prototype.lessThan = Assertion.prototype.below = function (n) {
  var self = this;
  return this.assert(
    this.obj < n,
    function () { return 'expected ' + inspect(self.obj) + ' to be below ' + n; },
    function () { return 'expected ' + inspect(self.obj) + ' to be above ' + n; }
  );
};

Assertion.prototype.match = function (regexp) {
  var self = this;
  return this.assert(
    regexp.exec(this.obj) != null,
    function () { return 'expected ' + inspect(self.obj) + ' to match ' + regexp; },
    function () { return 'expected ' + inspect(self.obj) + ' not to match ' + regexp; }
  );
};

Assertion.prototype.contain = function (obj) {
  var self = this, ok;
  if (typeof this.obj === 'string') {
    ok = this.obj.indexOf(obj) !== -1;
  } else {
    ok = this.obj.indexOf(obj) !== -1;
  }
  return this.assert(
    ok,
    function () { return 'expected ' + inspect(self.obj) + ' to contain ' + inspect(obj); },
    function () { return 'expected ' + inspect(self.obj) + ' to not contain ' + inspect(obj); }
  );
};

Assertion.prototype.length = function (n) {
  var self = this, len = this.obj ? this.obj.length : undefined;
  return this.assert(
    n == len,
    function () { return 'expected ' + inspect(self.obj) + ' to have a length of ' + n + ' but got ' + len; },
    function () { return 'expected ' + inspect(self.obj) + ' to not have a length of ' + len; }
  );
};

Assertion.prototype.property = function (name) {
  var self = this, hasProp;
  try {
    hasProp = name in Object(this.obj);
  } catch (e) {
    hasProp = this.obj[name] !== undefined;
  }
  this.assert(
    hasProp,
    function () { return 'expected ' + inspect(self.obj) + ' to have a property ' + inspect(name); },
    function () { return 'expected ' + inspect(self.obj) + ' to not have a property ' + inspect(name); }
  );
  // expect.js drills the subject into the property value after the assertion.
  this.obj = this.obj == null ? undefined : this.obj[name];
  return this;
};

Assertion.prototype.throwError = Assertion.prototype.throwException = function (fn) {
  if (typeof this.obj !== 'function') {
    throw new Error('expected ' + inspect(this.obj) + ' to be a function');
  }

  var thrown = false, not = this._not;

  try {
    this.obj();
  } catch (e) {
    if (typeof fn === 'function') {
      // Run the callback for side effects; its own inner expect(...) throws
      // bubble out (they are NOT re-caught here). Return value is ignored.
      fn(e);
    } else if (fn && typeof fn === 'object') {
      // RegExp matcher against the thrown error's message (or the raw value
      // when a string was thrown).
      var subject = typeof e === 'string' ? e : e.message;
      if (not) {
        if (subject != null && fn.exec(subject) != null) {
          throw new Error('expected "' + subject + '" not to match ' + fn);
        }
      } else if (subject == null || fn.exec(subject) == null) {
        throw new Error('expected "' + subject + '" to match ' + fn);
      }
    }
    // A string `fn` is intentionally ignored (expect.js@0.2.0 behavior).
    thrown = true;
  }

  // With a matcher present, `not` applies only to the match, not to whether
  // it threw — so the final thrown-assertion runs un-negated in that case.
  if (fn && typeof fn === 'object' && not) {
    not = false;
  }

  var ok = not ? !thrown : thrown;
  if (!ok) {
    var name = this.obj.name || 'fn';
    throw new Error(not
      ? 'expected ' + name + ' not to throw an exception'
      : 'expected ' + name + ' to throw an exception');
  }
};

// Chainable getters. `to` / `have` are pure passthroughs; `not` flips the
// negation flag; `be` is dual — a passthrough getter that is ALSO callable as
// the strict-equal matcher, with the type/truthiness/ordering matchers hung
// off it (so `.be.a(...)`, `.be.ok()`, `.be(x)` all resolve).
function passthrough() { return this; }

Object.defineProperty(Assertion.prototype, 'to', { get: passthrough });
Object.defineProperty(Assertion.prototype, 'have', { get: passthrough });

Object.defineProperty(Assertion.prototype, 'not', {
  get: function () { this._not = true; return this; }
});

Object.defineProperty(Assertion.prototype, 'be', {
  get: function () {
    var self = this;
    var beFn = function (obj) { return self.equal(obj); };
    beFn.a = function (type) { return self.a(type); };
    beFn.an = function (type) { return self.an(type); };
    beFn.ok = function () { return self.ok(); };
    beFn.greaterThan = function (n) { return self.greaterThan(n); };
    beFn.above = function (n) { return self.above(n); };
    beFn.lessThan = function (n) { return self.lessThan(n); };
    beFn.below = function (n) { return self.below(n); };
    return beFn;
  }
});

function expect(obj) {
  return new Assertion(obj);
}

expect.eql = eql;

module.exports = expect;
