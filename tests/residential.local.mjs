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
const { renderSearch } = await import("../assets/js/views/search.js");
const { renderOwner } = await import("../assets/js/views/owner.js");
const { renderHome } = await import("../assets/js/views/home.js");
const root = document.getElementById("app");
const ctx = () => ({ signal: new AbortController().signal });

// 1. a street search lists homes and never invents an owner for them
root.innerHTML = "";
await renderSearch(root, new URLSearchParams("q=Homewood&mode=address&city=all"), ctx());
await new Promise((r) => setTimeout(r, 400));
let html = root.innerHTML;
assert.ok(html.includes("35 Homewood Ave"), "residential address missing");
assert.ok(html.includes("44 Homewood Ave"), "second home missing");
assert.ok(html.includes("Owner name private"), "private homes must be labelled, not given an owner");
assert.ok(!html.includes("DREWLO"), "must not attach a named owner to a private home");
console.log("ok residential address list");

// 2. the address-mode hint says homes are searchable
assert.ok(html.includes("Any home or building"), "address hint should mention homes");
console.log("ok address hint copy");

// 3. PRIVATE is rejected as an owner, with an explanation
root.innerHTML = "";
await renderOwner(root, new URLSearchParams("name=PRIVATE"), ctx());
await new Promise((r) => setTimeout(r, 300));
html = root.innerHTML;
assert.ok(html.includes("“Private” is not an owner"));
assert.ok(!html.includes("35 Homewood Ave"), "must not list private homes as a portfolio");
console.log("ok PRIVATE is not an owner");

// 4. home hero tells people homes are searchable
root.innerHTML = "";
await renderHome(root, new URLSearchParams(), ctx());
html = root.innerHTML;
assert.ok(html.includes("Every home is searchable by address"));
assert.ok(!/DREWLO HOLDINGS INC[\s\S]{0,200}PRIVATE/.test(html), "leaderboard must not list PRIVATE");
console.log("ok hero copy + leaderboard");
console.log("residential checks passed");
