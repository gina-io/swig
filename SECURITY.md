# Security Policy

`@rhinostone/swig` is a maintained continuation of the abandoned `swig` template engine.
Because the original project is unmaintained, security fixes land here — including issues the
upstream advisories never patched. This policy covers the whole published family:
`@rhinostone/swig`, `@rhinostone/swig-core`, `@rhinostone/swig-twig`,
`@rhinostone/swig-jinja2`, and `@rhinostone/swig-django`.

## Supported versions

Security updates are provided for the latest `2.x` release line. Older lines are not
backported — upgrade to the current release. All packages release in lockstep, so a
security fix ships across the family at the same version.

| Version            | Supported          |
| ------------------ | ------------------ |
| `2.7.x` (latest)   | :white_check_mark: |
| `< 2.7.0`          | :x: — upgrade      |

## Reporting a vulnerability

**Please report security issues privately — do not open a public issue or PR.**

Use GitHub's private vulnerability reporting:

1. Open the [Security tab](https://github.com/gina-io/swig/security) of `gina-io/swig`.
2. Click **Report a vulnerability** (direct link:
   <https://github.com/gina-io/swig/security/advisories/new>).
3. Include the affected package and version, a description of the issue, and a minimal
   reproduction if you have one.

If you are unable to use private reporting, email `martinluther@gina.io` with
`[swig security]` in the subject line.

## Response targets

- **Acknowledgement** — within 3 business days.
- **Triage and severity assessment** — within 7 business days.
- **Fix and coordinated disclosure** — timeline scales with severity and complexity; we
  keep you updated and credit you (with your consent) in the published advisory.

## Scope

Swig compiles template *source* into JavaScript, so **template source is trusted** — an
application that renders attacker-controlled template source is exposed to server-side
template injection by design, as with every server-side template engine. The security
boundary is the template *context* (the `locals` data passed at render time).

In scope: untrusted **data** reaching a sensitive sink (a filesystem path, a prototype-chain
property, etc.). Generally out of scope: issues that require the attacker to control the
template source itself. When in doubt, report it — we would rather triage than miss
something.
