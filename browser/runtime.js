var swig = require('../lib/runtime'),
  root = (typeof globalThis !== 'undefined') ? globalThis :
    (typeof self !== 'undefined') ? self :
      (typeof window !== 'undefined') ? window : this;

if (typeof root.define === 'function' && typeof root.define.amd === 'object') {
  root.define('swig', [], function () {
    return swig;
  });
}

// Also expose the global under AMD: a bundle emitted by
// `swig compile --recursive --register` self-registers against the global,
// and an AMD-only export would leave those templates unregistered. Keep an
// engine that is already present, so loading this script twice — or loading
// it after the full build — does not replace an instance that already holds
// registrations.
if (!root.swig) {
  root.swig = swig;
}
