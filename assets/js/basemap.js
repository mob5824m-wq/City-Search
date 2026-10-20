/**
 * The map.
 *
 * Street cover comes from Esri's ArcGIS Online World Street Map tile service,
 * which is served without a key or account. Everything that matters — the
 * projection, the scale bar, the north arrow, the markers — is drawn locally
 * as SVG, so if those tiles are blocked (a sandboxed preview, a proxy) the map
 * degrades to a plain coordinate-true canvas instead of an error.
 *
 * No third-party mapping library is used; the tile grid, pan, zoom and fit are
 * all implemented here.
 */

import { escapeHtml } from "./util.js";
import { MAP } from "./config.js";

const M_PER_DEG_LAT = 110574;
const M_PER_DEG_LNG = 111320;
const MIN_ZOOM = 10;
const MAX_ZOOM = 19;
const DEFAULT_SIZE = { width: 720, height: 420 };
const PAD = 54;
const TILE = 256;
/** Give up on tiles after this many failures in one frame. */
const TILE_FAIL_LIMIT = 4;

/* Ground resolution of a Web-Mercator tile at this zoom and latitude. */
export function metresPerPixel(zoom, lat) {
  return (156543.03392 * Math.cos((lat * Math.PI) / 180)) / Math.pow(2, zoom);
}

export function projectPoint(point, center, mpp, size) {
  const cosLat = Math.cos((center.lat * Math.PI) / 180);
  return {
    x: size.width / 2 + ((Number(point.lng) - center.lng) * M_PER_DEG_LNG * cosLat) / mpp,
    y: size.height / 2 - ((Number(point.lat) - center.lat) * M_PER_DEG_LAT) / mpp,
  };
}

export function fitView(points, size = DEFAULT_SIZE, pad = PAD) {
  const valid = (points || []).filter((p) => Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng)));
  if (!valid.length) {
    return { center: { lat: 43.4516, lng: -80.4925 }, mpp: metresPerPixel(13, 43.45) };
  }
  if (valid.length === 1) {
    // One property belongs at street level, never at a city-wide scale.
    const only = valid[0];
    return {
      center: { lat: Number(only.lat), lng: Number(only.lng) },
      mpp: metresPerPixel(16, Number(only.lat)),
    };
  }
  const lats = valid.map((p) => Number(p.lat));
  const lngs = valid.map((p) => Number(p.lng));
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const center = { lat: (minLat + maxLat) / 2, lng: (minLng + maxLng) / 2 };
  const cosLat = Math.cos((center.lat * Math.PI) / 180);
  const widthM = (maxLng - minLng) * M_PER_DEG_LNG * cosLat;
  const heightM = (maxLat - minLat) * M_PER_DEG_LAT;
  const usableW = Math.max(60, size.width - pad * 2);
  const usableH = Math.max(60, size.height - pad * 2);
  const needed = Math.max(widthM / usableW, heightM / usableH);
  const fallback = metresPerPixel(16, center.lat);
  const mpp = Math.min(
    metresPerPixel(MIN_ZOOM, center.lat),
    Math.max(metresPerPixel(MAX_ZOOM, center.lat), needed > 0 && Number.isFinite(needed) ? needed : fallback)
  );
  return { center, mpp };
}

/* ------------------------------------------------------------------ */
/* Slippy-tile maths                                                   */
/* ------------------------------------------------------------------ */

export function lonLatToTile(lat, lng, zoom) {
  const n = Math.pow(2, zoom);
  const clamped = Math.max(-85.05112878, Math.min(85.05112878, lat));
  const rad = (clamped * Math.PI) / 180;
  return {
    x: ((lng + 180) / 360) * n,
    y: ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n,
  };
}

export function zoomFor(mpp, lat) {
  const z = Math.log2((156543.03392 * Math.cos((lat * Math.PI) / 180)) / mpp);
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.round(z)));
}

/**
 * Work out which tiles cover the viewport, and where each one sits.
 * `scale` is the screen px per tile px (1 at an exact integer zoom).
 */
export function tileLayout(view, size, zoom = zoomFor(view.mpp, view.center.lat)) {
  const z = Math.max(0, Math.min(MAP.maxZoom || 19, zoom));
  const n = Math.pow(2, z);
  const world = lonLatToTile(view.center.lat, view.center.lng, z);
  const centerPx = { x: world.x * TILE, y: world.y * TILE };
  const scale = metresPerPixel(z, view.center.lat) / view.mpp;
  const half = { x: size.width / 2 / scale, y: size.height / 2 / scale };

  const x0 = Math.floor((centerPx.x - half.x) / TILE);
  const x1 = Math.floor((centerPx.x + half.x) / TILE);
  const y0 = Math.max(0, Math.floor((centerPx.y - half.y) / TILE));
  const y1 = Math.min(n - 1, Math.floor((centerPx.y + half.y) / TILE));

  const tiles = [];
  for (let ty = y0; ty <= y1; ty += 1) {
    for (let tx = x0; tx <= x1; tx += 1) {
      const wrapped = ((tx % n) + n) % n;
      tiles.push({
        key: `${z}/${wrapped}/${ty}`,
        z,
        x: wrapped,
        y: ty,
        left: (tx * TILE - centerPx.x) * scale + size.width / 2,
        top: (ty * TILE - centerPx.y) * scale + size.height / 2,
        size: TILE * scale,
      });
    }
  }
  return { zoom: z, scale, tiles };
}

function tileUrl(template, tile) {
  return template
    .replace("{z}", tile.z)
    .replace("{x}", tile.x)
    .replace("{y}", tile.y)
    .replace("{s}", "a");
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function niceDistance(target) {
  const pow = Math.pow(10, Math.floor(Math.log10(Math.max(1, target))));
  const n = target / pow;
  const step = n >= 5 ? 5 : n >= 2 ? 2 : 1;
  return step * pow;
}

function formatDistance(m) {
  return m >= 1000 ? `${m / 1000} km` : `${Math.round(m)} m`;
}

function pointLabel(p) {
  const text = String(p.label || p.address || "");
  return text.length > 28 ? `${text.slice(0, 27)}…` : text;
}

/* ------------------------------------------------------------------ */
/* The map                                                             */
/* ------------------------------------------------------------------ */

export function renderMap(container, points, options = {}) {
  if (!container) return null;

  if (container._ledgerMap) {
    container._ledgerMap.destroy();
    container._ledgerMap = null;
  }

  const valid = (points || []).filter(
    (p) => Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng))
  );

  if (!valid.length) {
    container.innerHTML = `<div class="locmap locmap--empty">
      <div class="locmap__empty">
        <strong>No coordinates on file</strong>
        <span>${escapeHtml(options.emptyMessage || "The city data for this record has no latitude and longitude.")}</span>
      </div>
    </div>`;
    return null;
  }

  const size = { ...DEFAULT_SIZE };
  let view = fitView(valid, size);
  if (valid.length === 1 && options.zoom) {
    view = {
      center: { lat: Number(valid[0].lat), lng: Number(valid[0].lng) },
      mpp: metresPerPixel(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, options.zoom)), Number(valid[0].lat)),
    };
  }
  let activeKey = options.activeKey || null;
  let destroyed = false;
  let tilesWanted = options.tiles !== false;
  let tilesBlocked = false;
  let hostIndex = 0;
  let failures = 0;
  let frame = 0;
  const tileEls = new Map();

  container.innerHTML = `<div class="locmap" data-locmap>
    <div class="locmap__tiles" data-tiles aria-hidden="true"></div>
    <svg class="locmap__svg" role="img"></svg>
    <div class="locmap__ui">
      <div class="locmap__zoom" role="group" aria-label="Map zoom">
        <button type="button" data-zoom="in" aria-label="Zoom in">+</button>
        <button type="button" data-zoom="out" aria-label="Zoom out">−</button>
        <button type="button" data-zoom="fit" aria-label="Fit all properties">Fit</button>
        <button type="button" data-basemap aria-pressed="true" aria-label="Toggle street map">Streets</button>
      </div>
      <a class="locmap__osm" data-osm-area target="_blank" rel="noopener">Open in OpenStreetMap</a>
    </div>
    <p class="locmap__attribution" data-attribution>${MAP.attribution}</p>
    <p class="locmap__note" data-note hidden></p>
  </div>`;

  const root = container.querySelector("[data-locmap]");
  const svg = root.querySelector("svg");
  const tileLayer = root.querySelector("[data-tiles]");
  const osmLink = root.querySelector("[data-osm-area]");
  const note = root.querySelector("[data-note]");
  const attribution = root.querySelector("[data-attribution]");
  const toggle = root.querySelector("[data-basemap]");

  function measure() {
    const width = container.clientWidth || DEFAULT_SIZE.width;
    const height = container.clientHeight || DEFAULT_SIZE.height;
    size.width = Math.max(240, Math.round(width));
    size.height = Math.max(160, Math.round(height));
  }

  function syncOsmLink() {
    osmLink.href = `https://www.openstreetmap.org/#map=${zoomFor(view.mpp, view.center.lat)}/${view.center.lat.toFixed(6)}/${view.center.lng.toFixed(6)}`;
  }

  /* --- street tiles ---------------------------------------------------- */

  function setBlocked(blocked) {
    tilesBlocked = blocked;
    tileLayer.hidden = blocked || !tilesWanted;
    root.classList.toggle("locmap--plain", blocked || !tilesWanted);
    root.classList.toggle("locmap--streets", !blocked && tilesWanted);
    attribution.hidden = blocked || !tilesWanted;
    note.hidden = !blocked;
    if (blocked) note.textContent = MAP.plainNote || "Street tiles unavailable";
    toggle.setAttribute("aria-pressed", String(!blocked && tilesWanted));
  }

  function clearTiles() {
    tileEls.forEach((el) => el.remove());
    tileEls.clear();
  }

  function drawTiles() {
    if (!tilesWanted || tilesBlocked) return;
    frame += 1;
    const layout = tileLayout(view, size);
    const template = MAP.tiles[hostIndex];
    const keep = new Set(layout.tiles.map((t) => t.key));

    // Drop tiles that scrolled out of view.
    tileEls.forEach((el, key) => {
      if (!keep.has(key)) {
        el.remove();
        tileEls.delete(key);
      }
    });

    layout.tiles.forEach((tile) => {
      let el = tileEls.get(tile.key);
      if (!el) {
        el = document.createElement("img");
        el.alt = "";
        el.decoding = "async";
        el.draggable = false;
        el.addEventListener("error", () => {
          failures += 1;
          if (failures < TILE_FAIL_LIMIT) return;
          failures = 0;
          if (hostIndex + 1 < MAP.tiles.length) {
            hostIndex += 1;
            clearTiles();
            drawTiles();
          } else {
            clearTiles();
            setBlocked(true);
          }
        });
        tileEls.set(tile.key, el);
        tileLayer.appendChild(el);
      }
      const src = tileUrl(template, tile);
      if (el.getAttribute("src") !== src) el.setAttribute("src", src);
      el.style.width = `${tile.size}px`;
      el.style.height = `${tile.size}px`;
      el.style.transform = `translate(${tile.left.toFixed(1)}px, ${tile.top.toFixed(1)}px)`;
    });

    setBlocked(false);
  }

  /* --- markers and chrome ---------------------------------------------- */

  function draw() {
    if (destroyed) return;
    const { center, mpp } = view;
    const project = (p) => projectPoint(p, center, mpp, size);

    const gridMeters = niceDistance(78 * mpp);
    const gridPx = gridMeters / mpp;
    const centrePx = { x: size.width / 2, y: size.height / 2 };

    let lines = "";
    const xStart = centrePx.x % gridPx;
    for (let x = xStart; x <= size.width; x += gridPx) {
      lines += `<line x1="${x.toFixed(1)}" y1="0" x2="${x.toFixed(1)}" y2="${size.height}"/>`;
    }
    const yStart = centrePx.y % gridPx;
    for (let y = yStart; y <= size.height; y += gridPx) {
      lines += `<line x1="0" y1="${y.toFixed(1)}" x2="${size.width}" y2="${y.toFixed(1)}"/>`;
    }

    const scaleMeters = niceDistance(96 * mpp);
    const scalePx = scaleMeters / mpp;

    const dense = valid.length > 10;
    const markers = valid.map((p, i) => {
      const { x, y } = project(p);
      const label = pointLabel(p);
      const active = p.key && p.key === activeKey;
      const r = options.big ? 7 : 5.4;
      return `<g class="locmap__marker${active ? " is-active" : ""}${dense ? " is-dense" : ""}"
          data-key="${escapeHtml(String(p.key || i))}" data-index="${i}"
          transform="translate(${x.toFixed(1)} ${y.toFixed(1)})"
          tabindex="0" role="button"
          aria-label="${escapeHtml(p.label || p.address || "Property")}">
        <title>${escapeHtml(p.label || p.address || "Property")}</title>
        <circle class="locmap__halo" r="${r + 6}"></circle>
        <circle class="locmap__dot" r="${r}"></circle>
        <text class="locmap__label" x="${r + 8}" y="4">${escapeHtml(label)}</text>
      </g>`;
    }).join("");

    svg.setAttribute("viewBox", `0 0 ${size.width} ${size.height}`);
    svg.setAttribute("width", size.width);
    svg.setAttribute("height", size.height);
    if (options.ariaLabel) svg.setAttribute("aria-label", options.ariaLabel);
    svg.innerHTML = `
      <g class="locmap__grid" aria-hidden="true">${lines}</g>
      <g class="locmap__scale" aria-hidden="true" transform="translate(14 ${size.height - 32})">
        <line x1="0" y1="0" x2="${scalePx.toFixed(1)}" y2="0"/>
        <line x1="0" y1="-4" x2="0" y2="4"/>
        <line x1="${scalePx.toFixed(1)}" y1="-4" x2="${scalePx.toFixed(1)}" y2="4"/>
        <text x="0" y="-8">${formatDistance(scaleMeters)}</text>
      </g>
      <g class="locmap__north" aria-hidden="true" transform="translate(${size.width - 22} 30)">
        <path d="M0 8 4.6 -2 0 -0.4 -4.6 -2Z"/>
        <text x="0" y="18">N</text>
      </g>
      <g class="locmap__markers">${markers}</g>`;

    root.classList.toggle("locmap--dense", dense);
    drawTiles();
    syncOsmLink();
  }

  function setView(next) {
    const lat = Math.max(-85, Math.min(85, next.center.lat));
    view = {
      center: { lat, lng: next.center.lng },
      mpp: Math.min(
        metresPerPixel(MIN_ZOOM, lat),
        Math.max(metresPerPixel(MAX_ZOOM, lat), next.mpp)
      ),
    };
    draw();
  }

  function zoomBy(factor) {
    setView({ center: view.center, mpp: view.mpp / factor });
  }

  function focus(key, zoom) {
    const point = valid.find((p) => String(p.key) === String(key));
    if (!point) return;
    activeKey = key;
    const targetZoom = zoom || 17;
    setView({
      center: { lat: Number(point.lat), lng: Number(point.lng) },
      mpp: metresPerPixel(targetZoom, Number(point.lat)),
    });
  }

  function fit() {
    view = fitView(valid, size);
    draw();
  }

  /* --- interaction ------------------------------------------------------ */

  let drag = null;
  svg.addEventListener("pointerdown", (e) => {
    const marker = e.target.closest && e.target.closest(".locmap__marker");
    if (marker) return;
    drag = {
      x: e.clientX,
      y: e.clientY,
      center: { ...view.center },
      cosLat: Math.cos((view.center.lat * Math.PI) / 180),
    };
    root.classList.add("is-dragging");
    if (svg.setPointerCapture) {
      try { svg.setPointerCapture(e.pointerId); } catch { /* not supported */ }
    }
  });

  svg.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    setView({
      center: {
        lat: drag.center.lat + (dy * view.mpp) / M_PER_DEG_LAT,
        lng: drag.center.lng - (dx * view.mpp) / (M_PER_DEG_LNG * drag.cosLat),
      },
      mpp: view.mpp,
    });
  });

  const endDrag = () => {
    drag = null;
    root.classList.remove("is-dragging");
  };
  svg.addEventListener("pointerup", endDrag);
  svg.addEventListener("pointercancel", endDrag);
  svg.addEventListener("pointerleave", endDrag);

  svg.addEventListener("dblclick", (e) => {
    if (e.target.closest && e.target.closest(".locmap__marker")) return;
    zoomBy(2);
  });

  svg.addEventListener("wheel", (e) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    zoomBy(e.deltaY < 0 ? 1.35 : 1 / 1.35);
  }, { passive: false });

  root.querySelector('[data-zoom="in"]').addEventListener("click", () => zoomBy(1.6));
  root.querySelector('[data-zoom="out"]').addEventListener("click", () => zoomBy(1 / 1.6));
  root.querySelector('[data-zoom="fit"]').addEventListener("click", fit);

  toggle.addEventListener("click", () => {
    const nextWanted = !(tilesWanted && !tilesBlocked);
    if (nextWanted) {
      // Retrying starts over with the first tile host.
      tilesWanted = true;
      tilesBlocked = false;
      failures = 0;
      hostIndex = 0;
      clearTiles();
      setBlocked(false);
      drawTiles();
    } else {
      tilesWanted = false;
      clearTiles();
      setBlocked(false);
    }
  });

  function selectMarker(el) {
    const key = el.dataset.key;
    activeKey = key;
    root.querySelectorAll(".locmap__marker").forEach((m) => {
      m.classList.toggle("is-active", m.dataset.key === key);
    });
    if (typeof options.onSelect === "function") options.onSelect(key);
  }

  svg.addEventListener("click", (e) => {
    const marker = e.target.closest && e.target.closest(".locmap__marker");
    if (marker) selectMarker(marker);
  });

  svg.addEventListener("keydown", (e) => {
    const marker = e.target.closest && e.target.closest(".locmap__marker");
    if (!marker) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      selectMarker(marker);
    }
  });

  let resizeObserver = null;
  if (typeof ResizeObserver === "function") {
    resizeObserver = new ResizeObserver(() => {
      measure();
      draw();
    });
    resizeObserver.observe(container);
  }

  measure();
  setBlocked(!tilesWanted);
  draw();

  const api = {
    focus,
    fit,
    redraw: draw,
    get center() { return { ...view.center }; },
    get metresPerPixel() { return view.mpp; },
    get tilesBlocked() { return tilesBlocked; },
    get tileCount() { return tileEls.size; },
    destroy() {
      destroyed = true;
      if (resizeObserver) resizeObserver.disconnect();
      clearTiles();
      container.innerHTML = "";
      container._ledgerMap = null;
    },
  };

  container._ledgerMap = api;
  return api;
}

export function pointsFromBuildings(buildings) {
  return buildings
    .filter((b) => Number.isFinite(Number(b.lat)) && Number.isFinite(Number(b.lng)))
    .map((b) => ({
      key: b.key,
      lat: b.lat,
      lng: b.lng,
      label: b.unitCount > 1 ? `${b.address} · ${b.unitCount} units` : b.address,
    }));
}

export function openStreetMapLink(lat, lng, zoom = 16) {
  return `https://www.openstreetmap.org/#map=${zoom}/${lat}/${lng}`;
}
