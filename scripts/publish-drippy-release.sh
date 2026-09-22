#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
REPO_DIR="$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)"
COMPONENT_DIR="$REPO_DIR/component"
RELEASE_DIR="$COMPONENT_DIR/releases"
VERSION="$(node -p "require('$COMPONENT_DIR/package.json').version")"
STAGE="$(mktemp -d)"
PACKAGE_ROOT="$STAGE/drippy"
BUNDLE="$STAGE/drippy-complete.zip"
SNAPSHOT="$PACKAGE_ROOT/drippy-idle.png"
HTTP_PID=""

cleanup() {
  if [[ -n "$HTTP_PID" ]]; then kill "$HTTP_PID" 2>/dev/null || true; fi
  rm -rf "$STAGE"
}
trap cleanup EXIT INT TERM

cd "$REPO_DIR"
npm test

mkdir -p "$PACKAGE_ROOT/runtime" "$RELEASE_DIR"

cp \
  "$COMPONENT_DIR/morph-bot.js" \
  "$COMPONENT_DIR/morph-bot.d.ts" \
  "$COMPONENT_DIR/grok-bot-engine.js" \
  "$COMPONENT_DIR/original-data.js" \
  "$COMPONENT_DIR/catalog.js" \
  "$COMPONENT_DIR/materials.js" \
  "$COMPONENT_DIR/materials.d.ts" \
  "$PACKAGE_ROOT/"
cp -a "$COMPONENT_DIR/runtime/." "$PACKAGE_ROOT/runtime/"

while IFS= read -r file; do
  node --check "$file" >/dev/null
done < <(find "$PACKAGE_ROOT" -type f \( -name '*.js' -o -name '*.mjs' \) | sort)

PORT="$(python3 - <<'PY'
import socket
s=socket.socket()
s.bind(('127.0.0.1',0))
print(s.getsockname()[1])
s.close()
PY
)"
cat > "$STAGE/index.html" <<'HTML'
<!doctype html>
<meta charset="utf-8">
<style>
html,body{margin:0;width:320px;height:320px;overflow:hidden;background:transparent}
body{display:grid;place-items:center}
morph-bot{display:block}
</style>
<morph-bot id="bot" size="320" state="idle" shape="blob" material="solid" color="#0b0b0b" eye-color="#ffffff" halo="off" thumbnail paused></morph-bot>
<script type="module" src="/drippy/morph-bot.js"></script>
HTML
(
  cd "$STAGE"
  python3 -m http.server "$PORT" --bind 127.0.0.1 >/dev/null 2>&1
) &
HTTP_PID="$!"
for _ in $(seq 1 40); do
  curl -fsS "http://127.0.0.1:$PORT/drippy/morph-bot.js" >/dev/null 2>&1 && break
  sleep .1
done

PLAYWRIGHT_MODULE="${PLAYWRIGHT_MODULE:-$(find /root/.npm/_npx -path '*/node_modules/playwright/index.mjs' -print 2>/dev/null | head -1 || true)}"
if [[ -n "$PLAYWRIGHT_MODULE" && -f "$PLAYWRIGHT_MODULE" ]]; then
  RELEASE_URL="http://127.0.0.1:$PORT/" OUTPUT_PATH="$SNAPSHOT" PLAYWRIGHT_MODULE="$PLAYWRIGHT_MODULE" node --input-type=module <<'JS'
import assert from "node:assert/strict";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
const browser = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox", "--disable-dev-shm-usage"] });
try {
  const page = await browser.newPage({ viewport: { width: 320, height: 320 }, deviceScaleFactor: 1 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(process.env.RELEASE_URL, { waitUntil: "networkidle", timeout: 15000 });
  await page.evaluate(async () => {
    await customElements.whenDefined("morph-bot");
    const bot = document.querySelector("#bot");
    bot.pause();
    if (typeof bot.setState !== "function" || typeof bot.setSpeechLevel !== "function" || typeof bot.playMorph !== "function") {
      throw new Error("Drippy public API is incomplete");
    }
  });
  await page.waitForTimeout(250);
  assert.deepEqual(errors, []);
  await page.locator("#bot").screenshot({ path: process.env.OUTPUT_PATH, omitBackground: true });
} finally {
  await browser.close();
}
JS
else
  cat > "$STAGE/index.html" <<'HTML'
<!doctype html>
<meta charset="utf-8">
<style>
html,body{margin:0;width:320px;height:320px;overflow:hidden;background:#ff00ff}
body{display:grid;place-items:center}
morph-bot{display:block}
</style>
<morph-bot id="bot" size="320" state="idle" shape="blob" material="solid" color="#0b0b0b" eye-color="#ffffff" halo="off" thumbnail paused></morph-bot>
<script type="module" src="/drippy/morph-bot.js"></script>
HTML
  RAW="$STAGE/raw.png"
  google-chrome --headless --no-sandbox --disable-dev-shm-usage --disable-gpu --hide-scrollbars --force-prefers-reduced-motion=reduce \
    --window-size=320,320 --virtual-time-budget=1200 --screenshot="$RAW" "http://127.0.0.1:$PORT/" >/dev/null 2>&1
  python3 - "$RAW" "$SNAPSHOT" <<'PY'
from PIL import Image
import sys
src,dst=sys.argv[1:]
im=Image.open(src).convert("RGBA")
px=im.load()
for y in range(im.height):
    for x in range(im.width):
        r,g,b,a=px[x,y]
        if r > 245 and b > 245 and g < 18:
            px[x,y]=(r,g,b,0)
im.save(dst)
PY
fi
kill "$HTTP_PID" 2>/dev/null || true
HTTP_PID=""

# Strip browser-specific PNG metadata so identical animation content produces
# the exact same release hash on repeated publication.
python3 - "$SNAPSHOT" <<'PY'
from PIL import Image
import sys
path=sys.argv[1]
im=Image.open(path).convert("RGBA")
im.save(path, format="PNG", optimize=False, compress_level=9)
PY

node "$SCRIPT_DIR/verify-drippy-sync-package.mjs" "$PACKAGE_ROOT"

python3 - "$PACKAGE_ROOT" "$BUNDLE" <<'PY'
import pathlib, stat, sys, zipfile
root=pathlib.Path(sys.argv[1]).resolve()
out=pathlib.Path(sys.argv[2])
files=sorted(p for p in root.rglob("*") if p.is_file())
with zipfile.ZipFile(out, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for path in files:
        rel=path.relative_to(root).as_posix()
        info=zipfile.ZipInfo("drippy/"+rel, date_time=(1980,1,1,0,0,0))
        info.compress_type=zipfile.ZIP_DEFLATED
        info.external_attr=(stat.S_IFREG | 0o644) << 16
        info.create_system=3
        z.writestr(info, path.read_bytes(), compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)
PY

SHA="$(sha256sum "$BUNDLE" | awk '{print $1}')"
DEST="$RELEASE_DIR/$SHA"
DOWNLOAD="/component/releases/$SHA/drippy-complete.zip"
mkdir -p "$DEST"
if [[ -f "$DEST/drippy-complete.zip" ]]; then
  EXISTING="$(sha256sum "$DEST/drippy-complete.zip" | awk '{print $1}')"
  [[ "$EXISTING" == "$SHA" ]] || { echo "Immutable release collision: $SHA" >&2; exit 1; }
else
  install -m 0644 "$BUNDLE" "$DEST/drippy-complete.zip"
fi
[[ "$(sha256sum "$DEST/drippy-complete.zip" | awk '{print $1}')" == "$SHA" ]]

LATEST_TMP="$RELEASE_DIR/.latest.json.$$"
node - "$VERSION" "$SHA" "$DOWNLOAD" > "$LATEST_TMP" <<'JS'
const [version, sha256, download] = process.argv.slice(2);
process.stdout.write(JSON.stringify({ version, sha256, download }, null, 2) + "\n");
JS
mv "$LATEST_TMP" "$RELEASE_DIR/latest.json"

echo "Published Drippy release"
echo "version=$VERSION"
echo "sha256=$SHA"
echo "download=$DOWNLOAD"
