import { getOwnerPortfolio, searchAddresses, searchOwners, isSample } from "../data.js";
import {
  escapeHtml, formatNumber, monogram, normalizeName, setPageTitle,
  buildOwnerHref, buildPropertyHref, pluralize,
} from "../util.js";
import {
  mountSearch, icon, typeTag, cityTag, breadcrumb, skeletons,
  emptyState, buildingRow, sampleTag,
} from "../ui.js";

export async function renderSearch(root, params, ctx = {}) {
  const q = (params.get("q") || "").trim();
  const mode = params.get("mode") === "address" ? "address" : "name";
  const cityParam = params.get("city");
  const city = ["all", "kitchener", "waterloo"].includes(cityParam) ? cityParam : "all";

  setPageTitle(q ? `${q}` : "Search");

  if (!q) {
    root.innerHTML = `<div class="page"><div class="wrap">
      ${breadcrumb([{ label: "Home", href: "#/" }, { label: "Search" }])}
      ${emptyState({
        iconName: "search",
        title: "Search the records",
        body: "Look up a business, institution or address. Try a name like “Drewlo Holdings” or an address like “200 King St W”.",
        actions: `<a class="btn btn--primary" href="#/">Go to search</a>`,
      })}
    </div></div>`;
    return;
  }

  root.innerHTML = `
    <div class="page">
      <div class="wrap">
        ${breadcrumb([{ label: "Home", href: "#/" }, { label: "Search" }])}
        <div class="page-head">
          <div class="page-head__row">
            <div>
              <span class="eyebrow">${mode === "name" ? "Owner search" : "Address search"}</span>
              <h1><span class="qmark">“</span>${escapeHtml(q)}<span class="qmark">”</span></h1>
              <div class="result-meta" data-result-meta aria-live="polite">
                <span>Searching the ${mode === "name" ? "owner" : "address"} records…</span>
              </div>
            </div>
            <div class="page-head__actions">
              <a class="btn btn--ghost" href="#/">New search ${icon("close", "ico--xs")}</a>
            </div>
          </div>
          <div data-search-slot></div>
        </div>

        <div class="split">
          <div data-results aria-live="polite">${skeletons(5)}</div>
          <aside class="side">
            ${mode === "name" ? `
              <div class="callout">
                <h3>${icon("building")} What name search covers</h3>
                <p>Every owner name the City of Kitchener publishes: businesses, numbered companies, institutions and government agencies. Residential owners are marked “Private” under Ontario's privacy law.</p>
              </div>
              <div class="callout callout--warm">
                <h3>${icon("shield")} Looking for an individual?</h3>
                <p>Homeowner names are not in the open data. Use <a href="https://www.mpac.ca/en/PropertyOwners/AboutMyProperty" target="_blank" rel="noopener">MPAC AboutMyProperty</a> or an <a href="https://www.onland.ca/" target="_blank" rel="noopener">ONLAND parcel register</a> search.</p>
                <p><a href="#/about">The data guide explains the official routes →</a></p>
              </div>
            ` : `
              <div class="callout">
                <h3>${icon("pin")} Two cities, two datasets</h3>
                <p><b>Kitchener</b> publishes owner names for businesses, institutions and agencies. <b>Waterloo</b> publishes addresses and permits, but not owner names.</p>
              </div>
              <div class="callout callout--warm">
                <h3>${icon("info")} Better address searches</h3>
                <p>Include the street suffix (<i>St</i>, <i>Ave</i>, <i>Blvd</i>) and drop the unit number. Try “425 Wilson Ave” rather than “425 Wilson Avenue, Unit 711”.</p>
              </div>
            `}
            <div class="callout callout--dark">
              <h3>${icon("spark")} Save what you find</h3>
              <p>Open an owner or property and use the save button. Saved records stay in this browser — no account needed.</p>
            </div>
          </aside>
        </div>
      </div>
    </div>`;

  mountSearch(root.querySelector("[data-search-slot]"), {
    mode, city, query: q, compact: true, signal: ctx.signal,
  });

  const resultsEl = root.querySelector("[data-results]");
  const metaEl = root.querySelector("[data-result-meta]");

  async function load() {
    resultsEl.innerHTML = skeletons(5);
    metaEl.innerHTML = `<span>Searching the ${mode === "name" ? "owner" : "address"} records…</span>`;

    try {
      if (mode === "name") {
        const owners = await searchOwners(q, { signal: ctx.signal, limit: 45 });
        if (ctx.signal && ctx.signal.aborted) return;

        if (owners.length === 1 && normalizeName(owners[0].name) === normalizeName(q)) {
          window.location.replace(buildOwnerHref(owners[0].name));
          return;
        }

        const records = owners.reduce((sum, o) => sum + (Number(o.count) || 0), 0);
        metaEl.innerHTML = `<span><b>${formatNumber(owners.length)}</b> matching ${owners.length === 1 ? "owner" : "owners"}</span>
          <span class="dot"></span>
          <span><b>${formatNumber(records)}</b> property records</span>
          <span class="dot"></span>
          <span>City of Kitchener</span>
          ${isSample() ? sampleTag() : ""}`;

        if (!owners.length) {
          resultsEl.innerHTML = emptyState({
            iconName: "shield",
            title: "No public owner match",
            body: `No business, institution or government owner in Kitchener's open data matches <b>“${escapeHtml(q)}”</b>. If you're looking for an individual homeowner, Ontario privacy law means their name is not published. Try an address search instead.`,
            actions: `<a class="btn btn--primary" href="#/search?q=${encodeURIComponent(q)}&mode=address&city=all">Try this as an address ${icon("arrow-right", "ico--sm")}</a>
              <a class="btn" href="#/about">How to request an ownership record</a>`,
          });
          return;
        }

        resultsEl.innerHTML = `<div class="result-list">${owners.map((owner) => `
          <a class="result-row" href="${buildOwnerHref(owner.name)}">
            <span class="result-row__icon">${escapeHtml(monogram(owner.name))}</span>
            <span>
              <span class="result-row__name">${escapeHtml(owner.name)}</span>
              <span class="result-row__meta">
                <span>${formatNumber(owner.count)} ${owner.count === 1 ? "record" : "records"}</span>
                <span class="dot"></span>
                <span>Kitchener</span>
              </span>
            </span>
            <span class="result-row__tag">${typeTag(owner.name)}</span>
            <span class="result-row__go">${icon("arrow-right", "ico--sm")}</span>
          </a>`).join("")}</div>
          ${isSample() ? `<p class="sample-note" style="margin-top:14px">${icon("info")} Offline sample extract — only a few owners are available.</p>` : ""}`;
        return;
      }

      const result = await searchAddresses(q, city, { signal: ctx.signal });
      if (ctx.signal && ctx.signal.aborted) return;

      const buildings = result.buildings || [];

      if (buildings.length === 1 && result.parsed && result.parsed.civic && !result.truncated) {
        window.location.replace(buildPropertyHref(buildings[0]));
        return;
      }

      metaEl.innerHTML = `<span><b>${formatNumber(buildings.length)}</b> matching ${buildings.length === 1 ? "address" : "addresses"}</span>
        <span class="dot"></span>
        <span>${city === "all" ? "Kitchener + Waterloo" : (city === "waterloo" ? "Waterloo" : "Kitchener")}</span>
        ${isSample() ? sampleTag() : ""}`;

      if (!buildings.length) {
        resultsEl.innerHTML = emptyState({
          iconName: "pin",
          title: "No address found",
          body: `Nothing in the city address records matches <b>“${escapeHtml(q)}”</b>. Try adding the street suffix, dropping the unit number, or checking the spelling.`,
          actions: `<a class="btn btn--primary" href="#/search?q=${encodeURIComponent(q)}&mode=name&city=all">Search this as a name</a>`,
        });
        return;
      }

      resultsEl.innerHTML = `${result.errors && result.errors.length ? `<div class="inline-error" style="margin-bottom:12px">${icon("info")}<div><strong>One city's records did not load</strong>${escapeHtml(result.errors.map((e) => `${e.city}: ${e.message}`).join(" "))}</div></div>` : ""}
        <div class="result-list">${buildings.map((b) => buildingRow(b)).join("")}</div>
        ${result.truncated ? `<p class="sample-note" style="margin-top:14px">${icon("info")} Lots of records match this street search. Showing the first ${formatNumber(buildings.length)}; add a civic number to narrow it.</p>` : ""}
        ${isSample() ? `<p class="sample-note" style="margin-top:14px">${icon("info")} Offline sample extract — only a few addresses are available.</p>` : ""}`;
    } catch (err) {
      if (err && err.name === "AbortError") return;
      resultsEl.innerHTML = `<div class="inline-error">${icon("info")}<div>
        <strong>The search could not be completed</strong>
        ${escapeHtml(err.message || "The city service did not respond.")}
        <div style="margin-top:10px"><button class="btn btn--tiny" type="button" data-retry>${icon("refresh", "ico--xs")} Retry</button></div>
      </div></div>`;
      metaEl.innerHTML = `<span>Search unavailable</span>`;
      resultsEl.querySelector("[data-retry]")?.addEventListener("click", load);
    }
  }

  await load();
}
