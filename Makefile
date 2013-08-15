
build: lint run

install:
	@echo "Installing production"
	@npm install --production
	@echo "Install complete"

run:
	@echo "Running mongo-adapter"
	@NODE_ENV=production node lib/mongo.js

lint: lib/mongo.js
	@echo "\n\n\nLinting.."
	@jshint --config .jshintrc lib/*.js


.PHONY: build
