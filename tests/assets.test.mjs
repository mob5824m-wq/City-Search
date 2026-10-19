import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function walk(dir, out = []) {
  fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).forEach((entry) => {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(rel, out);
    else out.push(rel);
  });
  return out;
}

test("index.html local assets exist", () => {
  const html = read("index.html");
  const refs = [...html.matchAll(/(?:href|src)="((?:assets|\.\/assets)\/[^"]+)"/g)].map((m) => m[1]);
  assert.ok(refs.length >= 5);
  refs.forEach((ref) => {
    const clean = ref.replace(/^\.\//, "").split("?")[0];
    assert.ok(fs.existsSync(path.join(ROOT, clean)), `missing asset: ${clean}`);
  });
});

test("all relative ES module imports resolve", () => {
  const files = walk("assets/js").filter((f) => f.endsWith(".js"));
  assert.ok(files.length >= 10);
  files.forEach((file) => {
    const source = read(file);
    const imports = [...source.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]);
    imports.forEach((spec) => {
      if (!spec.startsWith(".")) return;
      const target = path.resolve(path.dirname(path.join(ROOT, file)), spec);
      assert.ok(fs.existsSync(target), `${file} imports missing ${spec}`);
    });
  });
});

test("every icon referenced in markup exists in the sprite", () => {
  const html = read("index.html");
  const spriteIds = new Set([...html.matchAll(/<symbol id="i-([a-z-]+)"/g)].map((m) => m[1]));
  assert.ok(spriteIds.size >= 15);

  const jsFiles = walk("assets/js").filter((f) => f.endsWith(".js"));
  const used = new Set();
  jsFiles.forEach((file) => {
    const src = read(file);
    for (const m of src.matchAll(/icon\(\s*["']([a-z-]+)["']/g)) used.add(m[1]);
    for (const m of src.matchAll(/href="#i-([a-z-]+)"/g)) used.add(m[1]);
  });
  for (const m of html.matchAll(/href="#i-([a-z-]+)"/g)) used.add(m[1]);

  const missing = [...used].filter((id) => !spriteIds.has(id));
  assert.deepEqual(missing, [], `icons missing from sprite: ${missing.join(", ")}`);
});

test("routes in app.js correspond to view modules", () => {
  const app = read("assets/js/app.js");
  for (const view of ["home", "search", "owner", "property", "saved", "about"]) {
    assert.match(app, new RegExp(`views/${view}\\.js`));
  }
});

test("server.py stays dependency-free and bindable", () => {
  const server = read("server.py");
  assert.match(server, /ThreadingHTTPServer/);
  assert.match(server, /0\.0\.0\.0/);
  assert.match(server, /PORT/);
});
