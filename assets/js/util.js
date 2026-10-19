/**
 * Small, dependency-free helpers shared by every view.
 * Pure functions live here so they can be unit-tested in Node.
 */

const NAME_SUFFIXES = new Set([
  "INC", "INCORPORATED", "LTD", "LIMITED", "CORP", "CORPORATION", "CO",
  "COMPANY", "LLC", "LP", "LLP", "ULC", "THE", "OF", "AND",
]);

const STREET_ABBREVIATIONS = {
  AVENUE: "AVE", AVE: "AVE",
  STREET: "ST", ST: "ST",
  ROAD: "RD", RD: "RD",
  DRIVE: "DR", DR: "DR",
  BOULEVARD: "BLVD", BLVD: "BLVD",
  CRESCENT: "CRES", CRES: "CRES",
  PLACE: "PL", PL: "PL",
  COURT: "CT", CT: "CT",
  TERRACE: "TER", TER: "TER",
  TRAIL: "TRL", TRL: "TRL",
  PARKWAY: "PKWY", PKWY: "PKWY",
  SQUARE: "SQ", SQ: "SQ",
  LANE: "LN", LN: "LN",
  CIRCLE: "CIR", CIR: "CIR",
  HEIGHTS: "HTS", HTS: "HTS",
  GARDENS: "GDNS", GDNS: "GDNS",
  HIGHWAY: "HWY", HWY: "HWY",
  CONCESSION: "CONC", CONC: "CONC",
  NORTH: "N", SOUTH: "S", EAST: "E", WEST: "W",
};

const STREET_DISPLAY = {
  ST: "St", AVE: "Ave", RD: "Rd", DR: "Dr", BLVD: "Blvd", CRES: "Cres",
  PL: "Pl", CT: "Ct", TER: "Ter", TRL: "Trail", PKWY: "Pkwy", SQ: "Sq",
  LN: "Ln", CIR: "Cir", HTS: "Hts", GDNS: "Gardens", HWY: "Hwy",
  CONC: "Concession", N: "N", S: "S", E: "E", W: "W",
};

const CITY_LABEL = { kitchener: "Kitchener", waterloo: "Waterloo" };

const NUM = new Intl.NumberFormat("en-CA");

const DATE_FMT = new Intl.DateTimeFormat("en-CA", {
  year: "numeric", month: "short", day: "numeric",
});

export function formatNumber(n) {
  if (n === null || n === undefined || n === "") return "—";
  const value = Number(n);
  return Number.isFinite(value) ? NUM.format(value) : "—";
}

export function pluralize(n, one, many) {
  return `${formatNumber(n)} ${Number(n) === 1 ? one : (many || one + "s")}`;
}

export function cityLabel(city) {
  return CITY_LABEL[city] || "Kitchener";
}

export function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function escapeSql(value) {
  return String(value == null ? "" : value).replace(/'/g, "''");
}

export function normalizeName(value) {
  return String(value == null ? "" : value)
    .toUpperCase()
    .replace(/&/g, " AND ")
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function nameTokens(value) {
  const raw = normalizeName(value).split(" ").filter(Boolean);
  const meaningful = raw.filter(
    (t) => (t.length > 1 || /^\d+$/.test(t)) && !["AND", "ET"].includes(t)
  );
  const dropped = meaningful.filter((t) => !NAME_SUFFIXES.has(t));
  return dropped.length ? dropped : meaningful;
}

/** Build a safe ArcGIS LIKE clause that requires every token, in any order. */
export function likeClause(field, tokens) {
  return tokens
    .filter((t) => t && t.length >= 1)
    .map((t) => `${field} LIKE '%${escapeSql(t)}%'`)
    .join(" AND ");
}

const STREET_EXPANSIONS = {
  AVE: "AVENUE", ST: "STREET", RD: "ROAD", DR: "DRIVE", BLVD: "BOULEVARD",
  CRES: "CRESCENT", PL: "PLACE", CT: "COURT", TER: "TERRACE", TRL: "TRAIL",
  PKWY: "PARKWAY", SQ: "SQUARE", LN: "LANE", CIR: "CIRCLE", HTS: "HEIGHTS",
  GDNS: "GARDENS", HWY: "HIGHWAY", CONC: "CONCESSION",
  N: "NORTH", S: "SOUTH", E: "EAST", W: "WEST",
};

/** Kitchener abbreviates street types, Waterloo spells them out. Accept both. */
export function streetAlternatives(token) {
  const set = new Set([token]);
  if (STREET_EXPANSIONS[token]) set.add(STREET_EXPANSIONS[token]);
  if (STREET_ABBREVIATIONS[token]) set.add(STREET_ABBREVIATIONS[token]);
  return [...set];
}

export function streetClause(field, tokens) {
  return tokens
    .filter((t) => t && t.length >= 1)
    .map((token) => {
      const alternatives = streetAlternatives(token);
      if (alternatives.length === 1) return `${field} LIKE '%${escapeSql(token)}%'`;
      return `(${alternatives.map((a) => `${field} LIKE '%${escapeSql(a)}%'`).join(" OR ")})`;
    })
    .join(" AND ");
}

export function ownerWhere(query) {
  const tokens = nameTokens(query);
  if (!tokens.length) return null;
  // A query made only of legal suffixes ("Inc.", "Holdings Ltd") would match
  // nearly every business; refuse it instead.
  if (!tokens.some((t) => !NAME_SUFFIXES.has(t))) return null;
  if (!tokens.some((t) => t.length >= 2)) return null;
  const where = `${likeClause("OWNERNAME", tokens)} AND OWNERNAME <> 'PRIVATE'`;
  return { where, tokens };
}

export function rankOwnerMatches(matches, query) {
  const norm = normalizeName(query);
  const tokens = nameTokens(query);
  return matches
    .map((m) => {
      const n = normalizeName(m.name);
      let score = 0;
      if (n === norm) score += 1000;
      else if (n.startsWith(norm)) score += 320;
      else if (tokens.every((t) => n.includes(t))) score += 120;
      if (tokens.length && tokens[0].length > 2 && n.startsWith(tokens[0])) score += 60;
      score += Math.min(Number(m.count) || 0, 600) / 100;
      return { ...m, score };
    })
    .sort((a, b) => b.score - a.score || (b.count || 0) - (a.count || 0));
}

const OWNER_TYPE_LABEL = {
  business: "Business",
  numbered: "Numbered co.",
  government: "Government",
  institution: "Institution",
};

export function ownerType(name) {
  const n = String(name || "").toUpperCase();

  // Numbered Ontario/Canada companies: "1000137516 ONTARIO INC".
  if (/\b\d{5,}\b/.test(n) && /\b(ONTARIO|CANADA)\b/.test(n) && /\b(INC|LTD|LIMITED|CORP|CORPORATION|ULC)\b/.test(n)) {
    return "numbered";
  }
  // Plain municipal / crown entities.
  if (/^(CITY|CORPORATION OF THE CITY|REGION|REGIONAL MUNICIPALITY|MUNICIPALITY|COUNTY|TOWN|TOWNSHIP|GOVERNMENT|PROVINCE)\b/.test(n) ||
      /\b(CITY OF|REGION OF|REGIONAL MUNICIPALITY OF|COUNTY OF|TOWNSHIP OF|GOVERNMENT OF|PROVINCE OF|CROWN)\b/.test(n)) {
    return "government";
  }
  // Schools, hospitals, charities and similar institutions.
  if (/\b(UNIVERSITY|COLLEGE|SCHOOL|HOSPITAL|HEALTH|CHURCH|PARISH|FOUNDATION|ASSOCIATION|SOCIETY|CLUB|CONSERVATION|HOUSING|LIBRARY|MUSEUM|YMCA|YWCA|DIOCESE|CHARITY|CHARITABLE|CO-OPERATIVE|COOPERATIVE|CO-OP)\b/.test(n)) {
    return "institution";
  }
  // Agencies, boards and commissions.
  if (/\b(AUTHORITY|COMMISSION|BOARD|AGENCY)\b/.test(n)) {
    return "government";
  }
  return "business";
}

export function ownerTypeLabel(type) {
  return OWNER_TYPE_LABEL[type] || "Business";
}

export function monogram(name) {
  const tokens = String(name || "")
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter((t) => !["THE", "OF", "AND", "INC", "LTD", "LIMITED", "CORP", "CORPORATION", "COMPANY"].includes(t));
  if (!tokens.length) return "—";
  if (/^\d/.test(tokens[0])) return tokens[0].replace(/[^0-9A-Z]/g, "").slice(0, 2);
  return tokens.slice(0, 2).map((t) => t[0]).join("").slice(0, 2);
}

export function titleCaseStreet(street) {
  return String(street || "")
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      const upper = word.toUpperCase();
      if (STREET_DISPLAY[upper]) return STREET_DISPLAY[upper];
      if (/^\d+[a-z]?$/.test(word)) return word.toUpperCase();
      return word
        .split("-")
        .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
        .join("-");
    })
    .join(" ");
}

export function formatAddress(civicNo, street, unit) {
  const base = `${civicNo ? civicNo + " " : ""}${titleCaseStreet(street)}`.trim();
  return unit ? `${base}, Unit ${unit}` : base;
}

export function isLinkableBuilding(building) {
  return !!building && (building.city === "waterloo" || !!building.civic);
}

/**
 * Parse a free-text address query.
 * Returns { civic, streetTokens, unit, cityHint }.
 */
export function parseAddressQuery(raw) {
  let q = String(raw || "")
    .toUpperCase()
    .replace(/#\s*([A-Z0-9-]+)/g, " UNIT $1")
    .replace(/[.,+#%_]/g, " ")
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();

  // Drop the province/country suffix before looking for a city name.
  q = q.replace(/\s+(ON|ONTARIO|CANADA)\s*$/g, "").trim();

  let cityHint = null;
  const cityMatch = q.match(/\s+(KITCHENER|WATERLOO)\s*$/);
  if (cityMatch) {
    cityHint = cityMatch[1].toLowerCase();
    q = q.slice(0, cityMatch.index).trim();
  }

  let unit = null;
  const unitMatch = q.match(/\b(?:UNIT|APT|APARTMENT|SUITE|STE)\s*([A-Z0-9-]+)\b/);
  if (unitMatch) {
    unit = unitMatch[1];
    q = q.replace(unitMatch[0], " ");
  }

  q = q.replace(/\s+/g, " ").trim();

  let civic = null;
  let rest = q;
  const rangeMatch = q.match(/^(\d{1,6})\s*-\s*\d{1,6}\s+(.+)$/);
  const numberMatch = q.match(/^(\d{1,6}[A-Z]?)\s+(.+)$/);
  if (rangeMatch) {
    civic = rangeMatch[1];
    rest = rangeMatch[2];
  } else if (numberMatch) {
    civic = numberMatch[1];
    rest = numberMatch[2];
  }

  const streetTokens = rest
    .split(/\s+/)
    .map((t) => STREET_ABBREVIATIONS[t] || t)
    .filter((t) => t.length >= 1 && !["ON", "ONTARIO", "CANADA"].includes(t));

  if (!civic && streetTokens.length === 0) return null;
  return { civic, streetTokens, unit, cityHint };
}

export function kitchenerAddressWhere(parsed) {
  if (!parsed) return null;
  const parts = [];
  if (parsed.civic && /^\d+$/.test(parsed.civic)) parts.push(`CIVIC_NO = ${Number(parsed.civic)}`);
  if (parsed.streetTokens && parsed.streetTokens.length) {
    parts.push(streetClause("STREET", parsed.streetTokens));
  }
  if (!parts.length) return null;
  return parts.join(" AND ");
}

export function waterlooAddressWhere(parsed) {
  if (!parsed) return null;
  const parts = [];
  if (parsed.civic) parts.push(`CIVIC_ADDR LIKE '${escapeSql(parsed.civic)} %'`);
  if (parsed.streetTokens && parsed.streetTokens.length) {
    parts.push(streetClause("STREET_NM", parsed.streetTokens));
  }
  if (!parts.length) return null;
  return parts.join(" AND ");
}

/** Deduplicate unit-level ownership rows (the source contains repeated rows). */
export function dedupeOwnershipRows(rows) {
  const seen = new Set();
  const out = [];
  for (const row of rows) {
    const key = [
      row.propertyUnitId || "",
      row.civic || "",
      row.street || "",
      row.unit || "",
    ].join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

/** Group unit records into buildings. */
export function groupBuildings(rows, city) {
  const map = new Map();
  for (const row of rows) {
    const key = `${city}:${row.civic || ""}|${row.street || ""}`;
    let b = map.get(key);
    if (!b) {
      b = {
        key,
        city,
        civic: row.civic,
        street: row.street,
        address: formatAddress(row.civic, row.street),
        lat: row.lat,
        lng: row.lng,
        units: new Set(),
        owners: new Map(),
        rows: 0,
      };
      map.set(key, b);
    }
    if (row.lat && !b.lat) { b.lat = row.lat; b.lng = row.lng; }
    b.rows += 1;
    const unitKey = row.unit ? String(row.unit).toUpperCase() : "__whole__";
    b.units.add(unitKey);
    if (row.owner) {
      if (!b.owners.has(row.owner)) b.owners.set(row.owner, new Set());
      b.owners.get(row.owner).add(unitKey);
    }
  }

  return Array.from(map.values()).map((b) => {
    const owners = Array.from(b.owners.entries())
      .map(([name, units]) => ({ name, units: units.size }))
      .sort((a, z) => z.units - a.units);
    const publicOwners = owners.filter((o) => o.name !== "PRIVATE");
    return {
      ...b,
      unitCount: b.units.size,
      unitList: Array.from(b.units).filter((u) => u !== "__whole__").sort(naturalCompare),
      owners,
      publicOwners,
      ownerCount: publicOwners.length,
      isPrivate: publicOwners.length === 0,
    };
  });
}

export function naturalCompare(a, b) {
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
}

export function sortBuildings(buildings, mode) {
  const copy = buildings.slice();
  if (mode === "street") {
    copy.sort((a, b) =>
      String(a.street).localeCompare(String(b.street)) ||
      Number(a.civic) - Number(b.civic));
  } else if (mode === "units-desc") {
    copy.sort((a, b) => b.unitCount - a.unitCount || String(a.street).localeCompare(String(b.street)));
  } else if (mode === "units-asc") {
    copy.sort((a, b) => a.unitCount - b.unitCount || String(a.street).localeCompare(String(b.street)));
  } else {
    copy.sort((a, b) =>
      String(a.street).localeCompare(String(b.street)) ||
      Number(a.civic) - Number(b.civic));
  }
  return copy;
}

export function debounce(fn, wait) {
  let timer = null;
  const wrapped = (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
  wrapped.cancel = () => clearTimeout(timer);
  return wrapped;
}

export function csvEscape(value) {
  const s = String(value == null ? "" : value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows) {
  return rows.map((r) => r.map(csvEscape).join(",")).join("\r\n");
}

export function downloadFile(filename, content, mime) {
  const blob = new Blob(["\uFEFF", content], { type: mime || "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "records";
}

export function formatDate(value) {
  if (value == null) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return DATE_FMT.format(d);
}

export function buildOwnerHref(name) {
  return `#/owner?name=${encodeURIComponent(name)}`;
}

export function buildPropertyHref(building) {
  if (building.city === "waterloo") {
    const id = building.id ? `&id=${encodeURIComponent(building.id)}` : "";
    return `#/property?city=waterloo&address=${encodeURIComponent(building.address)}${id}`;
  }
  if (!building.civic) {
    // Some parcels are published with a street but no civic number. Send the
    // reader to an address search rather than a property page that can't load.
    return `#/search?q=${encodeURIComponent(building.street || "")}&mode=address&city=kitchener`;
  }
  return `#/property?city=kitchener&civic=${encodeURIComponent(building.civic)}&street=${encodeURIComponent(building.street)}`;
}

export function parseHash(hash) {
  const raw = (hash || "").replace(/^#/, "") || "/";
  const [pathPart, searchPart] = raw.split("?");
  const path = pathPart.replace(/\/+$/, "") || "/";
  const params = new URLSearchParams(searchPart || "");
  return { path, params };
}

export function truncate(value, max = 80) {
  const s = String(value || "");
  return s.length > max ? s.slice(0, max - 1).trimEnd() + "…" : s;
}

export function documentTitle(parts) {
  const base = "Ledger KW";
  return parts && parts.length ? `${parts.join(" · ")} · ${base}` : base;
}

export function setPageTitle(title) {
  document.title = title ? `${title} · Ledger KW` : "Ledger KW — Public property records for Kitchener & Waterloo";
}

export function isAbortError(err) {
  return !!err && (err.name === "AbortError" || err.code === 20);
}

export function prefersReducedMotion() {
  return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
