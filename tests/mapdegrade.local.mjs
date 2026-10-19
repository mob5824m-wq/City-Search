import { Window } from "happy-dom";
import assert from "node:assert/strict";
import fs from "node:fs";

const win = new Window({ url: "http://localhost:8000/" });
globalThis.window = win; globalThis.document = win.document;
win.scrollTo = () => {};

// Minimal Leaflet stub: records the tile layer and lets us fire tileerror.
const handlers = {};
let removed = null;
const map = {
  getContainer: () => document.getElementById("map"),
  removeLayer: (l) => { removed = l; },
  setView: () => map,
  fitBounds: () => map,
  invalidateSize: () => {},
  flyTo: () => {},
};
const layer = {
  addTo: () => layer,
  on: (evt, fn) => { handlers[evt] = fn; },
};
window.L = {
  map: () => map,
  tileLayer: () => layer,
  latLngBounds: () => ({ extend: () => {} }),
  circleMarker: () => ({ addTo: () => ({ bindTooltip: () => {}, on: () => {}, setStyle: () => {} }), bindTooltip() {}, on() {}, setStyle() {} }),
};

// Import map.js fresh against the stub
const { renderMap } = await import("../assets/js/map.js?degrade");
const card = document.createElement("div");
card.className = "map-card";
card.innerHTML = '<div class="map-card__canvas" id="map"></div>';
document.body.appendChild(card);

renderMap(document.getElementById("map"), [{ key: "a", lat: 43.44, lng: -80.49, label: "35 Homewood Ave" }]);

// Simulate the tile server refusing every tile (e.g. "API key required").
handlers.tileerror();
await new Promise((r) => setTimeout(r, 1100));

assert.equal(removed !== null, true, "tile layer should be removed after errors");
assert.ok(card.classList.contains("map-card--plain"), "plain canvas class missing");
assert.ok(card.querySelector(".map-card__note"), "note missing");
assert.ok(!/api key/i.test(card.textContent), "provider error text must not leak");
console.log("tile failure degrades cleanly:", card.querySelector(".map-card__note").textContent);
