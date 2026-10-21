.PHONY: install build lint fix test mutation check rehearse

node_modules/.install: package-lock.json
	npm ci
	@touch node_modules/.install

install: node_modules/.install

build: node_modules/.install
	npm run build

# invariant: the Publish (packaging) pass of the check reads dist/.
lint: build
	npm run lint

fix: node_modules/.install
	npx typescript fix

# invariant: the specs install the tarball npm pack writes from dist/.
test: build
	npm test

mutation: build
	npx typescript mutation

check: lint test mutation

# outside: needs docker and the network; `check` never calls it, and a release runs it on its commit before the tag.
rehearse: node_modules/.install
	npx typescript rehearse $(REHEARSE_ARGS)
