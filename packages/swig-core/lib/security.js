/**
 * Template-source property access blocklist for CVE-2023-25345.
 *
 * Any identifier that matches this list is rejected at parse time by
 * parser.js, tags/set.js, tags/for.js, tags/macro.js, and tags/import.js.
 * The list covers read access (`{{ __proto__ }}` / `{{ foo.__proto__ }}`
 * / `{{ foo["__proto__"] }}`), write access (`{% set __proto__ = ... %}`
 * / `{% set foo["__proto__"] = ... %}`), loop variables
 * (`{% for __proto__ in items %}`), macro names (`{% macro __proto__() %}`),
 * and import aliases (`{% import "f" as __proto__ %}`).
 *
 * Kept as a shared constant so any future tag that assigns to `_ctx.*`
 * or otherwise exposes an identifier as a property key picks up the
 * full blocklist without drift across copies.
 *
 * See .claude/security.md for the full attack-vector table and the
 * tags/parser checkpoints that consume this list.
 */

/**
 * Property names that must never reach `_ctx.<name>` or be accessed
 * via dot / string-bracket notation from template source.
 * @type {string[]}
 */
exports.dangerousProps = ['__proto__', 'constructor', 'prototype'];
