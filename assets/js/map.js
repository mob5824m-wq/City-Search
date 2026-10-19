/**
 * Thin Leaflet wrapper with a graceful, self-contained fallback.
 * Tiles come from OpenStreetMap (no API key); the dots are drawn locally.
 * If the tile server is unreachable or refuses the request, the basemap is
 * dropped and the markers stay on a plain, coordinate-true canvas — the app
 * never shows a third-party "API key required" error.
 */

import { escapeHtml } from "./util.js";
import { MAP } from "./config.js";

export function renderMap(container, points, options = {}) {
  if (!container) return null;

  if (container._ledgerMap) {
    try { container._ledgerMap.remove(); } catch { /* already gone */ }
    container._ledgerMap = null;
  }

  const valid = (points || []).filter(
    (p) => Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng))
  );

  if (!window.L || valid.length === 0) {
    container.innerHTML = fallbackHtml(valid, options);
    return null;
  }

  container.innerHTML = "";
  const map = window.L.map(container, {
    zoomControl: true,
    scrollWheelZoom: false,
    attributionControl: true,
    preferCanvas: true,
    tap: false,
  });

  if (options.ariaLabel) {
    map.getContainer().setAttribute("role", "img");
    map.getContainer().setAttribute("aria-label", options.ariaLabel);
  }

  const tiles = window.L.tileLayer(MAP.tiles, {
    attribution: MAP.attribution,
    maxZoom: MAP.maxZoom || 19,
    detectRetina: true,
  }).addTo(map);

  let tilesLoaded = 0;
  let degraded = false;
  const card = container.closest(".map-card") || container;
  const degrade = () => {
    if (degraded || tilesLoaded > 0) return;
    degraded = true;
    try { map.removeLayer(tiles); } catch { /* already gone */ }
    card.classList.add("map-card--plain");
    if (!card.querySelector(".map-card__note")) {
      const note = document.createElement("div");
      note.className = "map-card__note";
      note.textContent = MAP.note || "Street basemap unavailable";
      card.appendChild(note);
    }
  };
  tiles.on("tileload", () => { tilesLoaded += 1; });
  tiles.on("tileerror", () => { setTimeout(degrade, 900); });
  // Some blocked networks never fire tileerror; if nothing loaded, still degrade.
  setTimeout(degrade, 4000);

  const markers = new Map();
  const bounds = window.L.latLngBounds();

  valid.forEach((p) => {
    const marker = window.L.circleMarker([Number(p.lat), Number(p.lng)], {
      radius: options.big ? 8 : 6,
      color: "#fffdf8",
      weight: 1.6,
      fillColor: options.color || "#ad5128",
      fillOpacity: 1,
      bubblingMouseEvents: false,
    }).addTo(map);

    if (p.label) {
      marker.bindTooltip(escapeHtml(p.label), {
        direction: "top",
        offset: [0, -6],
        opacity: 0.96,
        className: "ledger-tip",
      });
    }

    marker.on("click", () => {
      if (typeof options.onSelect === "function") options.onSelect(p.key);
      if (p.key && markers.has(p.key)) highlight(markers, p.key);
    });

    marker.on("mouseover", () => marker.setStyle({ fillColor: "#12352b" }));
    marker.on("mouseout", () => {
      const active = options.activeKey && p.key === options.activeKey;
      marker.setStyle({ fillColor: active ? "#12352b" : (options.color || "#ad5128") });
    });

    if (p.key) markers.set(p.key, marker);
    bounds.extend([Number(p.lat), Number(p.lng)]);
  });

  if (valid.length === 1) {
    map.setView([Number(valid[0].lat), Number(valid[0].lng)], options.zoom || 16);
  } else {
    map.fitBounds(bounds, { padding: [42, 42], maxZoom: 15 });
  }

  if (options.activeKey && markers.has(options.activeKey)) {
    highlight(markers, options.activeKey);
  }

  setTimeout(() => {
    try { map.invalidateSize(); } catch { /* noop */ }
  }, 140);

  const api = {
    map,
    markers,
    focus(key, zoom = 16) {
      const p = valid.find((x) => x.key === key);
      if (!p) return;
      map.flyTo([Number(p.lat), Number(p.lng)], zoom, { duration: 0.6 });
      highlight(markers, key);
    },
    fit() {
      if (valid.length === 1) {
        map.setView([Number(valid[0].lat), Number(valid[0].lng)], 16);
      } else {
        map.fitBounds(bounds, { padding: [42, 42], maxZoom: 15 });
      }
    },
  };

  container._ledgerMap = map;
  return api;
}

function highlight(markers, key) {
  markers.forEach((marker, k) => {
    marker.setStyle({ fillColor: k === key ? "#12352b" : "#ad5128", radius: k === key ? 8 : 6 });
    if (k === key && marker.bringToFront) marker.bringToFront();
  });
}

function fallbackHtml(points, options) {
  const valid = points || [];
  const first = valid[0];
  const link = first
    ? `<a href="https://www.openstreetmap.org/#map=16/${first.lat}/${first.lng}" target="_blank" rel="noopener">Open this area in OpenStreetMap</a>`
    : "";
  const coords = first ? `${Number(first.lat).toFixed(5)}, ${Number(first.lng).toFixed(5)}` : "";
  const count = valid.length > 1 ? `${valid.length} properties` : "";
  const body = options && options.emptyMessage
    ? escapeHtml(options.emptyMessage)
    : "The street basemap couldn't load, so this is a locator card rather than a map.";
  return `<div class="map-card__fallback">
    <div class="map-card__locator">
      <svg viewBox="0 0 120 84" aria-hidden="true" focusable="false">
        <rect x="0.5" y="0.5" width="119" height="83" rx="8" fill="none" stroke="currentColor" stroke-opacity=".18"/>
        <path d="M18 0v84M54 0v84M90 0v84M0 26h120M0 58h120" stroke="currentColor" stroke-opacity=".12"/>
        <circle cx="60" cy="42" r="15" fill="currentColor" fill-opacity=".1"/>
        <circle cx="60" cy="42" r="5.5" fill="var(--clay)" stroke="var(--card)" stroke-width="2"/>
      </svg>
      <strong>Map preview unavailable</strong>
      <span>${body}</span>
      ${coords ? `<span class="map-card__coords">${escapeHtml(coords)}${count ? ` · ${escapeHtml(count)}` : ""}</span>` : ""}
      ${link ? `<span class="map-card__link">${link}</span>` : ""}
    </div>
  </div>`;
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
