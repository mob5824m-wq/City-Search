import { Window } from "happy-dom";
import assert from "node:assert/strict";
import fs from "node:fs";

const base = process.env.BASE || "http://127.0.0.1:8000";
const html = await (await fetch(base + "/")).text();
console.log("served html bytes:", html.length);

const body = html.match(/<body[^>]*>([\s\S]*)<\/body>/i)[1].replace(/<script[\s\S]*?<\/script>/gi, "");
const win = new Window({ url: base + "/" });
globalThis.window = win; globalThis.document = win.document;
globalThis.localStorage = win.localStorage; globalThis.CustomEvent = win.CustomEvent;
globalThis.Blob = win.Blob;
if (!globalThis.navigator) Object.defineProperty(globalThis, "navigator", { value: win.navigator, configurable: true });
win.scrollTo = () => {};
document.documentElement.innerHTML = `<head></head><body>${body}</body>`;

const K = "https://services1.arcgis.com/qAo1OsXi67t7XgmS/arcgis/rest/services/Property_Ownership_Public/FeatureServer/0/query";
let arcgisCalls = 0;
globalThis.fetch = async (raw) => {
  const u = String(raw);
  if (!u.startsWith("https://services")) throw new TypeError("unexpected network: " + u);
  arcgisCalls += 1;
  const p = new URL(u).searchParams;
  if (p.get("returnCountOnly") === "true") return { ok: true, status: 200, text: async () => JSON.stringify({ count: 144931 }) };
  if (p.get("groupByFieldsForStatistics")) return { ok: true, status: 200, text: async () => JSON.stringify({ features: [] }) };
  return { ok: true, status: 200, text: async () => JSON.stringify({ features: [
    { attributes: { OBJECTID: 1, OWNERNAME: "PRIVATE", CIVIC_NO: 35, STREET: "HOMEWOOD AVE", UNIT: null, PROPERTY_UNIT_ID: 1020336 }, geometry: { x: -80.4986, y: 43.4424 } },
  ] }) };
};

await import("../assets/js/app.js");

async function wait(sel, ms = 6000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const el = document.querySelector(sel);
    if (el) return el;
    await new Promise((r) => setTimeout(r, 60));
  }
  throw new Error("timed out: " + sel);
}

await wait("#app .hero");
console.log("boot ok");

win.location.hash = "#/property?city=kitchener&civic=35&street=HOMEWOOD%20AVE";
win.dispatchEvent(new win.HashChangeEvent("hashchange"));
await wait("#app .locmap");
await new Promise((r) => setTimeout(r, 300));

const markers = document.querySelectorAll(".locmap__marker");
const svg = document.querySelector(".locmap__svg");
console.log("markers:", markers.length, "svg children:", svg.childElementCount);
assert.ok(markers.length === 1, "expected one marker for one property");
assert.ok(svg.childElementCount > 0, "svg must be drawn");
assert.ok(document.querySelector(".locmap__scale text"), "scale bar missing");
const t = markers[0].getAttribute("transform");
assert.match(t, /translate\(-?[\d.]+ -?[\d.]+\)/);
console.log("transform:", t);
assert.ok(!/api key|tiles? (could|can)/i.test(document.getElementById("app").textContent), "no tile/key error text");
console.log("served end-to-end map ok; ArcGIS calls:", arcgisCalls);
