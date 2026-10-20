import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const mapSrc = fs.readFileSync(new URL("../assets/js/basemap.js", import.meta.url), "utf8");
const mapCode = mapSrc.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");

test("street tiles come from a keyless host and carry no key", async () => {
  const { MAP } = await import("../assets/js/config.js");
  assert.ok(MAP.tiles.length >= 1);
  MAP.tiles.forEach((template) => {
    assert.match(template, /^https:\/\//);
    assert.match(template, /\{z\}.*\{y\}.*\{x\}/);
    assert.doesNotMatch(template, /token|key|apikey|access_token/i);
  });
  assert.match(MAP.tiles[0], /arcgisonline\.com/);
  assert.match(MAP.attribution, /Esri/);

  // The map itself never builds a keyed URL, and never imports a map library.
  assert.doesNotMatch(mapCode, /API key|apiKey|apikey|cartocdn|window\.L\b|leaflet/i);
});

test("index.html ships no third-party map client", () => {
  assert.doesNotMatch(html, /leaflet/i);
});

test("tile maths lands on the right tile and scale", async () => {
  const { lonLatToTile, tileLayout, metresPerPixel, zoomFor } = await import("../assets/js/basemap.js");

  // Null Island at z=0 is a single tile; x=0.5,y=0.5 in tile units.
  const world = lonLatToTile(0, 0, 0);
  assert.ok(Math.abs(world.x - 0.5) < 1e-9);
  assert.ok(Math.abs(world.y - 0.5) < 1e-9);

  // At z=2 the world is 4x4 tiles, so lng -180 is x=0 and lng 0 is x=2.
  assert.equal(Math.round(lonLatToTile(0, -180, 2).x), 0);
  assert.equal(Math.round(lonLatToTile(0, 0, 2).x), 2);

  // Kitchener sits in tile column 2^z * 0.2764 (lng -80.49).
  const k = lonLatToTile(43.45, -80.49, 12);
  assert.equal(Math.floor(k.x), Math.floor(Math.pow(2, 12) * ((-80.49 + 180) / 360)));
  assert.ok(k.y > 0 && k.y < Math.pow(2, 12));

  // A viewport at an exact integer zoom needs scale ~= 1, and tiles must
  // overlap the whole viewport with no gaps at the edges.
  const size = { width: 720, height: 420 };
  const view = { center: { lat: 43.45, lng: -80.49 }, mpp: metresPerPixel(16, 43.45) };
  assert.equal(zoomFor(view.mpp, view.center.lat), 16);
  const layout = tileLayout(view, size);
  assert.equal(layout.zoom, 16);
  assert.ok(Math.abs(layout.scale - 1) < 1e-9, "integer zoom should be 1:1");
  const coveredW = new Set(layout.tiles.map((t) => Math.round(t.left / t.size)));
  assert.equal(coveredW.size, 4, "720px at 256px/tile needs columns -1..2");
  assert.ok(layout.tiles.every((t) => t.left > -256 && t.left < size.width + 256));
  assert.ok(layout.tiles.every((t) => t.top > -256 && t.top < size.height + 256));
});

test("projection keeps real-world proportions", async () => {
  const { projectPoint, metresPerPixel } = await import("../assets/js/basemap.js");
  const center = { lat: 43.45, lng: -80.49 };
  const size = { width: 600, height: 400 };
  const mpp = metresPerPixel(17, center.lat);

  const origin = projectPoint(center, center, mpp, size);
  assert.equal(Math.round(origin.x), size.width / 2);
  assert.equal(Math.round(origin.y), size.height / 2);

  // 100 m due east at this latitude must land ~100m worth of pixels right.
  const dLng = 100 / (111320 * Math.cos((center.lat * Math.PI) / 180));
  const east = projectPoint({ lat: center.lat, lng: center.lng + dLng }, center, mpp, size);
  assert.ok(Math.abs(east.x - origin.x - 100 / mpp) < 0.5, "east offset wrong");

  // 100 m due north must land the same distance up the screen.
  const north = projectPoint({ lat: center.lat + 100 / 110574, lng: center.lng }, center, mpp, size);
  assert.ok(Math.abs(origin.y - north.y - 100 / mpp) < 0.5, "north offset wrong");
});

test("fitView frames every point inside the viewport", async () => {
  const { fitView, projectPoint } = await import("../assets/js/basemap.js");
  const points = [
    { lat: 43.4223, lng: -80.4458 },
    { lat: 43.4467, lng: -80.4933 },
    { lat: 43.4891, lng: -80.4870 },
  ];
  const size = { width: 720, height: 420 };
  const view = fitView(points, size);
  points.forEach((p) => {
    const { x, y } = projectPoint(p, view.center, view.mpp, size);
    assert.ok(x >= 0 && x <= size.width, `point off-screen horizontally: ${x}`);
    assert.ok(y >= 0 && y <= size.height, `point off-screen vertically: ${y}`);
  });
});

test("a single property maps at street scale, not city scale", async () => {
  const { fitView } = await import("../assets/js/basemap.js");
  const view = fitView([{ lat: 43.44378, lng: -80.53928 }], { width: 720, height: 420 });
  assert.ok(view.mpp < 5, `expected street-level metres per pixel, got ${view.mpp}`);
});

test("a single point centres without dividing by zero", async () => {
  const { fitView, projectPoint } = await import("../assets/js/basemap.js");
  const size = { width: 720, height: 420 };
  const p = { lat: 43.4423, lng: -80.4986 };
  const view = fitView([p], size);
  assert.ok(Number.isFinite(view.mpp) && view.mpp > 0);
  const xy = projectPoint(p, view.center, view.mpp, size);
  assert.ok(Math.abs(xy.x - size.width / 2) < 0.01);
  assert.ok(Math.abs(xy.y - size.height / 2) < 0.01);
});
