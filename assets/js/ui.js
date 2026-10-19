/**
 * Shared UI: icons, tags, the search combobox, toasts and small
 * rendering helpers used by every view.
 */

import { buildOwnerHref, buildPropertyHref, debounce, escapeHtml, formatNumber, isLinkableBuilding, ownerType, ownerTypeLabel, titleCaseStreet } from "./util.js";
import { suggestAddresses, suggestOwners } from "./data.js";
import { savedCount } from "./store.js";

export function icon(name, cls = "") {
  return `<svg class="ico ${cls}" aria-hidden="true" focusable="false"><use href="#i-${name}"></use></svg>`;
}

export function typeTag(name, extra = "") {
  const type = ownerType(name);
  return `<span class="tag tag--${type} ${extra}">${ownerTypeLabel(type)}</span>`;
}

export function sampleTag() {
  return `<span class="tag tag--sample">Sample</span>`;
}

export function cityTag(city) {
  return `<span class="tag tag--city">${city === "waterloo" ? "Waterloo" : "Kitchener"}</span>`;
}

export function formatCurrency(value) {
  if (value == null || Number.isNaN(Number(value))) return "—";
  const n = Number(value);
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 1000) return `$${Math.round(n / 1000).toLocaleString("en-CA")}K`;
  return `$${formatNumber(n)}`;
}

export function formatCoords(lat, lng) {
  if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) return "—";
  return `${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}`;
}

let toastTimer = null;
export function toast(message, ms = 2600) {
  const el = document.getElementById("toast");
  const text = document.getElementById("toast-text");
  if (!el || !text) return;
  text.textContent = message;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, ms);
}

export function updateSavedBadge() {
  const el = document.getElementById("saved-count");
  if (!el) return;
  const n = savedCount();
  el.textContent = String(n);
  el.hidden = n === 0;
}

export function setLiveState(mode, detail = {}) {
  const chip = document.getElementById("live-chip");
  const text = document.getElementById("live-text");
  const banner = document.getElementById("source-banner");
  const bannerText = document.getElementById("source-banner-text");
  if (!chip || !text) return;

  chip.classList.remove("is-sample", "is-offline", "is-checking");
  if (mode === "live") {
    text.textContent = "Live city data";
    chip.title = "Live queries to City of Kitchener and City of Waterloo open data";
    if (banner) banner.hidden = true;
  } else {
    chip.classList.add("is-sample");
    text.textContent = "Sample data";
    chip.title = "The live city services could not be reached; a small real-data sample is shown.";
    if (banner && bannerText) {
      banner.hidden = false;
      bannerText.textContent = detail.message ||
        "The live city service could not be reached from this browser. You're browsing a small sample extract of real Kitchener records.";
    }
  }
}

export function setNav(path) {
  const map = { "/": "search", "/search": "search", "/owner": "search", "/property": "search", "/saved": "saved", "/about": "about" };
  const current = map[path] || "";
  document.querySelectorAll("[data-nav]").forEach((a) => {
    if (a.dataset.nav === current) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
}

export function skeletons(count = 4) {
  return Array.from({ length: count }, () => '<div class="skeleton skeleton--row"></div>').join("");
}

export function emptyState({ iconName = "search", title, body, actions = "" }) {
  return `<div class="empty">
    <div class="empty__icon">${icon(iconName, "ico--lg")}</div>
    <h2>${escapeHtml(title)}</h2>
    <p>${body}</p>
    ${actions ? `<div class="empty__links">${actions}</div>` : ""}
  </div>`;
}

export function copyLink() {
  const url = window.location.href;
  const done = () => toast("Link copied to clipboard");
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url).then(done).catch(() => fallbackCopy(url, done));
  } else {
    fallbackCopy(url, done);
  }
}

function fallbackCopy(text, done) {
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand("copy"); done(); } catch { toast("Could not copy the link"); }
  ta.remove();
}

export function printPage() {
  window.print();
}

/* ------------------------------------------------------------------ */
/* Search combobox                                                     */
/* ------------------------------------------------------------------ */

let searchSeq = 0;

export function mountSearch(slot, options = {}) {
  if (!slot) return null;
  const id = `search-${++searchSeq}`;
  const docController = new AbortController();
  if (options.signal) {
    if (options.signal.aborted) docController.abort();
    else options.signal.addEventListener("abort", () => docController.abort(), { once: true });
  }
  const state = {
    mode: options.mode === "address" ? "address" : "name",
    city: ["all", "kitchener", "waterloo"].includes(options.city) ? options.city : "all",
    query: options.query || "",
    active: -1,
    items: [],
    loading: false,
    open: false,
  };
  let controller = null;

  slot.innerHTML = `
    <form class="search-card ${options.compact ? "search-card--compact" : ""}" role="search" novalidate>
      <div class="search-card__modes" role="tablist" aria-label="Search by">
        <button type="button" class="mode" role="tab" data-mode="name" aria-selected="true">
          ${icon("building")} Owner <span class="mode__long">&nbsp;/ business</span>
        </button>
        <button type="button" class="mode" role="tab" data-mode="address" aria-selected="false">
          ${icon("pin")} Address
        </button>
        <span class="search-card__hint">Kitchener + Waterloo</span>
      </div>
      <div class="search-card__field">
        ${icon("search", "search-ico")}
        <input id="${id}" type="text" name="q" autocomplete="off" spellcheck="false"
          role="combobox" aria-autocomplete="list" aria-expanded="false"
          aria-controls="${id}-list" aria-label="Search public property records" />
        <button type="button" class="search-clear" aria-label="Clear search">${icon("close")}</button>
        <button type="submit" class="btn btn--primary">Search ${icon("arrow-right", "ico--sm")}</button>
      </div>
      <div class="search-card__foot">
        <div class="city-toggle" role="group" aria-label="Filter by city">
          <button type="button" data-city="all">All</button>
          <button type="button" data-city="kitchener">Kitchener</button>
          <button type="button" data-city="waterloo">Waterloo</button>
        </div>
        <span class="city-static">Kitchener only</span>
        <span class="search-card__tip"></span>
      </div>
      <div class="suggest" id="${id}-list" role="listbox" aria-label="Suggestions" hidden></div>
    </form>`;

  const form = slot.querySelector("form");
  const input = form.querySelector("input");
  const clearBtn = form.querySelector(".search-clear");
  const list = form.querySelector(".suggest");
  const tip = form.querySelector(".search-card__tip");

  input.value = state.query;

  function tipText() {
    if (state.mode === "name") return "Public business, institution & government owners";
    return "Any home or building in Kitchener or Waterloo";
  }

  function syncControls() {
    form.dataset.mode = state.mode;
    form.querySelectorAll("[data-mode]").forEach((btn) => {
      const active = btn.dataset.mode === state.mode;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-selected", active ? "true" : "false");
    });
    form.querySelectorAll("[data-city]").forEach((btn) => {
      const active = btn.dataset.city === state.city;
      btn.classList.toggle("is-active", active);
      const disabled = state.mode === "name" && btn.dataset.city === "waterloo";
      btn.disabled = disabled;
      btn.title = disabled ? "Waterloo does not publish owner names — switch to address search" : "";
    });
    tip.textContent = tipText();
    input.placeholder = state.mode === "name"
      ? "Try “Drewlo Holdings” or “Boardwalk”"
      : "Try “35 Homewood Ave” or “213 Pastern Trail”";
    clearBtn.classList.toggle("is-visible", !!input.value);
  }

  function closeSuggestions() {
    state.open = false;
    state.active = -1;
    list.hidden = true;
    list.innerHTML = "";
    input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant");
  }

  function openSuggestions() {
    if (!list.innerHTML) return;
    state.open = true;
    list.hidden = false;
    input.setAttribute("aria-expanded", "true");
  }

  function renderSuggestions(items, q) {
    state.items = items;
    if (!items.length) {
      list.innerHTML = state.mode === "name"
        ? `<div class="suggest__empty">No public owner names match “${escapeHtml(q)}”. Residential owners are privacy-protected — try an address instead.</div>`
        : `<div class="suggest__empty">No addresses found for “${escapeHtml(q)}”. Try a civic number and street, like “35 Homewood Ave”.</div>`;
      openSuggestions();
      return;
    }

    const label = state.mode === "name" ? "Matching owners" : "Matching addresses";
    const rows = items.map((item, i) => {
      if (state.mode === "name") {
        return `<button type="button" class="suggest__item" role="option" data-index="${i}" id="${id}-opt-${i}">
          ${icon("building")}
          <span><strong>${escapeHtml(item.name)}</strong>
          <small>${formatNumber(item.count)} ${item.count === 1 ? "record" : "records"} · Kitchener</small></span>
          ${typeTag(item.name)}
        </button>`;
      }
      return `<button type="button" class="suggest__item" role="option" data-index="${i}" id="${id}-opt-${i}">
        ${icon("pin")}
        <span><strong>${escapeHtml(item.address)}</strong>
        <small>${item.city === "waterloo" ? "Waterloo" : "Kitchener"}${item.count > 1 ? ` · ${formatNumber(item.count)} records` : ""}</small></span>
        ${cityTag(item.city)}
      </button>`;
    }).join("");

    list.innerHTML = `<div class="suggest__label">${label}</div>${rows}
      <button type="button" class="suggest__all" data-all="1">
        <span>Search all results for “${escapeHtml(q)}”</span>${icon("arrow-right", "ico--sm")}
      </button>`;
    openSuggestions();
  }

  function setActive(index) {
    const opts = Array.from(list.querySelectorAll(".suggest__item"));
    if (!opts.length) return;
    state.active = (index + opts.length) % opts.length;
    opts.forEach((el, i) => el.classList.toggle("is-active", i === state.active));
    const el = opts[state.active];
    input.setAttribute("aria-activedescendant", el.id);
    el.scrollIntoView({ block: "nearest" });
  }

  function choose(index) {
    const item = state.items[index];
    if (!item) return;
    closeSuggestions();
    if (state.mode === "name") {
      window.location.hash = buildOwnerHref(item.name);
    } else {
      window.location.hash = buildPropertyHref(item);
    }
  }

  function goSearch() {
    const q = input.value.trim();
    if (!q) {
      toast(state.mode === "name" ? "Type an owner name to search" : "Type an address to search");
      input.focus();
      return;
    }
    const mode = state.mode;
    const city = state.city;
    window.location.hash = `#/search?q=${encodeURIComponent(q)}&mode=${mode}&city=${city}`;
  }

  const fetchSuggestions = debounce(async (q) => {
    if (!form.isConnected) return;
    if (controller) controller.abort();
    controller = new AbortController();
    state.loading = true;
    try {
      let items;
      if (state.mode === "name") {
        items = await suggestOwners(q, { signal: controller.signal, limit: 6 });
      } else {
        items = await suggestAddresses(q, { signal: controller.signal, limit: 6 });
      }
      if (input.value.trim() !== q) return;
      renderSuggestions(items, q);
    } catch (err) {
      if (err && err.name === "AbortError") return;
      // Suggestions are best-effort; the full search surfaces errors.
    } finally {
      state.loading = false;
    }
  }, 230);

  input.addEventListener("input", () => {
    state.query = input.value;
    clearBtn.classList.toggle("is-visible", !!input.value);
    const q = input.value.trim();
    if (q.length < 2) {
      if (controller) controller.abort();
      closeSuggestions();
      return;
    }
    fetchSuggestions(q);
    if (state.mode === "address" || list.innerHTML) openSuggestions();
  });

  input.addEventListener("focus", () => {
    if (state.items.length && input.value.trim()) openSuggestions();
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { closeSuggestions(); input.blur(); return; }
    if (e.key === "ArrowDown") {
      if (!state.open && state.items.length) { openSuggestions(); }
      e.preventDefault();
      setActive(state.active + 1);
      return;
    }
    if (e.key === "ArrowUp") {
      if (!state.open && state.items.length) { openSuggestions(); }
      e.preventDefault();
      setActive(state.active - 1);
      return;
    }
    if (e.key === "Enter") {
      if (state.open && state.active >= 0) {
        e.preventDefault();
        choose(state.active);
      } else {
        e.preventDefault();
        closeSuggestions();
        goSearch();
      }
    }
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    closeSuggestions();
    goSearch();
  });

  clearBtn.addEventListener("click", () => {
    input.value = "";
    state.query = "";
    clearBtn.classList.remove("is-visible");
    closeSuggestions();
    input.focus();
  });

  form.querySelectorAll("[data-mode]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (state.mode === btn.dataset.mode) return;
      state.mode = btn.dataset.mode;
      if (state.mode === "name") state.city = "all";
      closeSuggestions();
      syncControls();
      input.focus();
      if (input.value.trim().length >= 2) fetchSuggestions(input.value.trim());
    });
  });

  form.querySelectorAll("[data-city]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.disabled) return;
      state.city = btn.dataset.city;
      if (state.city === "waterloo" && state.mode === "name") {
        state.mode = "address";
        toast("Waterloo publishes addresses, not owner names — switched to address search");
      }
      syncControls();
      input.focus();
    });
  });

  list.addEventListener("click", (e) => {
    const opt = e.target.closest(".suggest__item");
    if (opt) {
      choose(Number(opt.dataset.index));
      return;
    }
    const all = e.target.closest("[data-all]");
    if (all) {
      closeSuggestions();
      goSearch();
    }
  });

  document.addEventListener("click", (e) => {
    if (!form.contains(e.target)) closeSuggestions();
  }, { signal: docController.signal });

  if (options.autofocus) {
    setTimeout(() => input.focus({ preventScroll: true }), 120);
  }

  syncControls();
  if (state.query && state.query.trim().length >= 2) fetchSuggestions(state.query.trim());

  return {
    element: form,
    input,
    setQuery(q) { input.value = q; state.query = q; clearBtn.classList.toggle("is-visible", !!q); syncControls(); },
    setMode(m) { state.mode = m; syncControls(); },
    focus() { input.focus(); },
  };
}

/* ------------------------------------------------------------------ */
/* Small render helpers                                                */
/* ------------------------------------------------------------------ */

export function breadcrumb(items) {
  const parts = items.map((item, i) => {
    const isLast = i === items.length - 1;
    return item.href
      ? `<a href="${item.href}">${escapeHtml(item.label)}</a>`
      : `<span class="here">${escapeHtml(item.label)}</span>`;
  });
  return `<nav class="crumbs" aria-label="Breadcrumb">${parts.join('<span class="sep">/</span>')}</nav>`;
}

export function buildingRow(building, index, city) {
  const ownerLabel = building.city === "waterloo"
    ? `<span>Owner not published by the city</span>`
    : building.publicOwners && building.publicOwners.length
      ? `<span>${escapeHtml(building.publicOwners[0].name)}${building.publicOwners.length > 1 ? ` +${building.publicOwners.length - 1} more` : ""}</span>`
      : `<span class="muted">Owner name private</span>`;

  const inner = `
    <span class="result-row__icon">${icon(building.unitCount > 1 ? "building" : "pin")}</span>
    <span>
      <span class="result-row__name">${escapeHtml(building.address)}</span>
      <span class="result-row__meta">
        ${cityTag(building.city)}
        ${building.unitCount > 1 ? `<span>${formatNumber(building.unitCount)} units</span><span class="dot"></span>` : ""}
        ${building.city === "kitchener" && !building.civic ? `<span class="muted">No civic number on file</span>` : ownerLabel}
      </span>
    </span>
    <span class="result-row__tag"></span>
    <span class="result-row__go">${isLinkableBuilding(building) ? icon("arrow-right", "ico--sm") : ""}</span>`;

  if (!isLinkableBuilding(building)) {
    return `<div class="result-row">${inner}</div>`;
  }
  return `<a class="result-row" href="${buildPropertyHref(building)}">${inner}</a>`;
}

export { escapeHtml, titleCaseStreet };
