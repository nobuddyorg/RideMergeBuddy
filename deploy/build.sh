#!/usr/bin/env bash
# Builds a single deployable jar: Angular production build copied into
# Spring Boot's static resources, then a normal Gradle build.
#
# Prerequisite: src/main/resources/.secrets must already exist (see README.adoc)
# -- it gets baked into the jar, which is how Secrets.groovy expects to load it.
set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -f src/main/resources/.secrets ]; then
  echo "Missing src/main/resources/.secrets - create it first (see README.adoc)." >&2
  exit 1
fi

echo "==> Building Angular frontend"
(cd web-app && npm install && npx ng build)

STATIC_DIR="src/main/resources/static"
rm -rf "$STATIC_DIR"
mkdir -p "$STATIC_DIR"
cp -r web-app/dist/web-app/. "$STATIC_DIR/"

echo "==> Building Spring Boot jar"
./gradlew clean build -x test

echo "==> Done: build/libs/activitymerger-0.1.jar"
