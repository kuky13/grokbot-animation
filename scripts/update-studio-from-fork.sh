#!/usr/bin/env bash
set -euo pipefail

repo=/opt/grokbot-animation
cd "$repo"
[[ "$(git branch --show-current)" == main ]] || { echo 'Studio is not on main' >&2; exit 1; }
[[ -z "$(git status --porcelain)" ]] || { echo 'Studio checkout is dirty; refusing update' >&2; exit 1; }
git fetch --quiet kuky main
[[ "$(git rev-parse HEAD)" != "$(git rev-parse FETCH_HEAD)" ]] || exit 0
stage=$(mktemp -d)
cleanup() { git worktree remove --force "$stage/checkout" 2>/dev/null || true; rm -rf "$stage"; }
trap cleanup EXIT
git worktree add --quiet --detach "$stage/checkout" FETCH_HEAD
(cd "$stage/checkout" && npm test >/tmp/studio-last-deploy-test.log 2>&1)
git merge --ff-only FETCH_HEAD
curl --fail --silent --show-error http://127.0.0.1:4173/component/releases/latest.json >/dev/null
