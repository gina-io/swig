VERSION_REGEX = [0-9][0-9]*\.[0-9][0-9]*\.[0-9][0-9]*[^\" ]*
VERSION := $(shell npm ls | grep "swig@" |  grep -Eo "${VERSION_REGEX}" -m 1)

TMP = 'tmp'
BIN = node_modules/.bin
PWD = $(shell pwd | sed -e 's/[\/&]/\\&/g')

all:
	@echo "Installing packages"
	@npm install --depth=100 --loglevel=error
	@npm link &>/dev/null
	@cp scripts/githooks/* .git/hooks/
	@chmod -R +x .git/hooks/

.INTERMEDIATE version: \
	browser/comments.js

version:
	@sed -i.bak 's/exports\.version = "${VERSION_REGEX}"/exports.version = "${VERSION}"/' lib/swig.js
	@rm lib/swig.js.bak
	@sed -i.bak 's/exports\.version = "${VERSION_REGEX}"/exports.version = "${VERSION}"/' lib/runtime.js
	@rm lib/runtime.js.bak

browser/comments.js: FORCE
	@sed -i.bak 's/v${VERSION_REGEX}/v${VERSION}/' $@
	@rm $@.bak

.SECONDARY dist/swig.js: \
	browser/comments.js

.SECONDARY dist/swig.min.js: \
	dist/swig.js

.SECONDARY dist/swig.runtime.js: \
	browser/comments.js

.SECONDARY dist/swig.runtime.min.js: \
	dist/swig.runtime.js

.INTERMEDIATE browser/test/tests.js: \
	tests/comments.test.js \
	tests/filters.test.js \
	tests/tags.test.js \
	tests/variables.test.js \
	tests/tags/autoescape.test.js \
	tests/tags/else.test.js \
	tests/tags/filter.test.js \
	tests/tags/for.test.js \
	tests/tags/if.test.js \
	tests/tags/macro.test.js \
	tests/tags/raw.test.js \
	tests/tags/set.test.js \
	tests/tags/spaceless.test.js \
	tests/basic.test.js

clean: FORCE
	@rm -rf dist
	@rm -rf ${TMP}

build: clean dist dist/swig.min.js dist/swig.runtime.min.js
	@echo "Built to ./dist/"

dist:
	@mkdir -p $@

dist/swig.js:
	@echo "Building $@..."
	@cat $^ > $@
	@${BIN}/esbuild browser/index.js --bundle --format=iife \
		--alias:fs=./browser/stubs/fs.js --alias:path=path-browserify >> $@

dist/swig.min.js:
	@echo "Building $@..."
	@${BIN}/terser $^ --comments -c -m --source-map "url=swig.min.js.map" -o $@

dist/swig.runtime.js:
	@echo "Building $@..."
	@cat $^ > $@
	@${BIN}/esbuild browser/runtime.js --bundle --format=iife \
		--alias:fs=./browser/stubs/fs.js --alias:path=path-browserify >> $@

dist/swig.runtime.min.js:
	@echo "Building $@..."
	@${BIN}/terser $^ --comments -c -m --source-map "url=swig.runtime.min.js.map" -o $@

browser/test/tests.js:
	@echo "Building $@..."
	@cat $^ > tests/browser.js
	@perl -pi -e 's/\.\.\/\.\.\/lib/\.\.\/lib/g' tests/browser.js
	@${BIN}/esbuild tests/browser.js --bundle --format=iife \
		--alias:fs=./browser/stubs/fs.js --alias:path=path-browserify > $@
	@rm tests/browser.js

tests := $(shell find ./tests -name '*.test.js' ! -path "*node_modules/*")
reporter = dot
opts =
test:
	@node --require ./tests/lib/mocha-compat.js --test-reporter=${reporter} ${opts} --test ${tests}

files := $(shell find . -name '*.js' ! -path "./node_modules/*" ! -path "./dist/*" ! -path "./browser*" ! -path "./docs*" ! -path "./tmp*")
lint:
	@${BIN}/eslint ${files}

coverage:
	@node --require ./tests/lib/mocha-compat.js --test --experimental-test-coverage --test-coverage-include='lib/**' --test-coverage-lines=95 ${opts} ${tests}

FORCE:

.PHONY: all version \
	build \
	test lint coverage
