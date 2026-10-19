import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { MAP } from "../assets/js/config.js";

const mapSrc = fs.readFileSync(new URL("../assets/js/map.js", import.meta.url), "utf8");

test("the basemap needs no API key", () => {
  assert.match(MAP.tiles, /^https:\/\//);
  assert.doesNotMatch(MAP.tiles, /key=|access_token|apikey|\{apikey\}/i);
  assert.match(MAP.attribution, /OpenStreetMap/);
  assert.ok(MAP.maxZoom >= 18);
});

test("map.js reads the basemap from config and handles refused tiles", () => {
  assert.match(mapSrc, /import \{ MAP \} from "\.\/config\.js"/);
  assert.match(mapSrc, /MAP\.tiles/);
  assert.match(mapSrc, /tileerror/);
  assert.match(mapSrc, /map-card--plain/);
  // The old key-gated provider must not sneak back in.
  assert.doesNotMatch(mapSrc, /cartocdn\.com/);
});

test("the no-Leaflet fallback is a locator, not an error message", () => {
  assert.match(mapSrc, /Map preview unavailable/);
  assert.match(mapSrc, /map-card__coords/);
  assert.match(mapSrc, /openstreetmap\.org/);
});
