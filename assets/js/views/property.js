import { getKitchenerProperty, getWaterlooProperty, isSample } from "../data.js";
import {
  escapeHtml, formatNumber, ownerType, ownerTypeLabel, setPageTitle, titleCaseStreet,
  formatDate, buildOwnerHref, naturalCompare,
} from "../util.js";
import { icon, typeTag, breadcrumb, emptyState, toast, copyLink, printPage, formatCurrency, formatCoords, sampleTag } from "../ui.js";
import { renderMap, openStreetMapLink } from "../map.js";
import { isPropertySaved, toggleProperty } from "../store.js";
import { OFFICIAL, SOURCES } from "../config.js";

export async function renderProperty(root, params, ctx = {}) {
  const city = params.get("city") === "waterloo" ? "waterloo" : "kitchener";
  const civic = (params.get("civic") || "").trim();
  const street = (params.get("street") || "").trim();
  const address = (params.get("address") || "").trim();
  const id = (params.get("id") || "").trim();

  if (city === "kitchener" && (!civic || !street)) {
    renderBadRequest(root);
    return;
  }
  if (city === "waterloo" && !address) {
    renderBadRequest(root);
    return;
  }

  const displayAddress = city === "kitchener"
    ? `${civic} ${titleCaseStreet(street)}`
    : titleCaseStreet(address);

  setPageTitle(`${displayAddress}, ${city === "waterloo" ? "Waterloo" : "Kitchener"}`);

  root.innerHTML = `
    <div class="page">
      <div class="wrap">
        ${breadcrumb([{ label: "Home", href: "#/" }, { label: "Search", href: "#/" }, { label: displayAddress }])}
        <div class="print-header">
          <strong>Ledger KW</strong> · Public property records for Kitchener &amp; Waterloo · printed ${new Date().toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" })}
        </div>
        <div class="page-head">
          <div class="page-head__row">
            <div>
              <span class="eyebrow">Property record · ${city === "waterloo" ? "City of Waterloo" : "City of Kitchener"}</span>
              <h1>${escapeHtml(displayAddress)}</h1>
              <div class="result-meta" data-property-meta>
                <span>${city === "waterloo" ? "Waterloo, ON" : "Kitchener, ON"}</span>
                ${isSample() ? `<span class="dot"></span>${sampleTag()}` : ""}
              </div>
            </div>
            <div class="page-head__actions">
              <button class="btn btn--primary" type="button" data-save aria-pressed="false">${icon("bookmark", "ico--sm")} <span>Save</span></button>
              <button class="btn" type="button" data-print>${icon("printer", "ico--sm")} Print</button>
              <button class="btn btn--ghost" type="button" data-copy>${icon("doc", "ico--sm")} Copy link</button>
            </div>
          </div>
        </div>
        <div data-property>
          <div class="property-layout">
            <div class="property-main">
              <div class="skeleton" style="height:104px"></div>
              <div class="skeleton" style="height:220px"></div>
              <div class="skeleton" style="height:180px"></div>
            </div>
            <aside class="side">
              <div class="skeleton" style="height:300px;border-radius:14px"></div>
            </aside>
          </div>
        </div>
      </div>
    </div>`;

  root.querySelector("[data-print]")?.addEventListener("click", printPage);
  root.querySelector("[data-copy]")?.addEventListener("click", copyLink);

  let record;
  try {
    record = city === "kitchener"
      ? await getKitchenerProperty(civic, street, { signal: ctx.signal })
      : await getWaterlooProperty(address, id, { signal: ctx.signal });
  } catch (err) {
    if (err && err.name === "AbortError") return;
    const host = root.querySelector("[data-property]");
    if (host) {
      host.innerHTML = `<div class="inline-error" style="margin-top:24px">${icon("info")}<div>
        <strong>The property record could not be loaded</strong>${escapeHtml(err.message)}
        <div style="margin-top:10px"><button class="btn btn--tiny" type="button" data-retry>${icon("refresh", "ico--xs")} Retry</button></div>
      </div></div>`;
      host.querySelector("[data-retry]")?.addEventListener("click", () => renderProperty(root, params, ctx));
    }
    return;
  }

  if (ctx.signal && ctx.signal.aborted) return;

  if (!record) {
    root.querySelector("[data-property]").innerHTML = `<div style="margin-top:26px">${emptyState({
      iconName: "pin",
      title: "Address not found",
      body: `The city's public records don't contain <b>${escapeHtml(displayAddress)}</b>. Check the spelling, try the street without a unit number, or search again.`,
      actions: `<a class="btn btn--primary" href="#/search?q=${encodeURIComponent(displayAddress)}&mode=address&city=all">Search this address</a>`,
    })}</div>`;
    return;
  }

  const building = record.building;
  const permits = record.permits || [];
  const rows = record.rows || [];
  const isWaterloo = city === "waterloo";

  // Save button
  const propertyRef = { city, address: building.address, civic: building.civic, street: building.street, id: building.id || id };
  const saveBtn = root.querySelector("[data-save]");
  const paintSave = (on) => {
    if (!saveBtn) return;
    saveBtn.setAttribute("aria-pressed", on ? "true" : "false");
    saveBtn.classList.toggle("btn--primary", !on);
    saveBtn.innerHTML = `${icon("bookmark", "ico--sm")} <span>${on ? "Saved" : "Save"}</span>`;
  };
  paintSave(isPropertySaved(propertyRef));
  saveBtn?.addEventListener("click", () => {
    const on = toggleProperty(propertyRef);
    paintSave(on);
    toast(on ? "Property saved to this browser" : "Removed from saved records");
  });

  const meta = root.querySelector("[data-property-meta]");
  if (meta) {
    meta.innerHTML = `<span>${isWaterloo ? "Waterloo" : "Kitchener"}, ON</span>
      ${building.ward ? `<span class="dot"></span><span>Ward ${escapeHtml(building.ward)}</span>` : ""}
      ${isWaterloo
        ? `<span class="dot"></span><span>Address record</span>`
        : `<span class="dot"></span><span>${formatNumber(building.unitCount || 1)} ${(building.unitCount || 1) === 1 ? "unit" : "units"}</span>`}
      <span class="dot"></span><span>${record.permits === null ? "Permits unavailable" : `${permits.length} ${permits.length === 1 ? "permit" : "permits"} on file`}</span>
      ${isSample() ? `<span class="dot"></span>${sampleTag()}` : ""}`;
  }

  const totalUnits = building.unitCount || 1;
  const publicUnits = (building.publicOwners || []).reduce((sum, o) => sum + o.units, 0);
  const privateUnits = Math.max(0, totalUnits - publicUnits);

  const ownerCard = isWaterloo ? waterlooOwnerCard(building) : kitchenerOwnerCard(building, publicUnits, privateUnits);
  const unitsCard = !isWaterloo ? unitsSection(building, rows, record.truncated) : "";
  const permitsCard = permitsSection(permits, city, record.permits === null);
  const factsCard = factsSection(building, rows, permits, city);

  root.querySelector("[data-property]").innerHTML = `
    <div class="property-layout">
      <div class="property-main">
        ${ownerCard}
        ${unitsCard}
        ${permitsCard}
        ${factsCard}
      </div>
      <aside class="side">
        <div class="map-card side-map">
          <div class="map-card__canvas" id="property-map" aria-label="Location of ${escapeHtml(building.address)}"></div>
          <div class="map-card__overlay"><span class="dot"></span><span>${isWaterloo ? "Waterloo" : "Kitchener"} · ${formatCoords(building.lat, building.lng)}</span></div>
        </div>
        ${officialLinks(city)}
        <div class="callout">
          <h3>${icon("info")} About this record</h3>
          <p>Assembled live from ${isWaterloo ? "the City of Waterloo's address and permit data" : "the City of Kitchener's ownership and permit data"}. Owner names are shown only where the city publishes them. Always verify with the official source.</p>
        </div>
      </aside>
    </div>`;

  renderMap(root.querySelector("#property-map"), [{
    key: building.key,
    lat: building.lat,
    lng: building.lng,
    label: building.address,
  }], {
    big: true,
    zoom: 16,
    ariaLabel: `Map showing ${building.address} in ${isWaterloo ? "Waterloo" : "Kitchener"}`,
  });

  // Make the coordinates a link when we have them.
  if (Number.isFinite(Number(building.lat)) && Number.isFinite(Number(building.lng))) {
    const coordEl = root.querySelector("[data-osm]");
    if (coordEl) coordEl.href = openStreetMapLink(building.lat, building.lng);
  }
}

/* ------------------------------------------------------------------ */

function kitchenerOwnerCard(building, publicUnits, privateUnits) {
  const totalUnits = building.unitCount || 1;
  const publicOwners = building.publicOwners || [];

  if (!publicOwners.length) {
    return `<div class="card">
      <div class="private-callout">
        <div class="private-callout__icon">${icon("shield", "ico--lg")}</div>
        <div>
          <h3>Owner name is private</h3>
          <p>This property is individually owned, so the City of Kitchener does not publish the owner's name under Ontario's Municipal Freedom of Information and Protection of Privacy Act. The city does record that it is privately owned.</p>
          <p style="margin-top:8px"><a href="#/about">How to request a residential ownership record →</a></p>
        </div>
      </div>
    </div>`;
  }

  const primary = publicOwners[0];
  const others = publicOwners.slice(1, 6);

  return `<div class="card">
    <div class="card__head">
      <h2>${icon("building")} Owner on file</h2>
      <span class="link">${privateUnits > 0 ? `${formatNumber(publicUnits)} of ${formatNumber(totalUnits)} units named` : "All units named"}</span>
    </div>
    <div class="owner-of-record">
      <div class="owner-mono" aria-hidden="true">${escapeHtml(monogramSafe(primary.name))}</div>
      <div class="owner-of-record__body">
        <div class="owner-of-record__label">Published owner</div>
        <div class="owner-of-record__name"><a href="${buildOwnerHref(primary.name)}">${escapeHtml(primary.name)}</a></div>
        <div class="owner-of-record__meta">${escapeHtml(ownerTypeLabel(ownerType(primary.name)))} · ${formatNumber(primary.units)} ${primary.units === 1 ? "unit" : "units"} at this address</div>
      </div>
      <a class="btn" href="${buildOwnerHref(primary.name)}">View portfolio ${icon("arrow-right", "ico--sm")}</a>
    </div>
    ${others.length ? `<div style="margin-top:18px;border-top:1px solid var(--line);padding-top:14px">
      <div class="eyebrow" style="margin-bottom:9px">Other named owners here</div>
      ${others.map((o) => `<div class="fact" style="border-bottom:1px solid #f0ebdf">
        <dt><a href="${buildOwnerHref(o.name)}" style="color:var(--green-2);text-decoration:underline;text-underline-offset:2px">${escapeHtml(o.name)}</a></dt>
        <dd>${formatNumber(o.units)} ${o.units === 1 ? "unit" : "units"}</dd>
      </div>`).join("")}
      ${publicOwners.length > 6 ? `<p style="font-size:11px;color:var(--muted);margin-top:8px">+ ${publicOwners.length - 6} more named owners</p>` : ""}
    </div>` : ""}
    ${privateUnits > 0 ? `<p style="margin-top:14px;font-size:11.5px;color:var(--muted)">${formatNumber(privateUnits)} ${privateUnits === 1 ? "unit is" : "units are"} individually owned and not named in the public data.</p>` : ""}
  </div>`;
}

function waterlooOwnerCard(building) {
  return `<div class="card">
    <div class="private-callout">
      <div class="private-callout__icon">${icon("pin", "ico--lg")}</div>
      <div>
        <h3>Owner names aren't published for Waterloo</h3>
        <p>The City of Waterloo publishes civic addresses and building permits, but not property ownership. To identify the owner of record, use MPAC's property information or an ONLAND parcel register search. Both are linked below.</p>
        <p style="margin-top:8px"><a href="https://www.aboutmyproperty.ca/" target="_blank" rel="noopener">MPAC AboutMyProperty</a> · <a href="https://www.onland.ca/" target="_blank" rel="noopener">ONLAND parcel register</a> · <a href="#/about">Data guide</a></p>
      </div>
    </div>
  </div>`;
}

function unitsSection(building, rows, truncated) {
  const totalUnits = building.unitCount || 1;
  const publicOwners = building.publicOwners || [];

  if (totalUnits <= 1) {
    return "";
  }

  if (totalUnits <= 40) {
    const sorted = rows.slice().sort((a, b) => naturalCompare(a.unit || "", b.unit || ""));
    return `<div class="card">
      <div class="card__head">
        <h2>${icon("list")} Units at this address</h2>
        <span class="link">${formatNumber(totalUnits)} ${totalUnits === 1 ? "unit" : "units"}</span>
      </div>
      <table class="units-table">
        <thead><tr><th>Unit</th><th>Owner on file</th></tr></thead>
        <tbody>
          ${sorted.map((r) => `<tr>
            <td class="mono">${r.unit ? escapeHtml(r.unit) : "—"}</td>
            <td class="unit-owner">${r.owner === "PRIVATE"
              ? `<span class="tag tag--private">Private</span>`
              : `<a href="${buildOwnerHref(r.owner)}">${escapeHtml(r.owner)}</a>`}</td>
          </tr>`).join("")}
        </tbody>
      </table>
      ${truncated ? `<p style="margin-top:12px;font-size:11px;color:var(--muted)">Showing the first records returned by the city. This building has more units than fit in a single request.</p>` : ""}
    </div>`;
  }

  // Large building: summarise by owner instead of listing hundreds of units.
  return `<div class="card">
    <div class="card__head">
      <h2>${icon("list")} Owner breakdown</h2>
      <span class="link">${formatNumber(totalUnits)} units</span>
    </div>
    <table class="units-table">
      <thead><tr><th>Owner on file</th><th style="text-align:right">Units</th></tr></thead>
      <tbody>
        ${publicOwners.slice(0, 10).map((o) => `<tr>
          <td class="unit-owner"><a href="${buildOwnerHref(o.name)}">${escapeHtml(o.name)}</a></td>
          <td class="mono" style="text-align:right">${formatNumber(o.units)}</td>
        </tr>`).join("")}
        ${publicOwners.length > 10 ? `<tr><td colspan="2" style="font-size:11px;color:var(--muted)">+ ${publicOwners.length - 10} more named owners</td></tr>` : ""}
        ${(building.owners || []).some((o) => o.name === "PRIVATE") ? `<tr>
          <td><span class="tag tag--private">Private owners</span></td>
          <td class="mono" style="text-align:right">${formatNumber((building.owners.find((o) => o.name === "PRIVATE") || {}).units || 0)}</td>
        </tr>` : ""}
      </tbody>
    </table>
    <p style="margin-top:14px;font-size:11.5px;color:var(--muted)">This is a large multi-unit building. Individual unit records are listed in the owner's portfolio.</p>
  </div>`;
}

function permitsSection(permits, city, failed) {
  const cityName = city === "waterloo" ? "Waterloo" : "Kitchener";
  if (!permits.length) {
    return `<div class="card">
      <div class="card__head">
        <h2>${icon("doc")} Building permits</h2>
        <span class="link">${cityName}</span>
      </div>
      <p style="font-size:12.5px;color:var(--muted)">No permits were found in ${cityName}'s open permit dataset for this address. Coverage varies by year and by permit type.</p>
    </div>`;
  }

  return `<div class="card">
    <div class="card__head">
      <h2>${icon("doc")} Building permits</h2>
      <span class="link">${formatNumber(permits.length)} most recent</span>
    </div>
    <div class="permit-list">
      ${permits.map((p) => `<div class="permit">
        <div class="permit__date">${p.issued ? formatDate(p.issued) : (p.year || "—")}</div>
        <div>
          <div class="permit__title">${escapeHtml(p.type || "Building permit")}</div>
          ${p.description ? `<div class="permit__desc">${escapeHtml(p.description)}</div>` : ""}
          <div class="permit__meta">
            ${p.work ? `<span>${escapeHtml(p.work)}</span>` : ""}
            ${p.subWork ? `<span>${escapeHtml(p.subWork)}</span>` : ""}
            ${p.status ? `<span>${escapeHtml(p.status)}</span>` : ""}
            ${p.number ? `<span>${escapeHtml(p.number)}</span>` : ""}
            ${p.units ? `<span>${formatNumber(p.units)} units</span>` : ""}
          </div>
        </div>
        <div class="permit__value">${p.value != null ? formatCurrency(p.value) : "—"}<small>construction value</small></div>
      </div>`).join("")}
    </div>
  </div>`;
}

function factsSection(building, rows, permits, city) {
  const ids = Array.from(new Set(rows.map((r) => r.propertyUnitId).filter(Boolean))).slice(0, 3);
  const isWaterloo = city === "waterloo";
  const latestPermit = permits.find((p) => p.issued);

  return `<div class="card">
    <div class="card__head"><h2>${icon("grid")} Record details</h2></div>
    <dl class="facts">
      <div class="fact"><dt>City</dt><dd>${isWaterloo ? "Waterloo" : "Kitchener"}</dd></div>
      ${building.ward ? `<div class="fact"><dt>Ward</dt><dd>${escapeHtml(building.ward)}</dd></div>` : ""}
      <div class="fact"><dt>Units</dt><dd>${isWaterloo ? "Not published" : formatNumber(building.unitCount || 1)}</dd></div>
      <div class="fact"><dt>Ownership records</dt><dd>${rows.length ? formatNumber(rows.length) : "Not published"}</dd></div>
      ${isWaterloo ? `<div class="fact"><dt>Address ID</dt><dd>${escapeHtml(building.id || "—")}</dd></div>` : ""}
      <div class="fact"><dt>Civic number</dt><dd>${escapeHtml(building.civic || "—")}</dd></div>
      <div class="fact"><dt>Street</dt><dd>${escapeHtml(building.street || "—")}</dd></div>
      ${ids.length ? `<div class="fact"><dt>Property unit ID</dt><dd>${ids.map(escapeHtml).join(", ")}${rows.length > ids.length ? " …" : ""}</dd></div>` : ""}
      ${latestPermit ? `<div class="fact"><dt>Latest permit</dt><dd>${formatDate(latestPermit.issued)}</dd></div>` : ""}
      <div class="fact"><dt>Coordinates</dt><dd>${Number.isFinite(Number(building.lat)) && Number.isFinite(Number(building.lng))
        ? `<a href="#" data-osm target="_blank" rel="noopener">${formatCoords(building.lat, building.lng)}</a>`
        : "—"}</dd></div>
      <div class="fact"><dt>Data source</dt><dd>${isWaterloo ? "City of Waterloo" : "City of Kitchener"}</dd></div>
    </dl>
  </div>`;
}

function officialLinks(city) {
  const links = city === "waterloo"
    ? [OFFICIAL.waterlooProperty, OFFICIAL.mpac, OFFICIAL.onland, OFFICIAL.waterlooData]
    : [OFFICIAL.kitchenerProperty, OFFICIAL.mpac, OFFICIAL.onland, OFFICIAL.kitchenerData];

  return `<div class="card">
    <div class="card__head"><h2>${icon("external")} Official sources</h2></div>
    <div class="link-list">
      ${links.map((l) => `<a href="${l.href}" target="_blank" rel="noopener">
        ${icon("external")}
        <span>${escapeHtml(l.label)}<small>${escapeHtml(l.description)}</small></span>
        ${icon("arrow-right")}
      </a>`).join("")}
    </div>
  </div>`;
}

function monogramSafe(name) {
  const letters = String(name || "").replace(/[^A-Za-z0-9 ]/g, "").split(/\s+/).filter(Boolean);
  return letters.slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "—";
}

function renderBadRequest(root) {
  root.innerHTML = `<div class="page"><div class="wrap">
    ${emptyState({
      iconName: "pin",
      title: "No address selected",
      body: "Open a property from an address search to see its record.",
      actions: `<a class="btn btn--primary" href="#/">Search an address</a>`,
    })}
  </div></div>`;
}
