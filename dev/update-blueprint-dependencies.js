'use strict';

function usage() {
  console.log(`This script updates the dependencies / devDependencies in the main addon and app blueprints along with their corresponding test fixtures.

Options:

  - '--ember-source' (required) - The dist-tag to use for ember-source
  - '--ember-data' (required) - The dist-tag to use for ember-data

Example:

node dev/update-blueprint-dependencies.js --ember-source=beta --ember-data=beta
`);
}

const fs = require('fs');
const util = require('util');
const nopt = require('nopt');
const _latestVersion = require('latest-version');

const OPTIONS = nopt({
  'ember-source': String,
  'ember-data': String,
});

const PACKAGE_FILES = [
  'blueprints/app/files/package.json',
  'blueprints/addon/additional-dev-dependencies.json',
  'tests/fixtures/app/npm/package.json',
  'tests/fixtures/app/yarn/package.json',
  'tests/fixtures/addon/yarn/package.json',
  'tests/fixtures/addon/npm/package.json',
];

const LATEST = new Map();
async function latestVersion(packageName) {
  let result = LATEST.get(packageName);

  if (result === undefined) {
    let options = {
      version: 'latest',
    };

    if (OPTIONS[packageName]) {
      options.version = OPTIONS[packageName];
    }

    result = _latestVersion(packageName, options);
    LATEST.set(packageName, result);
  }

  return result;
}

async function updateDependencies(dependencies) {
  for (let dependency in dependencies) {
    let previousValue = dependencies[dependency];

    // grab the first char (~ or ^)
    let prefix = previousValue[0];
    let isValidPrefix = prefix === '~' || prefix === '^';

    // handle things from blueprints/app/files/package.json like `^2.4.0<% if (welcome) { %>`
    let templateSuffix = previousValue.includes('<') ? previousValue.slice(previousValue.indexOf('<')) : '';

    // check if we are dealing with `~<%= emberCLIVersion %>`
    let hasVersion = previousValue[1] !== '<';

    if (hasVersion && isValidPrefix) {
      dependencies[dependency] = `${prefix}${await latestVersion(dependency)}${templateSuffix}`;
    }
  }
}

async function main() {
  for (let packageFile of PACKAGE_FILES) {
    let pkg = JSON.parse(fs.readFileSync(packageFile, { encoding: 'utf8' }));

    await updateDependencies(pkg.dependencies);
    await updateDependencies(pkg.devDependencies);

    let output = `${JSON.stringify(pkg, null, 2)}\n`;

    fs.writeFileSync(packageFile, output, { encoding: 'utf8' });
  }
}

if (module === require.main) {
  // ensure promise rejection is a failure
  process.on('unhandledRejection', (error) => {
    if (!(error instanceof Error)) {
      error = new Error(`Promise rejected with value: ${util.inspect(error)}`);
    }

    console.error(error.stack);

    /* eslint-disable-next-line no-process-exit */
    process.exit(1);
  });

  if (!OPTIONS['ember-source'] || !OPTIONS['ember-data']) {
    usage();
    process.exitCode = 1;
    return;
  }

  main();
}
