/* Local-only DOM smoke test. Not part of `npm test`. */
import { Window } from "happy-dom";
import assert from "node:assert/strict";

const win = new Window({ url: "http://localhost:8000/" });
const { document } = win;

globalThis.window = win;
globalThis.document = document;
globalThis.localStorage = win.localStorage;
globalThis.CustomEvent = win.CustomEvent;
globalThis.Blob = win.Blob;
if (!globalThis.navigator) {
  Object.defineProperty(globalThis, "navigator", { value: win.navigator, configurable: true });
}

document.body.innerHTML = `
  <span id="saved-count" hidden>0</span>
  <div id="live-chip"><span id="live-text"></span></div>
  <div id="source-banner" hidden><p id="source-banner-text"></p></div>
  <span id="footer-year"></span>
  <main id="app"></main>
  <div id="toast" hidden><span id="toast-text"></span></div>`;

const now = Date.now();
globalThis.fetch = async (raw) => {
  const u = new URL(String(raw));
  const p = u.searchParams;
  const group = p.get("groupByFieldsForStatistics");
  let body = { features: [] };
  if (p.get("returnCountOnly") === "true") {
    body = { count: 144931 };
  } else if (group === "OWNERNAME") {
    body = { features: [
      { attributes: { OWNERNAME: "DREWLO HOLDINGS INC", cnt: 704 } },
      { attributes: { OWNERNAME: "DREWLO INVESTMENTS LTD", cnt: 12 } },
    ] };
  } else if (group === "CIVIC_NO,STREET") {
    body = { features: [{ attributes: { CIVIC_NO: 425, STREET: "WILSON AVE", cnt: 3 } }] };
  } else if (u.pathname.includes("Building_Permits")) {
    body = { features: [{ attributes: {
      PERMITNO: "24 123456", PERMIT_TYPE: "Residential Alteration", PERMIT_STATUS: "Issued",
      ISSUE_DATE: now, WORK_TYPE: "Interior", SUB_WORK_TYPE: "Basement",
      PERMIT_DESCRIPTION: "Finished basement", CONSTRUCTION_VALUE: 25000, FOLDERNAME: "425 WILSON AVE",
      PERMIT_NUM: "24 123456", PERMITDESC: "Residential Building Permit", STATUS: "Complete",
      ISSUEDATE: now, WORKDESC: "Interior", SUBDESC: "Basement", DESCRIPTN: "Test", CONTRVALUE: 25000,
      UNITS: null, BEDROOMS: 3, PROPAREA: 150, ADDRESS: "213 PASTERN TRAIL",
    } }] };
  } else if (u.pathname.includes("/Addresses/")) {
    body = { features: [{ attributes: {
      ADDRESS_ID: "95099.0", CIVIC_ADDR: "213 PASTERN TRAIL", STREET_NM: "PASTERN TRAIL",
      WARD: 5, LATITUDE: 43.4891, LONGITUDE: -80.4869,
    } }] };
  } else {
    body = { exceededTransferLimit: false, features: [
      { attributes: { OBJECTID: 1, OWNERNAME: "DREWLO HOLDINGS INC", CIVIC_NO: 425, STREET: "WILSON AVE", UNIT: "111", PROPERTY_UNIT_ID: 1, AGENCY: null }, geometry: { x: -80.4457, y: 43.4222 } },
      { attributes: { OBJECTID: 2, OWNERNAME: "DREWLO HOLDINGS INC", CIVIC_NO: 425, STREET: "WILSON AVE", UNIT: "711", PROPERTY_UNIT_ID: 2, AGENCY: null }, geometry: { x: -80.4457, y: 43.4222 } },
      { attributes: { OBJECTID: 3, OWNERNAME: "DREWLO HOLDINGS INC", CIVIC_NO: 310, STREET: "QUEEN ST S", UNIT: null, PROPERTY_UNIT_ID: 3, AGENCY: null }, geometry: { x: -80.4932, y: 43.4467 } },
    ] };
  }
  return { ok: true, status: 200, text: async () => JSON.stringify(body) };
};

const { renderHome } = await import("../assets/js/views/home.js");
const { renderSearch } = await import("../assets/js/views/search.js");
const { renderOwner } = await import("../assets/js/views/owner.js");
const { renderProperty } = await import("../assets/js/views/property.js");
const { renderSaved } = await import("../assets/js/views/saved.js");
const { renderAbout } = await import("../assets/js/views/about.js");

const root = document.getElementById("app");
const ctx = () => ({ signal: new AbortController().signal });

async function check(name, fn, needle) {
  root.innerHTML = "";
  await fn();
  const html = root.innerHTML;
  assert.ok(html.length > 500, `${name}: rendered too little`);
  if (needle) assert.ok(html.includes(needle), `${name}: missing "${needle}"`);
  console.log(`ok ${name} (${html.length} chars)`);
}

await check("home", () => renderHome(root, new URLSearchParams(), ctx()), "Who owns");
await check("search name", () => renderSearch(root, new URLSearchParams("q=Drewlo&mode=name&city=all"), ctx()), "DREWLO HOLDINGS INC");
await check("search address", () => renderSearch(root, new URLSearchParams("q=425+Wilson+Ave&mode=address&city=all"), ctx()), "Wilson");
await check("owner", () => renderOwner(root, new URLSearchParams("name=DREWLO%20HOLDINGS%20INC"), ctx()), "DREWLO HOLDINGS INC");
await check("property kitchener", () => renderProperty(root, new URLSearchParams("city=kitchener&civic=425&street=WILSON%20AVE"), ctx()), "425 Wilson Ave");
await check("property waterloo", () => renderProperty(root, new URLSearchParams("city=waterloo&address=213%20PASTERN%20TRAIL&id=95099.0"), ctx()), "213 Pastern Trail");
await check("about", async () => renderAbout(root), null);
await check("saved", async () => renderSaved(root), "Saved");

console.log("DOM smoke test passed");
