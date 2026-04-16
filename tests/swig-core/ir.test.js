var ir = require('@rhinostone/swig-core/lib/ir'),
  expect = require('expect.js');


/*!
 * Schema acceptance tests for the Phase 2 IR factory surface.
 *
 * Every factory must:
 *   1. Set a stable `type` discriminator (statement nodes) or the
 *      documented shape (helper / expression nodes).
 *   2. Pass through required fields verbatim.
 *   3. Only attach optional fields when the caller supplied them.
 *   4. Attach `loc` only when provided, so consumers can distinguish
 *      "no source location" from an explicit zero-valued one.
 *
 * The gate is pure-data: no behavior change, no codegen, no round-trip
 * against the backend. Acts as the schema's lock-in before any
 * frontend starts producing IR. See
 * .claude/architecture/multi-flavor-ir.md § Phase 2 for the migration
 * sequence and .claude/conventions.md § 14 for the carve-cadence rules.
 */
describe('swig-core/lib/ir — node factories', function () {

  var sampleLoc = { line: 7, column: 3, filename: 'templates/home.html' };

  /* -- Statement factories ---------------------------------------- */

  describe('template()', function () {
    it('emits a Template root with only the required fields when optional args are omitted', function () {
      var body = [{ type: 'Text', value: 'hello' }];
      var node = ir.template(body);
      expect(node).to.eql({ type: 'Template', body: body });
      expect(node.hasOwnProperty('parent')).to.be(false);
      expect(node.hasOwnProperty('blocks')).to.be(false);
      expect(node.hasOwnProperty('loc')).to.be(false);
    });

    it('carries parent, blocks, and loc when provided', function () {
      var body = [];
      var blocks = { content: { type: 'Block', name: 'content', body: [] } };
      var node = ir.template(body, 'layout.html', blocks, sampleLoc);
      expect(node.type).to.be('Template');
      expect(node.parent).to.be('layout.html');
      expect(node.blocks).to.be(blocks);
      expect(node.loc).to.be(sampleLoc);
    });
  });

  describe('text()', function () {
    it('emits a Text node with the given value', function () {
      expect(ir.text('raw content')).to.eql({ type: 'Text', value: 'raw content' });
    });

    it('preserves the empty-string value explicitly', function () {
      var node = ir.text('');
      expect(node.type).to.be('Text');
      expect(node.value).to.be('');
    });

    it('attaches loc when provided', function () {
      expect(ir.text('hi', sampleLoc).loc).to.be(sampleLoc);
    });
  });

  describe('output()', function () {
    it('emits an Output node carrying the bare expression when no filters or safe flag are given', function () {
      var expr = ir.varRef(['user', 'name']);
      var node = ir.output(expr);
      expect(node).to.eql({ type: 'Output', expr: expr });
      expect(node.hasOwnProperty('filters')).to.be(false);
      expect(node.hasOwnProperty('safe')).to.be(false);
    });

    it('carries a filter chain and safe flag when supplied', function () {
      var expr = ir.varRef(['x']);
      var filters = [ir.filterCall('upper')];
      var node = ir.output(expr, filters, true, sampleLoc);
      expect(node.filters).to.be(filters);
      expect(node.safe).to.be(true);
      expect(node.loc).to.be(sampleLoc);
    });

    it('records safe=false distinctly from safe omitted', function () {
      var withFlag = ir.output(ir.varRef(['x']), undefined, false);
      expect(withFlag.hasOwnProperty('safe')).to.be(true);
      expect(withFlag.safe).to.be(false);
    });
  });

  describe('filterCall()', function () {
    it('produces a helper shape with no `type` field (not a statement)', function () {
      var node = ir.filterCall('upper');
      expect(node).to.eql({ name: 'upper' });
      expect(node.hasOwnProperty('type')).to.be(false);
    });

    it('carries args when supplied', function () {
      var args = [ir.literal('number', 2)];
      expect(ir.filterCall('round', args).args).to.be(args);
    });
  });

  describe('ifStmt() / ifBranch()', function () {
    it('ifBranch emits { test, body } with no type tag', function () {
      var branch = ir.ifBranch(ir.literal('bool', true), []);
      expect(branch.test.type).to.be('Literal');
      expect(branch.body).to.eql([]);
      expect(branch.hasOwnProperty('type')).to.be(false);
    });

    it('ifBranch accepts test=null for the trailing else', function () {
      var branch = ir.ifBranch(null, []);
      expect(branch.test).to.be(null);
    });

    it('ifStmt emits { type: "If", branches }', function () {
      var branches = [ir.ifBranch(ir.varRef(['x']), []), ir.ifBranch(null, [])];
      var node = ir.ifStmt(branches, sampleLoc);
      expect(node.type).to.be('If');
      expect(node.branches).to.be(branches);
      expect(node.loc).to.be(sampleLoc);
    });

    it('ifBranch stores test opaquely (factory does not inspect)', function () {
      var branch = ir.ifBranch('(_ctx.x !== null) ? _ctx.x : ""', []);
      expect(branch.test).to.be('(_ctx.x !== null) ? _ctx.x : ""');
      expect(branch.test).to.be.a('string');
    });

    it('ifStmt preserves whatever test value the factory received', function () {
      var branches = [ir.ifBranch('_ctx.x', [ir.legacyJS('_output += "A";\n')])];
      var node = ir.ifStmt(branches);
      expect(node.type).to.be('If');
      expect(node.branches[0].test).to.be('_ctx.x');
      expect(node.branches[0].body[0].type).to.be('LegacyJS');
    });

    it('ifBranch accepts IRLegacyJS as the test (filter-in-test fallback)', function () {
      // Phase 2 Session 14b Commit 11: per-operand filter precedence in
      // the test expression can't be represented in flat IR, so the
      // native if tag wraps the legacy JS-source fragment in IRLegacyJS
      // instead of handing the backend a raw string.
      var branch = ir.ifBranch(ir.legacyJS('"0+3+1" === _filters.reverse(_filters.join(_ctx.getFoo("f"), "+"))'), []);
      expect(branch.test).to.be.an('object');
      expect(branch.test.type).to.be('LegacyJS');
      expect(branch.test.js).to.contain('_filters.reverse');
    });
  });

  describe('forStmt()', function () {
    it('emits a For node with value + iterable + body', function () {
      var iter = ir.varRef(['items']);
      var body = [ir.text('row')];
      var node = ir.forStmt('item', iter, body);
      expect(node).to.eql({ type: 'For', value: 'item', iterable: iter, body: body });
      expect(node.hasOwnProperty('key')).to.be(false);
      expect(node.hasOwnProperty('emptyBody')).to.be(false);
    });

    it('carries key (second binding) and emptyBody when provided', function () {
      var iter = ir.varRef(['map']);
      var body = [];
      var emptyBody = [ir.text('empty')];
      var node = ir.forStmt('v', iter, body, 'k', emptyBody);
      expect(node.key).to.be('k');
      expect(node.emptyBody).to.be(emptyBody);
    });

    it('accepts a transitional string iterable (Phase 2)', function () {
      var node = ir.forStmt('item', '(typeof _ctx.items !== "undefined") ? _ctx.items : []', []);
      expect(node.iterable).to.be('(typeof _ctx.items !== "undefined") ? _ctx.items : []');
      expect(node.iterable).to.be.a('string');
      expect(node.type).to.be('For');
    });

    it('stores iterable opaquely without inspection (Phase 2 transitional)', function () {
      var node = ir.forStmt('v', '_ctx.arr', [ir.legacyJS('_output += "x";')], 'k');
      expect(node.iterable).to.be('_ctx.arr');
      expect(node.value).to.be('v');
      expect(node.key).to.be('k');
      expect(node.body[0].type).to.be('LegacyJS');
    });
  });

  describe('block()', function () {
    it('emits a Block node with name + body', function () {
      var body = [ir.text('default')];
      var node = ir.block('content', body);
      expect(node).to.eql({ type: 'Block', name: 'content', body: body });
    });
  });

  describe('include() / importStmt() / macro() / macroParam() / call()', function () {
    it('include: only required field is path', function () {
      var path = ir.literal('string', 'footer.html');
      var node = ir.include(path);
      expect(node).to.eql({ type: 'Include', path: path });
    });

    it('include: context + isolated + loc when supplied', function () {
      var path = ir.literal('string', 'footer.html');
      var ctx = ir.objectLiteral([]);
      var node = ir.include(path, ctx, true, undefined, undefined, sampleLoc);
      expect(node.context).to.be(ctx);
      expect(node.isolated).to.be(true);
      expect(node.loc).to.be(sampleLoc);
    });

    it('include: accepts transitional string path + context (Phase 2)', function () {
      var node = ir.include('"footer.html"', '_utils.extend({}, _ctx, obj)');
      expect(node.path).to.be('"footer.html"');
      expect(node.context).to.be('_utils.extend({}, _ctx, obj)');
      expect(node.hasOwnProperty('isolated')).to.be(false);
      expect(node.hasOwnProperty('ignoreMissing')).to.be(false);
      expect(node.hasOwnProperty('resolveFrom')).to.be(false);
    });

    it('include: carries ignoreMissing + resolveFrom (Phase 2)', function () {
      var node = ir.include('"partial.html"', undefined, undefined, true, 'templates/home.html');
      expect(node.ignoreMissing).to.be(true);
      expect(node.resolveFrom).to.be('templates/home.html');
    });

    it('include: stores path and context opaquely without inspection (Phase 2 transitional)', function () {
      var node = ir.include('someVar', '_ctx', false, false, '');
      expect(node.path).to.be('someVar');
      expect(node.context).to.be('_ctx');
      expect(node.isolated).to.be(false);
      expect(node.ignoreMissing).to.be(false);
      expect(node.resolveFrom).to.be('');
    });

    it('importStmt: requires path + alias', function () {
      var path = ir.literal('string', 'forms.html');
      var node = ir.importStmt(path, 'forms');
      expect(node).to.eql({ type: 'Import', path: path, alias: 'forms' });
    });

    it('macro: captures name + params + body', function () {
      var params = [ir.macroParam('name'), ir.macroParam('size', ir.literal('number', 16))];
      var body = [ir.text('content')];
      var node = ir.macro('avatar', params, body);
      expect(node.type).to.be('Macro');
      expect(node.name).to.be('avatar');
      expect(node.params).to.be(params);
      expect(node.body).to.be(body);
    });

    it('macroParam: no default -> only name', function () {
      expect(ir.macroParam('name')).to.eql({ name: 'name' });
    });

    it('macroParam: with default -> uses `default` as a string key', function () {
      var defaultExpr = ir.literal('number', 16);
      var param = ir.macroParam('size', defaultExpr);
      expect(param.name).to.be('size');
      expect(param['default']).to.be(defaultExpr);
    });

    it('call: statement-level invocation', function () {
      var callee = ir.varRef(['forms', 'input']);
      var args = [ir.literal('string', 'email')];
      var node = ir.call(callee, args);
      expect(node).to.eql({ type: 'Call', callee: callee, args: args });
    });
  });

  describe('set() / raw() / parent()', function () {
    it('set: captures target + op + value', function () {
      var target = ir.varRef(['count']);
      var value = ir.literal('number', 0);
      var node = ir.set(target, '=', value);
      expect(node).to.eql({ type: 'Set', target: target, op: '=', value: value });
    });

    it('set: accepts transitional string target + value (Phase 2)', function () {
      var node = ir.set('_ctx.foo', '=', '"bar"');
      expect(node.target).to.be('_ctx.foo');
      expect(node.op).to.be('=');
      expect(node.value).to.be('"bar"');
    });

    it('set: carries compound assignment operators (Phase 2)', function () {
      var node = ir.set('_ctx.count', '+=', '1');
      expect(node.op).to.be('+=');
      expect(node.type).to.be('Set');
    });

    it('set: stores target and value opaquely without inspection (Phase 2 transitional)', function () {
      var node = ir.set('_ctx.obj["k"]', '=', '"v"');
      expect(node.target).to.be('_ctx.obj["k"]');
      expect(node.value).to.be('"v"');
    });

    it('set: accepts structured IRVarRef target for pure-dot LHS (Session 14b Commit 10)', function () {
      var target = ir.varRef(['foo', 'bar', 'baz']);
      var value = ir.literal('string', 'x');
      var node = ir.set(target, '=', value);
      expect(node.type).to.be('Set');
      expect(node.target).to.be(target);
      expect(node.target.type).to.be('VarRef');
      expect(node.target.path).to.eql(['foo', 'bar', 'baz']);
      expect(node.op).to.be('=');
      expect(node.value).to.be(value);
    });

    it('raw: captures verbatim value', function () {
      expect(ir.raw('{{ not a var }}').value).to.be('{{ not a var }}');
    });

    it('parent: empty marker node; carries only type', function () {
      var node = ir.parent();
      expect(node).to.eql({ type: 'Parent' });
    });

    it('parent: body slot stored when provided (Phase 2 transitional)', function () {
      var body = [ir.legacyJS('_output += "x";\n')];
      var node = ir.parent(body);
      expect(node).to.eql({ type: 'Parent', body: body });
    });

    it('parent: attaches loc when provided', function () {
      expect(ir.parent(undefined, sampleLoc).loc).to.be(sampleLoc);
    });
  });

  describe('autoescape() / filter()', function () {
    it('autoescape: captures strategy + body', function () {
      var body = [ir.text('hi')];
      var node = ir.autoescape('html', body);
      expect(node).to.eql({ type: 'Autoescape', strategy: 'html', body: body });
    });

    it('autoescape: accepts boolean strategies', function () {
      expect(ir.autoescape(true, []).strategy).to.be(true);
      expect(ir.autoescape(false, []).strategy).to.be(false);
    });

    it('filter: region pipe with name + body; args optional', function () {
      var body = [ir.text('x')];
      var node = ir.filter('upper', body);
      expect(node).to.eql({ type: 'Filter', name: 'upper', body: body });
    });

    it('filter: attaches args when provided', function () {
      var args = [ir.literal('string', ',')];
      expect(ir.filter('join', [], args).args).to.be(args);
    });

    it('filter: accepts transitional string-fragment args (Phase 2)', function () {
      var args = ['".", "!", "g"'];
      var node = ir.filter('replace', [], args);
      expect(node.args).to.be(args);
      expect(node.args[0]).to.be.a('string');
    });

    it('filter: accepts mixed IRExpr + string args during Phase 2', function () {
      var mixed = [ir.literal('string', ','), '", "arg2"'];
      var node = ir.filter('join', [], mixed);
      expect(node.args).to.be(mixed);
      expect(node.args.length).to.be(2);
    });
  });

  describe('withStmt()', function () {
    it('bare: captures body; omits context + isolated when absent', function () {
      var body = [ir.legacyJS('_output += "hi";\n')];
      var node = ir.withStmt(undefined, undefined, body);
      expect(node).to.eql({ type: 'With', body: body });
      expect(node.hasOwnProperty('context')).to.be(false);
      expect(node.hasOwnProperty('isolated')).to.be(false);
    });

    it('attaches context when provided; omits isolated when absent', function () {
      var ctx = ir.varRef(['scope']);
      var body = [ir.legacyJS('_output += "x";\n')];
      var node = ir.withStmt(ctx, undefined, body);
      expect(node.context).to.be(ctx);
      expect(node.body).to.be(body);
      expect(node.hasOwnProperty('isolated')).to.be(false);
    });

    it('attaches isolated=true + context; loc round-trips', function () {
      var ctx = ir.objectLiteral([
        ir.objectProperty(ir.literal('string', 'name'), ir.literal('string', 'gina'))
      ]);
      var body = [ir.text('scoped')];
      var node = ir.withStmt(ctx, true, body, sampleLoc);
      expect(node.type).to.be('With');
      expect(node.isolated).to.be(true);
      expect(node.context).to.be(ctx);
      expect(node.body).to.be(body);
      expect(node.loc).to.be(sampleLoc);
    });

    it('JSON round-trips a nested with + inner body', function () {
      var node = ir.withStmt(
        ir.varRef(['user']),
        false,
        [ir.output(ir.varRef(['user', 'name']))]
      );
      var round = JSON.parse(JSON.stringify(node));
      expect(round).to.eql(node);
    });
  });

  describe('legacyJS()', function () {
    it('emits a LegacyJS node carrying the raw JS fragment verbatim', function () {
      var node = ir.legacyJS('_output += "hi";\n');
      expect(node).to.eql({ type: 'LegacyJS', js: '_output += "hi";\n' });
    });

    it('preserves the empty-string js value explicitly', function () {
      var node = ir.legacyJS('');
      expect(node.type).to.be('LegacyJS');
      expect(node.js).to.be('');
    });

    it('does not attach loc when omitted', function () {
      expect(ir.legacyJS('x').hasOwnProperty('loc')).to.be(false);
    });

    it('attaches loc when provided', function () {
      expect(ir.legacyJS('x', sampleLoc).loc).to.be(sampleLoc);
    });
  });

  /* -- Expression factories --------------------------------------- */

  describe('literal()', function () {
    it('accepts each documented kind', function () {
      expect(ir.literal('string', 'hi').kind).to.be('string');
      expect(ir.literal('number', 42).kind).to.be('number');
      expect(ir.literal('bool', true).kind).to.be('bool');
      expect(ir.literal('null', null).kind).to.be('null');
      expect(ir.literal('undefined', undefined).kind).to.be('undefined');
    });

    it('preserves value verbatim including null and undefined', function () {
      expect(ir.literal('null', null).value).to.be(null);
      expect(ir.literal('undefined', undefined).value).to.be(undefined);
    });
  });

  describe('varRef()', function () {
    it('captures dot-path as a string array', function () {
      var node = ir.varRef(['user', 'profile', 'name']);
      expect(node).to.eql({ type: 'VarRef', path: ['user', 'profile', 'name'] });
    });

    it('single-segment path is valid', function () {
      expect(ir.varRef(['x']).path).to.eql(['x']);
    });
  });

  describe('access()', function () {
    it('captures object + key', function () {
      var obj = ir.varRef(['items']);
      var key = ir.literal('number', 0);
      expect(ir.access(obj, key)).to.eql({ type: 'Access', object: obj, key: key });
    });
  });

  describe('binaryOp() / unaryOp() / conditional()', function () {
    it('binaryOp: op + left + right', function () {
      var l = ir.varRef(['a']);
      var r = ir.literal('number', 1);
      expect(ir.binaryOp('+', l, r)).to.eql({ type: 'BinaryOp', op: '+', left: l, right: r });
    });

    it('unaryOp: op + operand', function () {
      var op = ir.varRef(['x']);
      expect(ir.unaryOp('!', op)).to.eql({ type: 'UnaryOp', op: '!', operand: op });
    });

    it('conditional: uses `else` as a string key (not reserved in object literals)', function () {
      var t = ir.varRef(['ok']);
      var a = ir.literal('string', 'yes');
      var b = ir.literal('string', 'no');
      var node = ir.conditional(t, a, b);
      expect(node.type).to.be('Conditional');
      expect(node.test).to.be(t);
      expect(node.then).to.be(a);
      expect(node['else']).to.be(b);
    });
  });

  describe('arrayLiteral() / objectLiteral() / objectProperty() / fnCall()', function () {
    it('arrayLiteral: elements', function () {
      var els = [ir.literal('number', 1), ir.literal('number', 2)];
      expect(ir.arrayLiteral(els)).to.eql({ type: 'ArrayLiteral', elements: els });
    });

    it('objectLiteral: properties', function () {
      var props = [ir.objectProperty(ir.literal('string', 'k'), ir.literal('number', 1))];
      expect(ir.objectLiteral(props)).to.eql({ type: 'ObjectLiteral', properties: props });
    });

    it('objectProperty: helper shape; no type tag', function () {
      var k = ir.literal('string', 'name');
      var v = ir.literal('string', 'x');
      var p = ir.objectProperty(k, v);
      expect(p).to.eql({ key: k, value: v });
      expect(p.hasOwnProperty('type')).to.be(false);
    });

    it('fnCall: callee + args', function () {
      var c = ir.varRef(['forms', 'input']);
      var args = [ir.literal('string', 'email')];
      expect(ir.fnCall(c, args)).to.eql({ type: 'FnCall', callee: c, args: args });
    });
  });

  describe('filterCallExpr()', function () {
    it('produces a FilterCall IRExpr with input, no args omitted', function () {
      var input = ir.varRef(['x']);
      var node = ir.filterCallExpr('upper', input);
      expect(node).to.eql({ type: 'FilterCall', name: 'upper', input: input });
      expect(node.hasOwnProperty('args')).to.be(false);
    });

    it('carries args when supplied', function () {
      var input = ir.varRef(['x']);
      var args = [ir.literal('string', ',')];
      var node = ir.filterCallExpr('join', input, args);
      expect(node.args).to.be(args);
    });

    it('is distinct from filterCall() helper shape', function () {
      var input = ir.varRef(['x']);
      var expr = ir.filterCallExpr('upper', input);
      var helper = ir.filterCall('upper');
      expect(expr.hasOwnProperty('type')).to.be(true);
      expect(helper.hasOwnProperty('type')).to.be(false);
      expect(expr.hasOwnProperty('input')).to.be(true);
      expect(helper.hasOwnProperty('input')).to.be(false);
    });
  });

  /* -- Loc attachment rule ---------------------------------------- */

  describe('loc attachment rule', function () {
    it('is omitted from every statement factory when not provided', function () {
      expect(ir.text('x').hasOwnProperty('loc')).to.be(false);
      expect(ir.output(ir.varRef(['x'])).hasOwnProperty('loc')).to.be(false);
      expect(ir.block('content', []).hasOwnProperty('loc')).to.be(false);
      expect(ir.set(ir.varRef(['x']), '=', ir.literal('number', 1)).hasOwnProperty('loc')).to.be(false);
      expect(ir.raw('x').hasOwnProperty('loc')).to.be(false);
      expect(ir.parent().hasOwnProperty('loc')).to.be(false);
    });

    it('is carried verbatim when provided to every statement factory', function () {
      var nodes = [
        ir.text('x', sampleLoc),
        ir.output(ir.varRef(['x']), undefined, undefined, sampleLoc),
        ir.ifStmt([], sampleLoc),
        ir.forStmt('v', ir.varRef(['xs']), [], undefined, undefined, sampleLoc),
        ir.block('b', [], sampleLoc),
        ir.include(ir.literal('string', 'p'), undefined, undefined, undefined, undefined, sampleLoc),
        ir.importStmt(ir.literal('string', 'p'), 'alias', sampleLoc),
        ir.macro('m', [], [], sampleLoc),
        ir.call(ir.varRef(['f']), [], sampleLoc),
        ir.set(ir.varRef(['x']), '=', ir.literal('number', 1), sampleLoc),
        ir.raw('x', sampleLoc),
        ir.parent(undefined, sampleLoc),
        ir.autoescape(true, [], sampleLoc),
        ir.filter('upper', [], undefined, sampleLoc),
        ir.template([], undefined, undefined, sampleLoc)
      ];
      nodes.forEach(function (node) {
        expect(node.loc).to.be(sampleLoc);
      });
    });

    it('is carried verbatim when provided to every expression factory', function () {
      var exprs = [
        ir.literal('number', 1, sampleLoc),
        ir.varRef(['x'], sampleLoc),
        ir.access(ir.varRef(['a']), ir.literal('string', 'b'), sampleLoc),
        ir.binaryOp('+', ir.varRef(['a']), ir.varRef(['b']), sampleLoc),
        ir.unaryOp('!', ir.varRef(['x']), sampleLoc),
        ir.conditional(ir.varRef(['ok']), ir.literal('number', 1), ir.literal('number', 0), sampleLoc),
        ir.arrayLiteral([], sampleLoc),
        ir.objectLiteral([], sampleLoc),
        ir.fnCall(ir.varRef(['f']), [], sampleLoc)
      ];
      exprs.forEach(function (node) {
        expect(node.loc).to.be(sampleLoc);
      });
    });
  });

  /* -- Serialisability -------------------------------------------- */

  describe('JSON serialisability', function () {
    it('round-trips a representative nested tree through JSON.stringify / JSON.parse', function () {
      var tree = ir.template(
        [
          ir.text('<h1>'),
          ir.output(
            ir.varRef(['user', 'name']),
            [ir.filterCall('upper')],
            false,
            sampleLoc
          ),
          ir.text('</h1>'),
          ir.legacyJS('_output += _ctx.legacyHelper();\n'),
          ir.ifStmt([
            ir.ifBranch(ir.binaryOp('>', ir.varRef(['count']), ir.literal('number', 0)), [
              ir.forStmt('item', ir.varRef(['items']), [ir.text('row')])
            ]),
            ir.ifBranch(null, [ir.text('empty')])
          ])
        ],
        'layout.html',
        { content: ir.block('content', []) }
      );
      var roundTripped = JSON.parse(JSON.stringify(tree));
      expect(roundTripped).to.eql(tree);
    });
  });

});
