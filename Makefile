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
	@sed -i.bak 's/${VERSION_REGEX}/${VERSION}/' lib/swig.js
	@rm lib/swig.js.bak

browser/comments.js: FORCE
	@sed -i.bak 's/v${VERSION_REGEX}/v${VERSION}/' $@
	@rm $@.bak

.SECONDARY dist/swig.js: \
	browser/comments.js

.SECONDARY dist/swig.min.js: \
	dist/swig.js

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

build: clean dist dist/swig.min.js
	@echo "Built to ./dist/"

dist:
	@mkdir -p $@

dist/swig.js:
	@echo "Building $@..."
	@cat $^ > $@
	@${BIN}/browserify browser/index.js >> $@

dist/swig.min.js:
	@echo "Building $@..."
	@${BIN}/terser $^ --comments -c -m --source-map "url=swig.js.map" -o $@

browser/test/tests.js:
	@echo "Building $@..."
	@cat $^ > tests/browser.js
	@perl -pi -e 's/\.\.\/\.\.\/lib/\.\.\/lib/g' tests/browser.js
	@${BIN}/browserify tests/browser.js > $@
	@rm tests/browser.js

tests := $(shell find ./tests -name '*.test.js' ! -path "*node_modules/*")
reporter = dot
opts =
test:
	@node node_modules/mocha/bin/_mocha --check-leaks --reporter ${reporter} ${opts} ${tests}

test-browser: FORCE clean browser/test/tests.js
	@${BIN}/mocha-phantomjs browser/test/index.html --reporter ${reporter}

files := $(shell find . -name '*.js' ! -path "./node_modules/*" ! -path "./dist/*" ! -path "./browser*" ! -path "./docs*" ! -path "./tmp*")
lint:
	@${BIN}/eslint ${files}

out = tests/coverage.html
cov-reporter = html-cov
coverage:
ifeq (${cov-reporter}, travis-cov)
	@${BIN}/mocha ${opts} ${tests} --require blanket -R ${cov-reporter}
else
	@${BIN}/mocha ${opts} ${tests} --require blanket -R ${cov-reporter} > ${out}
	@sed -i .bak -e "s/${PWD}//g" ${out}
	@rm ${out}.bak
	@echo
	@echo "Built Report to ${out}"
	@echo
endif

FORCE:

.PHONY: all version \
	build \
	test test-browser lint coverage
