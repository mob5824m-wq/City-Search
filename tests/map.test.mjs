import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const mapSrc = fs.readFileSync(new URL("../assets/js/basemap.js", import.meta.url), "utf8");
const mapCode = mapSrc.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");

test("the map makes no network requests and needs no key", () => {
  // Only the outbound "open in OpenStreetMap" anchor may mention a host.
  const urls = [...mapCode.matchAll(/https?:\/\/[^"'`\s)]+/g)].map((m) => m[0]);
  assert.deepEqual(
    urls.filter((u) => !u.startsWith("https://www.openstreetmap.org")),
    [],
    `unexpected remote reference in map.js: ${urls.join(", ")}`
  );
  assert.doesNotMatch(mapCode, /tileLayer|tileerror|API key|apiKey|apikey|arcgisonline|cartocdn|window\.L\b|leaflet/i);
});

test("index.html ships no tile client", () => {
  assert.doesNotMatch(html, /leaflet/i);
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
