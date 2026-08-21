#!/bin/sh
set -eu

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
repo_dir=$(CDPATH= cd -- "$script_dir/.." && pwd)
output_dir="$repo_dir/dist"

if [ -d "$output_dir" ]; then
  rm -r "$output_dir"
fi

mkdir -p "$output_dir"
cp \
  "$repo_dir/index.html" \
  "$repo_dir/styles.css" \
  "$repo_dir/app.js" \
  "$repo_dir/grok-bot-engine.js" \
  "$repo_dir/original-data.js" \
  "$repo_dir/catalog.js" \
  "$repo_dir/ANALYSIS.md" \
  "$repo_dir/ARCHITECTURE.md" \
  "$repo_dir/README.md" \
  "$output_dir/"
cp -R "$repo_dir/component" "$output_dir/component"

echo "$output_dir"
