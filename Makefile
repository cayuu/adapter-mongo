REPORTER = spec

build: lint test

install:
	@echo "Installing production"
	@npm install --production
	@echo "Install complete"

lint: lib/mongo.js
	@echo "\n\n\nLinting.."
	@jshint --config .jshintrc lib/*.js

test:
	@echo "Testing.."
	@NODE_ENV=test ./node_modules/.bin/mocha \
		--reporter $(REPORTER) \
		test/runner.js

coverage:
	@echo "Generating coverage report.."
	@NODE_ENV=test ./node_modules/.bin/mocha \
		--require blanket \
		test/runner.js \
		--reporter html-cov > coverage.html
	@echo "Done: ./coverage.html"


.PHONY: test
