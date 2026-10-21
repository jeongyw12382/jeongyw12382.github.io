#!/usr/bin/env bash
# Build the site into _site/ using the al-folio:latest docker image.
set -euo pipefail
cd "$(dirname "$0")/.."
docker run --rm --user "$(id -u):$(id -g)" -e HOME=/tmp -v "$PWD:/srv/jekyll" al-folio:latest \
  bundle exec jekyll build
test -f _site/index.html
