const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const ADDON = path.join(ROOT, "superagent-addon");
const DIST = path.join(ROOT, "dist");

const version = JSON.parse(fs.readFileSync(path.join(ROOT, "pxt.json"), "utf8")).version;
const OUTPUT = path.join(DIST, `superagent-${version}.mcaddon`);

fs.mkdirSync(DIST, { recursive: true });

// Build into a temp dir first. Some synced/managed folders block unlink/rename,
// which makes `zip` fail when it tries to replace an existing archive in place.
const tmpOutput = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "superagent-")), "superagent.mcaddon");
execFileSync("zip", ["-qr", tmpOutput, "superagent_BP", "superagent_RP"], {
  cwd: ADDON,
  stdio: "inherit",
});

try {
  if (fs.existsSync(OUTPUT)) {
    fs.rmSync(OUTPUT);
  }
} catch (error) {
  // Folder does not permit deletion; copyFileSync below will still overwrite.
}
fs.copyFileSync(tmpOutput, OUTPUT);

console.log(OUTPUT);
