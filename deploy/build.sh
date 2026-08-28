#!/usr/bin/env bash
# Builds the deployable backend jar. The Angular frontend is deployed
# separately to GitHub Pages (see .github/workflows/pages.yml) and is not
# bundled in here.
#
# Prerequisite: src/main/resources/.secrets must already exist (see README.adoc)
# -- it gets baked into the jar, which is how Secrets.groovy expects to load it.
set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -f src/main/resources/.secrets ]; then
  echo "Missing src/main/resources/.secrets - create it first (see README.adoc)." >&2
  exit 1
fi

echo "==> Building Spring Boot jar"
# bootJar (not build/assemble) deliberately skips openApiGenerate's docs
# chain, which boots the whole app mid-build just to scrape its own
# OpenAPI JSON - unnecessary and fragile for a deploy, not needed to
# produce the runnable jar.
./gradlew clean bootJar

echo "==> Done: build/libs/activitymerger-0.1.jar"
