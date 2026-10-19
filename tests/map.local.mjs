import { Window } from "happy-dom";
import assert from "node:assert/strict";

const win = new Window({ url: "http://localhost:8000/" });
globalThis.window = win; globalThis.document = win.document;
win.scrollTo = () => {};

// Fail loudly if the map ever tries to fetch anything.
let fetches = 0;
globalThis.fetch = async () => { fetches += 1; throw new TypeError("network disabled"); };
const createdImages = [];
const OriginalImage = win.Image;
win.Image = function (...args) { createdImages.push(args); return new OriginalImage(...args); };

const { renderMap } = await import("../assets/js/basemap.js");

const card = document.createElement("div");
card.className = "map-card";
card.innerHTML = '<div class="map-card__canvas" id="m"></div>';
document.body.appendChild(card);
const host = document.getElementById("m");
Object.defineProperty(host, "clientWidth", { value: 720 });
Object.defineProperty(host, "clientHeight", { value: 420 });

const points = [
  { key: "k1", lat: 43.4223, lng: -80.4458, label: "425 Wilson Ave" },
  { key: "k2", lat: 43.4467, lng: -80.4933, label: "310 Queen St S" },
  { key: "k3", lat: 43.4891, lng: -80.4870, label: "213 Pastern Trail" },
];

let selected = null;
const api = renderMap(host, points, { onSelect: (k) => { selected = k; }, ariaLabel: "Three properties" });

const svg = host.querySelector("svg.locmap__svg");
assert.ok(svg, "svg missing");
assert.equal(svg.getAttribute("aria-label"), "Three properties");
assert.equal(host.querySelectorAll(".locmap__marker").length, 3);
assert.equal(host.querySelectorAll(".locmap__marker[role=button]").length, 3, "markers must be operable");

// No network: no fetch, no <img> tiles.
assert.equal(fetches, 0, "map must not fetch");
assert.equal(host.querySelectorAll("img").length, 0, "map must not request tiles");

// The basemap is drawn locally: grid, scale bar and north arrow.
assert.ok(host.querySelector(".locmap__grid line"), "graticule missing");
assert.ok(host.querySelector(".locmap__scale text"), "scale bar missing");
assert.ok(host.querySelector(".locmap__north"), "north arrow missing");

// Markers sit at the relative positions the coordinates imply:
// Pastern Trail is north of Wilson Ave, Queen St S is west of both.
const xy = {};
host.querySelectorAll(".locmap__marker").forEach((m) => {
  const t = m.getAttribute("transform").match(/translate\(([-\d.]+) ([-\d.]+)\)/);
  xy[m.dataset.key] = { x: Number(t[1]), y: Number(t[2]) };
});
assert.ok(xy.k3.y < xy.k1.y, "north point should be higher on screen");
assert.ok(xy.k2.x < xy.k1.x, "west point should be further left");

// Clicking a marker reports the selection.
host.querySelector('[data-key="k2"]').dispatchEvent(new win.MouseEvent("click", { bubbles: true }));
assert.equal(selected, "k2");
assert.ok(host.querySelector('[data-key="k2"]').classList.contains("is-active"));

// focus() recentres and zooms in.
const before = api.metresPerPixel;
api.focus("k3", 17);
assert.ok(api.metresPerPixel < before, "focus should zoom in");
assert.ok(Math.abs(api.center.lat - 43.4891) < 1e-9 && Math.abs(api.center.lng + 80.4870) < 1e-9);

// Zoom controls change scale, Fit restores the full frame.
api.fit();
const fitted = api.metresPerPixel;
host.querySelector('[data-zoom="in"]').dispatchEvent(new win.MouseEvent("click", { bubbles: true }));
assert.ok(api.metresPerPixel < fitted, "zoom in should reduce metres per pixel");
host.querySelector('[data-zoom="out"]').dispatchEvent(new win.MouseEvent("click", { bubbles: true }));
assert.ok(api.metresPerPixel > fitted * 0.99, "zoom out should restore scale");

// The outbound link is an anchor, not a tile request.
const osm = host.querySelector(".locmap__osm");
assert.ok(osm.href.startsWith("https://www.openstreetmap.org/#map="));

// Empty / coordinate-less records get an honest card, not a broken map.
const host2 = document.createElement("div");
host2.className = "map-card";
document.body.appendChild(host2);
assert.equal(renderMap(host2, []), null);
assert.ok(host2.textContent.includes("No coordinates on file"));

console.log("self-contained map checks passed");
