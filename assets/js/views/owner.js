import { getOwnerPortfolio, isSample } from "../data.js";
import {
  escapeHtml, formatNumber, monogram, ownerType, ownerTypeLabel, setPageTitle,
  sortBuildings, downloadFile, toCsv, slugify, formatDate,
  buildPropertyHref, isLinkableBuilding,
} from "../util.js";
import { icon, typeTag, breadcrumb, emptyState, toast, copyLink, printPage, sampleTag } from "../ui.js";
import { renderMap, pointsFromBuildings } from "../map.js";
import { isOwnerSaved, toggleOwner } from "../store.js";
import { SOURCES } from "../config.js";

export async function renderOwner(root, params, ctx = {}) {
  const rawName = (params.get("name") || "").trim();
  const name = rawName.toUpperCase();
  setPageTitle(rawName || "Owner");

  if (!name) {
    root.innerHTML = `<div class="page"><div class="wrap">
      ${emptyState({
        iconName: "building",
        title: "No owner selected",
        body: "Search for a business, institution or government owner to open its portfolio.",
        actions: `<a class="btn btn--primary" href="#/">Search the records</a>`,
      })}
    </div></div>`;
    return;
  }

  root.innerHTML = `
    <div class="page">
      <div class="wrap">
        ${breadcrumb([{ label: "Home", href: "#/" }, { label: "Owner", href: `#/search?q=${encodeURIComponent(rawName)}&mode=name&city=all` }, { label: rawName }])}
        <div class="print-header">
          <strong>Ledger KW</strong> · Public property records for Kitchener &amp; Waterloo · printed ${new Date().toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" })}
        </div>
        <header class="owner-head">
          <div class="owner-head__top">
            <div class="owner-mono" aria-hidden="true">${escapeHtml(monogram(name))}</div>
            <div style="min-width:0">
              <span class="eyebrow">Owner on file · City of Kitchener</span>
              <h1>${escapeHtml(rawName)}</h1>
              <div class="owner-head__tags">
                ${typeTag(name)}
                <span class="tag tag--city">Kitchener</span>
                ${isSample() ? sampleTag() : ""}
              </div>
              <p class="owner-head__meta" data-queried>Public ownership records · loaded from the city's live dataset</p>
            </div>
          </div>

          <div class="owner-head__actions">
            <button class="btn btn--primary" type="button" data-save aria-pressed="false">
              ${icon("bookmark", "ico--sm")} <span>Save owner</span>
            </button>
            <button class="btn" type="button" data-csv>${icon("download", "ico--sm")} Export CSV</button>
            <button class="btn" type="button" data-print>${icon("printer", "ico--sm")} Print</button>
            <button class="btn btn--ghost" type="button" data-copy>${icon("doc", "ico--sm")} Copy link</button>
          </div>

          <div class="owner-stats" aria-label="Portfolio summary">
            <div class="owner-stat"><b data-stat="buildings">—</b><span>Buildings</span></div>
            <div class="owner-stat"><b data-stat="units">—</b><span>Units / properties</span></div>
            <div class="owner-stat"><b data-stat="records">—</b><span>Ownership records</span></div>
            <div class="owner-stat"><b data-stat="type">${escapeHtml(ownerTypeLabel(ownerType(name)))}</b><span>Owner type</span></div>
          </div>
        </header>

        <div id="owner-content">
          <div class="owner-layout">
            <div>
              <div class="map-card" style="margin-top:26px">
                <div class="map-card__canvas" id="owner-map" aria-label="Map of this owner's properties"></div>
                <div class="map-card__overlay"><span class="dot"></span><span data-map-count>Loading map…</span></div>
              </div>
              <div class="toolbar">
                <h2>Properties on file</h2>
                <span class="count" data-building-count></span>
                <div class="toolbar__spacer"></div>
                <label class="toolbar__sort">Sort
                  <select data-sort>
                    <option value="street">Street A–Z</option>
                    <option value="units-desc">Most units</option>
                    <option value="units-asc">Fewest units</option>
                  </select>
                </label>
              </div>
              <div data-buildings>${Array.from({ length: 5 }, () => '<div class="skeleton skeleton--row"></div>').join("")}</div>
            </div>
            <aside class="owner-aside">
              <div class="callout">
                <h3>${icon("doc")} About this portfolio</h3>
                <p>Every record in the City of Kitchener's public ownership layer where the owner name is <b>${escapeHtml(rawName)}</b>. Unit-level records are grouped by civic address.</p>
              </div>
              <div class="callout callout--warm">
                <h3>${icon("info")} Buildings vs. records</h3>
                <p>The source repeats some rows and lists individual units separately. “Buildings” and “units” here are deduplicated; “ownership records” is the raw count returned by the city.</p>
              </div>
              <div class="callout">
                <h3>${icon("external")} Source</h3>
                <p><a href="${SOURCES.kitchenerOwnership.portal}" target="_blank" rel="noopener">City of Kitchener — Property Ownership Public</a><br>${escapeHtml(SOURCES.kitchenerOwnership.cadence)} · Open Government Licence.</p>
              </div>
              <div class="callout callout--dark">
                <h3>${icon("shield")} Not a title search</h3>
                <p>This is the city's assessment/ownership record, not a legal title. Verify with an <a href="https://www.onland.ca/" target="_blank" rel="noopener">ONLAND parcel register</a> before relying on it.</p>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </div>`;

  // Static actions can be wired immediately.
  const saved = isOwnerSaved(name);
  const saveBtn = root.querySelector("[data-save]");
  const paintSave = (on) => {
    if (!saveBtn) return;
    saveBtn.setAttribute("aria-pressed", on ? "true" : "false");
    saveBtn.classList.toggle("btn--primary", !on);
    saveBtn.innerHTML = `${icon("bookmark", "ico--sm")} <span>${on ? "Saved" : "Save owner"}</span>`;
  };
  paintSave(saved);
  saveBtn?.addEventListener("click", () => {
    const on = toggleOwner(name, { type: ownerType(name) });
    paintSave(on);
    toast(on ? "Owner saved to this browser" : "Removed from saved records");
  });

  root.querySelector("[data-print]")?.addEventListener("click", printPage);
  root.querySelector("[data-copy]")?.addEventListener("click", copyLink);

  let portfolio;
  try {
    portfolio = await getOwnerPortfolio(name, { signal: ctx.signal });
  } catch (err) {
    if (err && err.name === "AbortError") return;
    const content = root.querySelector("#owner-content");
    if (content) {
      content.innerHTML = `<div class="inline-error" style="margin-top:26px">${icon("info")}<div>
        <strong>The portfolio could not be loaded</strong>${escapeHtml(err.message)}
        <div style="margin-top:10px"><button class="btn btn--tiny" type="button" data-retry>${icon("refresh", "ico--xs")} Retry</button></div>
      </div></div>`;
      content.querySelector("[data-retry]")?.addEventListener("click", () => renderOwner(root, params, ctx));
    }
    return;
  }

  if (ctx.signal && ctx.signal.aborted) return;

  const queried = root.querySelector("[data-queried]");
  if (queried) {
    queried.textContent = `Public ownership records · ${isSample() ? "offline sample extract" : "queried live"} ${formatDate(new Date())}`;
  }

  const buildings = portfolio.buildings || [];
  const rows = portfolio.rows || [];

  if (!buildings.length) {
    const content = root.querySelector("#owner-content");
    if (content) {
      content.innerHTML = `<div style="margin-top:26px">${emptyState({
        iconName: "building",
        title: "No properties found",
        body: `The public ownership data has no records under <b>${escapeHtml(rawName)}</b>. Owner names can change when a property is transferred. Try a shorter search or a different spelling.`,
        actions: `<a class="btn btn--primary" href="#/search?q=${encodeURIComponent(rawName)}&mode=name&city=all">Search this name again</a>
          <a class="btn" href="#/about">Why might a record be missing?</a>`,
      })}</div>`;
    }
    return;
  }

  const totalUnits = buildings.reduce((sum, b) => sum + (b.unitCount || 1), 0);
  const setStat = (key, value) => {
    const el = root.querySelector(`[data-stat="${key}"]`);
    if (el) el.textContent = value;
  };
  setStat("buildings", formatNumber(buildings.length));
  setStat("units", formatNumber(totalUnits));
  setStat("records", formatNumber(rows.length));

  const countEl = root.querySelector("[data-building-count]");
  if (countEl) countEl.textContent = `${formatNumber(buildings.length)} ${buildings.length === 1 ? "building" : "buildings"} · ${formatNumber(totalUnits)} units`;

  const mapPoints = pointsFromBuildings(buildings);
  const mapApi = renderMap(root.querySelector("#owner-map"), mapPoints, {
    onSelect: (key) => jumpToBuilding(key),
    ariaLabel: `Map of ${mapPoints.length} properties owned by ${rawName} in Kitchener`,
  });
  const mapCount = root.querySelector("[data-map-count]");
  if (mapCount) mapCount.textContent = `${formatNumber(mapPoints.length)} mapped ${mapPoints.length === 1 ? "property" : "properties"}`;

  const listEl = root.querySelector("[data-buildings]");
  let currentSort = "street";

  function jumpToBuilding(key) {
    const el = root.querySelector(`[data-building-key="${cssEscape(key)}"]`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("is-highlight");
    setTimeout(() => el.classList.remove("is-highlight"), 2200);
    if (mapApi && mapApi.focus) mapApi.focus(key);
  }

  function buildingHtml(building, index) {
    const units = building.unitList || [];
    const shown = units.slice(0, 18);
    const more = units.length - shown.length;
    const linkable = isLinkableBuilding(building);
    const details = units.length
      ? `<details class="record__units">
          <summary>${icon("chevron")} ${formatNumber(units.length)} ${units.length === 1 ? "unit" : "units"} on file</summary>
          <div class="unit-chips">
            ${shown.map((u) => `<span class="unit-chip">Unit ${escapeHtml(u)}</span>`).join("")}
            ${more > 0 ? `<span class="unit-chip unit-chip--more">+${formatNumber(more)} more</span>` : ""}
          </div>
        </details>`
      : "";
    const addressEl = linkable
      ? `<a class="record__address" href="${buildPropertyHref(building)}">${escapeHtml(building.address)}</a>`
      : `<span class="record__address">${escapeHtml(building.address)}</span>`;
    return `<li class="record" data-building-key="${escapeHtml(building.key)}">
      <div class="record__head">
        <span class="record__no">${String(index + 1).padStart(2, "0")}</span>
        <div style="min-width:0">
          ${addressEl}
          <div class="record__meta">
            <span class="tag tag--city">Kitchener</span>
            <span>${formatNumber(building.unitCount)} ${building.unitCount === 1 ? "unit" : "units"}</span>
            <span class="dot"></span>
            <span>${formatNumber(building.rows)} ${building.rows === 1 ? "record" : "records"}</span>
            ${!linkable ? `<span class="dot"></span><span class="muted">No civic number on file</span>` : ""}
          </div>
        </div>
        <div class="record__actions">
          <button class="record__link" type="button" data-map-jump="${escapeHtml(building.key)}" aria-label="Show ${escapeHtml(building.address)} on the map" title="Show on map">${icon("pin")}</button>
          ${linkable ? `<a class="record__link" href="${buildPropertyHref(building)}" aria-label="Open property record for ${escapeHtml(building.address)}">${icon("arrow-right")}</a>` : ""}
        </div>
      </div>
      ${details}
    </li>`;
  }

  function paintList() {
    const sorted = sortBuildings(buildings, currentSort);
    listEl.innerHTML = `<ol class="building-list">${sorted.map(buildingHtml).join("")}</ol>`;
    listEl.querySelectorAll("[data-map-jump]").forEach((btn) => {
      btn.addEventListener("click", () => jumpToBuilding(btn.dataset.mapJump));
    });
  }

  paintList();

  root.querySelector("[data-sort]")?.addEventListener("change", (e) => {
    currentSort = e.target.value;
    paintList();
  });

  root.querySelector("[data-csv]")?.addEventListener("click", () => {
    const header = ["Owner", "Address", "Unit", "City", "Property unit ID", "Latitude", "Longitude"];
    const sortedRows = rows.slice().sort((a, b) =>
      String(a.street).localeCompare(String(b.street)) ||
      Number(a.civic) - Number(b.civic) ||
      String(a.unit || "").localeCompare(String(b.unit || ""), undefined, { numeric: true })
    );
    const data = sortedRows.map((r) => [
      r.owner,
      `${r.civic || ""} ${r.street || ""}`.trim(),
      r.unit || "",
      "Kitchener",
      r.propertyUnitId || "",
      r.lat != null ? r.lat : "",
      r.lng != null ? r.lng : "",
    ]);
    downloadFile(`${slugify(name)}-ledger-kw.csv`, toCsv([header, ...data]));
    toast("CSV downloaded");
  });

  if (portfolio.truncated) {
    const note = document.createElement("p");
    note.className = "sample-note";
    note.style.marginTop = "14px";
    note.innerHTML = `${icon("info")} This portfolio is very large. Showing the first ${formatNumber(rows.length)} records.`;
    listEl.appendChild(note);
  }
}

function cssEscape(value) {
  if (window.CSS && typeof window.CSS.escape === "function") return window.CSS.escape(value);
  return String(value).replace(/["\\]/g, "\\$&");
}
