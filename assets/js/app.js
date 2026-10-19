/**
 * Ledger KW — application shell, router and bootstrap.
 */

import { initData, retryLive, state } from "./data.js";
import { parseHash } from "./util.js";
import { setNav, updateSavedBadge, setLiveState, icon, toast } from "./ui.js";
import { renderHome } from "./views/home.js";
import { renderSearch } from "./views/search.js";
import { renderOwner } from "./views/owner.js";
import { renderProperty } from "./views/property.js";
import { renderSaved } from "./views/saved.js";
import { renderAbout } from "./views/about.js";

const app = document.getElementById("app");
let activeController = null;
let renderToken = 0;

const routes = {
  "/": renderHome,
  "/search": renderSearch,
  "/owner": renderOwner,
  "/property": renderProperty,
  "/saved": renderSaved,
  "/about": renderAbout,
};

async function route() {
  if (!app) return;

  const { path, params } = parseHash(window.location.hash);
  const handler = routes[path];
  const token = ++renderToken;

  if (activeController) activeController.abort();
  activeController = new AbortController();
  const ctx = { signal: activeController.signal, token };

  setNav(path);
  window.scrollTo({ top: 0, behavior: "auto" });

  app.innerHTML = "";
  try {
    if (!handler) {
      renderNotFound(app, path);
      return;
    }
    await handler(app, params, ctx);
    if (params.get("section")) {
      const target = document.getElementById(params.get("section"));
      if (target) setTimeout(() => target.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
    }
  } catch (err) {
    if (err && err.name === "AbortError") return;
    if (token !== renderToken) return;
    console.error(err);
    app.innerHTML = `<div class="page"><div class="wrap">
      <div style="max-width:620px;margin:40px auto;text-align:center">
        <span class="eyebrow">Something went wrong</span>
        <h1 style="font-size:38px;margin:12px 0">This view could not be rendered</h1>
        <p style="color:var(--muted);font-size:14px">${escapeText(err && err.message ? err.message : "Unexpected error")}</p>
        <div style="margin-top:22px;display:flex;gap:8px;justify-content:center;flex-wrap:wrap">
          <a class="btn btn--primary" href="#/">Back to search</a>
          <button class="btn" type="button" onclick="location.reload()">Reload</button>
        </div>
      </div>
    </div></div>`;
  }
}

function renderNotFound(root, path) {
  root.innerHTML = `<div class="page"><div class="wrap">
    <div style="max-width:560px;margin:48px auto;text-align:center">
      <span class="eyebrow">404 · No such record</span>
      <h1 style="font-size:48px;margin:14px 0 10px">That page isn't here.</h1>
      <p style="color:var(--muted);font-size:14px">The link <code>${escapeText(path)}</code> doesn't match anything in Ledger KW. Start with a name or an address.</p>
      <div style="margin-top:24px"><a class="btn btn--primary" href="#/">${icon("search", "ico--sm")} Search the records</a></div>
    </div>
  </div></div>`;
}

function escapeText(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function wireGlobal() {
  const year = document.getElementById("footer-year");
  if (year) year.textContent = String(new Date().getFullYear());

  updateSavedBadge();
  window.addEventListener("saved:change", updateSavedBadge);

  window.addEventListener("hashchange", route);

  document.addEventListener("keydown", (e) => {
    if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
    const tag = (e.target && e.target.tagName) || "";
    if (/INPUT|TEXTAREA|SELECT/.test(tag) || (e.target && e.target.isContentEditable)) return;
    const input = document.querySelector(".search-card input");
    if (input) {
      e.preventDefault();
      input.focus();
      input.select();
    }
  });

  const retry = document.getElementById("retry-live");
  if (retry) {
    retry.addEventListener("click", async () => {
      retry.disabled = true;
      retry.innerHTML = `${icon("refresh", "ico--xs")} Checking…`;
      await retryLive();
      retry.disabled = false;
      retry.innerHTML = `${icon("refresh", "ico--xs")} Retry live data`;
      setLiveState(state.live ? "live" : "sample");
      toast(state.live ? "Live city data restored" : "Still unable to reach the city service");
      if (state.live) await route();
    });
  }
}

async function boot() {
  wireGlobal();

  const appEl = document.getElementById("app");
  if (appEl) {
    appEl.innerHTML = `<div class="boot"><div class="boot__mark" aria-hidden="true"></div><p>Opening the public records…</p></div>`;
  }

  await initData();
  setLiveState(state.live ? "live" : "sample");
  await route();
}

boot();
