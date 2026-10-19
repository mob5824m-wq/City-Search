/**
 * Thin Leaflet wrapper with a graceful, self-contained fallback.
 * Tiles come from CARTO/OpenStreetMap; the dots are drawn locally.
 */

import { escapeHtml } from "./util.js";

const TILE_URL = "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions" target="_blank" rel="noopener">CARTO</a>';

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

  window.L.tileLayer(TILE_URL, {
    attribution: ATTRIBUTION,
    maxZoom: 19,
    subdomains: "abcd",
    detectRetina: true,
  }).addTo(map);

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
  const first = points && points[0];
  const link = first
    ? `<a href="https://www.openstreetmap.org/#map=16/${first.lat}/${first.lng}" target="_blank" rel="noopener">Open this area in OpenStreetMap</a>`
    : "";
  return `<div class="map-card__fallback">
    <div>
      <strong style="display:block;color:var(--ink);margin-bottom:4px;">Map unavailable</strong>
      <span>${options && options.emptyMessage ? escapeHtml(options.emptyMessage) : "The map tiles could not be loaded."}</span>
      ${link ? `<div style="margin-top:8px;font-size:12px;">${link}</div>` : ""}
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
