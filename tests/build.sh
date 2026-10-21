#!/usr/bin/env bash
# Build the site into _site/ using the al-folio:latest docker image.
#   bash tests/build.sh          # development build (no minification)
#   bash tests/build.sh --prod   # JEKYLL_ENV=production, as deployed (jekyll-minifier on)
set -euo pipefail
cd "$(dirname "$0")/.."
env_args=()
case "${1:-}" in
  --prod) env_args=(-e JEKYLL_ENV=production) ;;
  "") ;;
  *) echo "usage: $0 [--prod]" >&2; exit 2 ;;
esac
docker run --rm --user "$(id -u):$(id -g)" -e HOME=/tmp "${env_args[@]}" -v "$PWD:/srv/jekyll" al-folio:latest \
  bundle exec jekyll build
test -f _site/index.html
