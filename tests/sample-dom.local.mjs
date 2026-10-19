import { Window } from "happy-dom";
import assert from "node:assert/strict";
import fs from "node:fs";

const win = new Window({ url: "http://localhost:8000/" });
const { document } = win;
globalThis.window = win;
globalThis.document = document;
globalThis.localStorage = win.localStorage;
globalThis.CustomEvent = win.CustomEvent;
globalThis.Blob = win.Blob;
if (!globalThis.navigator) Object.defineProperty(globalThis, "navigator", { value: win.navigator, configurable: true });
win.scrollTo = () => {};

document.body.innerHTML = `<span id="saved-count" hidden>0</span><div id="live-chip"><span id="live-text"></span></div>
<div id="source-banner" hidden><p id="source-banner-text"></p></div><span id="footer-year"></span>
<main id="app"></main><div id="toast" hidden><span id="toast-text"></span></div>`;

globalThis.fetch = async () => { throw new TypeError("network down"); };

const data = await import("../assets/js/data.js");
await data.initData();
assert.equal(data.state.live, false);
console.log("sample mode active");

const { renderHome } = await import("../assets/js/views/home.js");
const { renderOwner } = await import("../assets/js/views/owner.js");
const { renderProperty } = await import("../assets/js/views/property.js");
const { renderSearch } = await import("../assets/js/views/search.js");
const { renderAbout } = await import("../assets/js/views/about.js");
const root = document.getElementById("app");
const ctx = () => ({ signal: new AbortController().signal });

async function check(name, fn, needles) {
  root.innerHTML = "";
  await fn();
  const html = root.innerHTML;
  assert.ok(html.length > 400, name + " too small");
  (needles || []).forEach((n) => assert.ok(html.includes(n), name + " missing " + n));
  console.log("ok", name, html.length);
}
await check("home sample", () => renderHome(root, new URLSearchParams(), ctx()), ["DREWLO HOLDINGS INC", "sample extract"]);
await check("owner sample", () => renderOwner(root, new URLSearchParams("name=DREWLO%20HOLDINGS%20INC"), ctx()), ["425 Wilson Ave", "310 Queen St S"]);
await check("property sample", () => renderProperty(root, new URLSearchParams("city=kitchener&civic=425&street=WILSON%20AVE"), ctx()), ["425 Wilson Ave", "Owner on file"]);
await check("waterloo sample", () => renderProperty(root, new URLSearchParams("city=waterloo&address=213%20PASTERN%20TRAIL&id=95099.0"), ctx()), ["213 Pastern Trail", "Owner names aren't published"]);
await check("search sample", () => renderSearch(root, new URLSearchParams("q=Drewlo&mode=name&city=all"), ctx()), ["DREWLO HOLDINGS INC"]);
await check("about", async () => renderAbout(root), ["A public record should be readable"]);
console.log("sample DOM checks passed");
