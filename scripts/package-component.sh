#!/bin/sh
set -eu

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
repo_dir=$(CDPATH= cd -- "$script_dir/.." && pwd)
stage_dir=$(mktemp -d)
bundle_dir="$stage_dir/morph-bot"
output_dir="$repo_dir/component/downloads"
component_version=$(node -p "require('$repo_dir/component/package.json').version")
output_file="$output_dir/morph-bot-element-$component_version.zip"
latest_file="$output_dir/drippy-complete-latest.zip"
checksum_file="$output_dir/morph-bot-element-$component_version.zip.sha256"

cleanup() {
  rm -r "$stage_dir"
}
trap cleanup EXIT INT TERM

mkdir -p "$bundle_dir" "$output_dir"
cp \
  "$repo_dir/component/morph-bot.js" \
  "$repo_dir/component/grok-bot-engine.js" \
  "$repo_dir/component/original-data.js" \
  "$repo_dir/component/catalog.js" \
  "$repo_dir/component/materials.js" \
  "$repo_dir/component/morph-bot.d.ts" \
  "$repo_dir/component/materials.d.ts" \
  "$repo_dir/component/README.md" \
  "$repo_dir/component/DRIPPY-COMPONENTS.md" \
  "$repo_dir/component/package.json" \
  "$bundle_dir/"
cp -R "$repo_dir/component/runtime" "$bundle_dir/runtime"

cd "$stage_dir"
zip -q -r "$output_file" morph-bot
cp "$output_file" "$latest_file"
sha256sum "$output_file" | sed "s#  .*#  morph-bot-element-$component_version.zip#" > "$checksum_file"
echo "$output_file"
echo "$latest_file"
