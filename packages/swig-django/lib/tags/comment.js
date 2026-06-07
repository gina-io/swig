/*!
 * Django `{% comment %}…{% endcomment %}` tag.
 *
 *   {% comment %}…{% endcomment %}
 *   {% comment "optional note" %}…{% endcomment %}
 *
 * Discards everything between the tags. The content is NOT parsed — like
 * `{% verbatim %}`, the splitter flips its `inRaw` flag on the `comment` tag
 * name (cleared on `{% endcomment %}`), so `{{ … }}` / `{% … %}` inside a
 * comment are captured as raw text rather than parsed. That makes
 * `{% comment %}{% some_broken_tag %}{% endcomment %}` safe — the body never
 * reaches the parser. compile then throws the captured content away, so the
 * comment renders nothing.
 *
 * An optional note after `comment` (Django allows `{% comment "why" %}`) is
 * accepted and ignored.
 */

var ir = require('@rhinostone/swig-core/lib/ir');

exports.ends = true;
exports.block = false;

/**
 * Accept the comment tag. Any argument (the optional note) is ignored —
 * Django places no constraint on it.
 *
 * @return {boolean} Always `true`.
 */
exports.parse = function () {
  return true;
};

/**
 * Emit nothing. The captured content (raw text, since the body was in the
 * splitter's `inRaw` mode) is intentionally discarded.
 *
 * @return {object} An empty IRLegacyJS node.
 */
exports.compile = function () {
  return ir.legacyJS('');
};
