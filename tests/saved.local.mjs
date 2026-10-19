import { Window } from "happy-dom";
import assert from "node:assert/strict";
const win = new Window({ url: "http://localhost:8000/" });
globalThis.window = win; globalThis.document = win.document;
globalThis.localStorage = win.localStorage; globalThis.CustomEvent = win.CustomEvent;
win.scrollTo = () => {};
globalThis.fetch = async () => { throw new TypeError("offline"); };
document.documentElement.innerHTML = `<head></head><body>
<a data-nav="saved" href="#/saved">Saved <span id="saved-count" hidden>0</span></a>
<div id="live-chip"><span id="live-text"></span></div>
<div id="source-banner" hidden><p id="source-banner-text"></p></div>
<main id="app"></main><div id="toast" hidden><span id="toast-text"></span></div></body>`;
const store = await import("../assets/js/store.js");
const ui = await import("../assets/js/ui.js");
const data = await import("../assets/js/data.js");
await data.initData();
ui.updateSavedBadge();
const badge = document.getElementById("saved-count");
assert.equal(badge.hidden, true);

store.toggleOwner("DREWLO HOLDINGS INC");
assert.equal(store.isOwnerSaved("DREWLO HOLDINGS INC"), true);
ui.updateSavedBadge();
assert.equal(badge.hidden, false);
assert.equal(badge.textContent, "1");
console.log("save owner ok, badge", badge.textContent);

store.toggleProperty({ city: "kitchener", address: "425 Wilson Ave", civic: "425", street: "WILSON AVE" });
assert.equal(store.getSaved().properties.length, 1);
ui.updateSavedBadge();
assert.equal(badge.textContent, "2");
console.log("save property ok");

const { renderSaved } = await import("../assets/js/views/saved.js");
const root = document.getElementById("app");
await renderSaved(root);
const html = root.innerHTML;
assert.ok(html.includes("DREWLO HOLDINGS INC"));
assert.ok(html.includes("425 Wilson Ave"));
assert.ok(!html.includes("Nothing saved yet"));
console.log("saved view ok", html.length);

// unsave owner and confirm badge drops
store.toggleOwner("DREWLO HOLDINGS INC");
ui.updateSavedBadge();
assert.equal(badge.textContent, "1");
await renderSaved(root);
assert.ok(!root.innerHTML.includes("DREWLO HOLDINGS INC"));
console.log("unsave ok");
console.log("saved-state checks passed");
