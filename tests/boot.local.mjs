import { Window } from "happy-dom";
import assert from "node:assert/strict";
import fs from "node:fs";

const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
const body = bodyMatch[1].replace(/<script[\s\S]*?<\/script>/gi, "");
const win = new Window({ url: "http://localhost:8000/" });
const { document } = win;
globalThis.window = win;
globalThis.document = document;
globalThis.localStorage = win.localStorage;
globalThis.CustomEvent = win.CustomEvent;
globalThis.Blob = win.Blob;
if (!globalThis.navigator) Object.defineProperty(globalThis, "navigator", { value: win.navigator, configurable: true });
win.scrollTo = () => {};
document.documentElement.innerHTML = `<head></head><body>${body}</body>`;

const now = Date.now();
globalThis.fetch = async (raw) => {
  if (process.env.OFFLINE) throw new TypeError("network down");
  const u = new URL(String(raw));
  const p = u.searchParams;
  const group = p.get("groupByFieldsForStatistics");
  let out = { features: [] };
  if (p.get("returnCountOnly") === "true") out = { count: 144931 };
  else if (group === "OWNERNAME") out = { features: [{ attributes: { OWNERNAME: "DREWLO HOLDINGS INC", cnt: 704 } }, { attributes: { OWNERNAME: "KERBS REALTY INC", cnt: 4 } }] };
  else if (group === "CIVIC_NO,STREET") out = { features: [] };
  else if (u.pathname.includes("Building_Permits")) out = { features: [] };
  else if (u.pathname.includes("/Addresses/")) out = { features: [] };
  else out = { exceededTransferLimit: false, features: [{ attributes: { OBJECTID: 1, OWNERNAME: "DREWLO HOLDINGS INC", CIVIC_NO: 425, STREET: "WILSON AVE", UNIT: "111", PROPERTY_UNIT_ID: 1, AGENCY: null }, geometry: { x: -80.44, y: 43.42 } }] };
  return { ok: true, status: 200, text: async () => JSON.stringify(out) };
};

await import("../assets/js/app.js");
async function waitFor(sel, timeout = 5000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (document.querySelector(sel)) return document.querySelector(sel);
    await new Promise((r) => setTimeout(r, 60));
  }
  throw new Error("Timed out waiting for " + sel);
}

const app = await waitFor("#app .hero");
assert.ok(app.textContent.includes("Who owns"));
assert.equal(document.getElementById("live-text").textContent, process.env.OFFLINE ? "Sample data" : "Live city data");
if (process.env.OFFLINE) assert.equal(document.getElementById("source-banner").hidden, false);
console.log("boot ok", process.env.OFFLINE ? "(offline/sample)" : "(live)", document.getElementById("app").innerHTML.length);

// Navigate to about
win.location.hash = "#/about";
win.dispatchEvent(new win.HashChangeEvent("hashchange"));
await new Promise((r) => setTimeout(r, 300));
assert.ok(document.getElementById("app").innerHTML.includes("A public record should be readable"));
assert.equal(document.querySelector('[data-nav="about"]').getAttribute("aria-current"), "page");
console.log("route about ok");

// Navigate to a 404
win.location.hash = "#/nope";
win.dispatchEvent(new win.HashChangeEvent("hashchange"));
await new Promise((r) => setTimeout(r, 250));
assert.ok(document.getElementById("app").innerHTML.includes("That page isn't here"));
console.log("route 404 ok");

// Back to saved (empty state)
win.location.hash = "#/saved";
win.dispatchEvent(new win.HashChangeEvent("hashchange"));
await new Promise((r) => setTimeout(r, 250));
assert.ok(document.getElementById("app").innerHTML.includes("Nothing saved yet"));
console.log("route saved ok");

console.log("boot checks passed");
