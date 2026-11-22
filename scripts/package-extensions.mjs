import { cp, mkdir, readFile, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const root = process.cwd();
const release = resolve(root, "release");
const source = resolve(root, "extension");
const firefoxManifest = JSON.parse(await readFile(resolve(root, "manifest.firefox.json"), "utf8"));

async function prepare(name, manifest) {
  const folder = resolve(release, name);
  await rm(folder, { recursive: true, force: true });
  await mkdir(folder, { recursive: true });
  await cp(source, folder, { recursive: true });
  await (await import("node:fs/promises")).writeFile(
    resolve(folder, "manifest.json"),
    JSON.stringify(manifest, null, 2) + "\n"
  );
  const archive = resolve(release, name + ".zip");
  await rm(archive, { force: true });
  execFileSync("zip", ["-qr", archive, "."], { cwd: folder, stdio: "inherit" });
  console.log("Packaged " + name + ": " + archive);
}

const chromiumManifest = JSON.parse(await readFile(resolve(source, "manifest.json"), "utf8"));
await mkdir(release, { recursive: true });
await prepare("chess-topper-chromium-extension", chromiumManifest);
await prepare("chess-topper-firefox-extension", firefoxManifest);
