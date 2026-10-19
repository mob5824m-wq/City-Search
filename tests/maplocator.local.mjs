import { Window } from "happy-dom";
import assert from "node:assert/strict";
const win = new Window({ url: "http://localhost:8000/" });
globalThis.window = win; globalThis.document = win.document;
globalThis.localStorage = win.localStorage; globalThis.CustomEvent = win.CustomEvent;
win.scrollTo = () => {};
globalThis.fetch = async () => { throw new TypeError("offline"); };
document.body.innerHTML = `<span id="saved-count" hidden></span><div id="live-chip"><span id="live-text"></span></div><div id="source-banner" hidden><p id="source-banner-text"></p></div><span id="footer-year"></span><main id="app"></main><div id="toast" hidden><span id="toast-text"></span></div>`;
const data = await import("../assets/js/data.js");
await data.initData();
const { renderProperty } = await import("../assets/js/views/property.js");
const root = document.getElementById("app");
await renderProperty(root, new URLSearchParams("city=kitchener&civic=35&street=HOMEWOOD%20AVE"), { signal: new AbortController().signal });
const html = root.innerHTML;

// without Leaflet the map must still locate the home
assert.ok(html.includes("Map preview unavailable"), "locator card missing");
assert.ok(html.includes("43.44236, -80.49862"), "coordinates missing from locator");
assert.ok(/openstreetmap\.org\/#map=16\/43\.4423/.test(html), "OSM link missing");
assert.ok(html.includes("map-card__coords"));
assert.ok(!/api key/i.test(html), "must never surface provider key errors");

// and the private-owner panel must give the lawful routes
assert.ok(html.includes("ONLAND parcel register"));
assert.ok(html.includes("assessment roll"));
assert.ok(html.includes("AboutMyProperty"));
console.log("map locator + owner routes ok");
