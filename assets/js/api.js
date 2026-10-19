/**
 * ArcGIS FeatureServer client for Kitchener & Waterloo open data.
 * Everything runs in the browser against public, CORS-enabled endpoints.
 */

import { SOURCES, LIMITS, QUERY_TIMEOUT, CACHE_TTL } from "./config.js";
import {
  escapeSql,
  groupBuildings,
  dedupeOwnershipRows,
  ownerWhere,
  rankOwnerMatches,
  kitchenerAddressWhere,
  waterlooAddressWhere,
  parseAddressQuery,
  titleCaseStreet,
} from "./util.js";

export class DataError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = "DataError";
    this.source = options.source || null;
    this.timeout = !!options.timeout;
  }
}

const cache = new Map();

export function clearCache() {
  cache.clear();
}

export function cacheSize() {
  return cache.size;
}

function cacheGet(key) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expires) {
    cache.delete(key);
    return null;
  }
  return hit.data;
}

function cacheSet(key, data, ttl = CACHE_TTL) {
  cache.set(key, { data, expires: Date.now() + ttl });
  return data;
}

function buildUrl(source, params) {
  const url = new URL(source.url + "/query");
  const defaults = { f: "json" };
  const merged = { ...defaults, ...params };
  Object.entries(merged).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  });
  return url.toString();
}

async function fetchJson(url, { timeout = QUERY_TIMEOUT, signal } = {}) {
  const controller = new AbortController();
  let timedOut = false;
  const onAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener("abort", onAbort, { once: true });
  }
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeout);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
      mode: "cors",
      credentials: "omit",
    });
    if (!res.ok) {
      throw new DataError(`City service returned HTTP ${res.status}`, { source: url });
    }
    const text = await res.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      throw new DataError("The city service returned an unexpected response.", { source: url });
    }
    if (json && json.error) {
      const msg = json.error.message || "The city service rejected the query.";
      throw new DataError(msg, { source: url });
    }
    return json;
  } catch (err) {
    if (err instanceof DataError) throw err;
    if (err && err.name === "AbortError") {
      if (timedOut) {
        throw new DataError("The city service took too long to respond.", { source: url, timeout: true });
      }
      throw err;
    }
    throw new DataError("Could not reach the city service. Check your connection and try again.", { source: url });
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener("abort", onAbort);
  }
}

async function query(source, params, options = {}) {
  const url = buildUrl(source, params);
  if (!options.fresh) {
    const hit = cacheGet(url);
    if (hit) return hit;
  }
  const json = await fetchJson(url, options);
  return cacheSet(url, json, options.ttl || CACHE_TTL);
}

function countOf(json) {
  return Number(json && json.count) || 0;
}

function attr(feature) {
  return (feature && feature.attributes) || {};
}

function pointOf(feature) {
  const g = feature && feature.geometry;
  if (!g) return { lat: null, lng: null };
  if (Array.isArray(g.coordinates)) {
    return { lng: g.coordinates[0], lat: g.coordinates[1] };
  }
  return { lng: typeof g.x === "number" ? g.x : null, lat: typeof g.y === "number" ? g.y : null };
}

/* ------------------------------------------------------------------ */
/* Normalizers                                                         */
/* ------------------------------------------------------------------ */

function normalizeOwnership(feature) {
  const a = attr(feature);
  const { lat, lng } = pointOf(feature);
  return {
    objectId: a.OBJECTID,
    owner: (a.OWNERNAME || "PRIVATE").trim(),
    agency: a.AGENCY || null,
    civic: a.CIVIC_NO,
    street: (a.STREET || "").trim(),
    unit: a.UNIT ? String(a.UNIT).trim() : null,
    propertyUnitId: a.PROPERTY_UNIT_ID,
    lat,
    lng,
  };
}

function normalizeWaterlooAddress(feature) {
  const a = attr(feature);
  const { lat, lng } = pointOf(feature);
  const raw = (a.CIVIC_ADDR || "").trim();
  const match = raw.match(/^(\d{1,6}[A-Z]?)\s+(.*)$/);
  return {
    key: `waterloo:${raw}`,
    id: a.ADDRESS_ID || null,
    city: "waterloo",
    civic: match ? match[1] : "",
    street: (a.STREET_NM || (match ? match[2] : "")).trim(),
    address: titleCaseStreet(raw),
    rawAddress: raw,
    ward: a.WARD || null,
    lat: lat != null ? lat : a.LATITUDE,
    lng: lng != null ? lng : a.LONGITUDE,
    unitCount: 1,
    unitList: [],
    owners: [],
    publicOwners: [],
    ownerCount: 0,
    isPrivate: true,
    rows: 1,
  };
}

function normalizeKitchenerPermit(feature) {
  const a = attr(feature);
  return {
    number: a.PERMITNO || "",
    type: a.PERMIT_TYPE || "Building permit",
    status: a.PERMIT_STATUS || "",
    issued: a.ISSUE_DATE || null,
    work: a.WORK_TYPE || "",
    subWork: a.SUB_WORK_TYPE || "",
    description: a.PERMIT_DESCRIPTION || "",
    value: typeof a.CONSTRUCTION_VALUE === "number" ? a.CONSTRUCTION_VALUE : null,
    units: a.TOTAL_UNITS || null,
    address: a.FOLDERNAME || "",
  };
}

function normalizeWaterlooPermit(feature) {
  const a = attr(feature);
  return {
    number: a.PERMIT_NUM || "",
    type: a.PERMITDESC || "Building permit",
    status: a.STATUS || "",
    issued: a.ISSUEDATE || null,
    work: a.WORKDESC || "",
    subWork: a.SUBDESC || "",
    description: a.DESCRIPTN || "",
    value: typeof a.CONTRVALUE === "number" ? a.CONTRVALUE : null,
    units: a.UNITS || null,
    bedrooms: a.BEDROOMS,
    area: a.PROPAREA,
    address: a.ADDRESS || "",
  };
}

/* ------------------------------------------------------------------ */
/* Counts & stats                                                      */
/* ------------------------------------------------------------------ */

export async function getStats({ fresh = false, timeout = QUERY_TIMEOUT } = {}) {
  const opts = { fresh, ttl: 30 * 60 * 1000, timeout };
  // The ownership count is the health signal; the other two are best-effort
  // so one slow city endpoint doesn't knock the whole app into sample mode.
  const [kTotal, kPublic, wAddresses] = await Promise.allSettled([
    query(SOURCES.kitchenerOwnership, { where: "1=1", returnCountOnly: "true" }, opts),
    query(SOURCES.kitchenerOwnership, { where: "OWNERNAME <> 'PRIVATE'", returnCountOnly: "true" }, opts),
    query(SOURCES.waterlooAddresses, { where: "1=1", returnCountOnly: "true" }, opts),
  ]);
  if (kTotal.status !== "fulfilled") throw kTotal.reason;
  return {
    kTotal: countOf(kTotal.value),
    kPublic: kPublic.status === "fulfilled" ? countOf(kPublic.value) : null,
    wAddresses: wAddresses.status === "fulfilled" ? countOf(wAddresses.value) : null,
    fetchedAt: Date.now(),
  };
}

/* ------------------------------------------------------------------ */
/* Owner search & portfolios                                           */
/* ------------------------------------------------------------------ */

export async function searchOwners(queryText, { limit = LIMITS.ownerResults, signal } = {}) {
  const built = ownerWhere(queryText);
  if (!built) return [];

  const json = await query(
    SOURCES.kitchenerOwnership,
    {
      where: built.where,
      outStatistics: JSON.stringify([
        { statisticType: "count", onStatisticField: "OBJECTID", outStatisticFieldName: "cnt" },
      ]),
      groupByFieldsForStatistics: "OWNERNAME",
      orderByFields: "cnt DESC",
      resultRecordCount: Math.max(limit, 60),
      returnGeometry: "false",
    },
    { signal }
  );

  const matches = (json.features || [])
    .map((f) => {
      const a = attr(f);
      return { name: (a.OWNERNAME || "").trim(), count: Number(a.cnt) || 0 };
    })
    .filter((m) => m.name && m.name !== "PRIVATE");

  return rankOwnerMatches(matches, queryText).slice(0, limit);
}

export async function suggestOwners(queryText, { limit = LIMITS.suggestOwners, signal } = {}) {
  if (!queryText || queryText.trim().length < 2) return [];
  const results = await searchOwners(queryText, { limit: 30, signal });
  return results.slice(0, limit);
}

export async function getTopOwners({ limit = 8, signal } = {}) {
  const json = await query(
    SOURCES.kitchenerOwnership,
    {
      where: "OWNERNAME <> 'PRIVATE'",
      outStatistics: JSON.stringify([
        { statisticType: "count", onStatisticField: "OBJECTID", outStatisticFieldName: "cnt" },
      ]),
      groupByFieldsForStatistics: "OWNERNAME",
      orderByFields: "cnt DESC",
      resultRecordCount: limit,
      returnGeometry: "false",
    },
    { signal }
  );
  return (json.features || []).map((f) => {
    const a = attr(f);
    return { name: (a.OWNERNAME || "").trim(), count: Number(a.cnt) || 0 };
  }).filter((o) => o.name && o.name !== "PRIVATE");
}

export async function getOwnerPortfolio(rawName, { signal } = {}) {
  const name = String(rawName || "").trim().toUpperCase();
  if (!name) return { owner: "", rows: [], buildings: [], truncated: false };

  const where = `OWNERNAME = '${escapeSql(name)}'`;
  let offset = 0;
  let rows = [];
  let truncated = false;
  let pages = 0;

  while (pages < LIMITS.ownerMaxPages) {
    const json = await query(
      SOURCES.kitchenerOwnership,
      {
        where,
        outFields: "OBJECTID,OWNERNAME,AGENCY,CIVIC_NO,STREET,UNIT,PROPERTY_UNIT_ID",
        returnGeometry: "true",
        outSR: "4326",
        orderByFields: "STREET ASC,CIVIC_NO ASC",
        resultOffset: offset,
        resultRecordCount: LIMITS.ownerRowsPerPage,
      },
      { signal }
    );
    const features = json.features || [];
    rows = rows.concat(features.map(normalizeOwnership));
    pages += 1;
    if (!json.exceededTransferLimit || features.length === 0) break;
    offset += features.length;
    if (pages >= LIMITS.ownerMaxPages) truncated = true;
  }

  rows = dedupeOwnershipRows(rows);
  const buildings = groupBuildings(rows, "kitchener");
  return { owner: name, rows, buildings, truncated };
}

/* ------------------------------------------------------------------ */
/* Address search                                                      */
/* ------------------------------------------------------------------ */

export async function searchAddresses(queryText, city = "all", { signal } = {}) {
  const parsed = parseAddressQuery(queryText);
  if (!parsed) return { buildings: [], errors: [] };

  const wantK = city === "all" || city === "kitchener";
  const wantW = city === "all" || city === "waterloo";
  const tasks = [];
  const errors = [];

  if (wantK) {
    const where = kitchenerAddressWhere(parsed);
    if (where) {
      tasks.push(
        query(
          SOURCES.kitchenerOwnership,
          {
            where,
            outFields: "OBJECTID,OWNERNAME,CIVIC_NO,STREET,UNIT,PROPERTY_UNIT_ID",
            returnGeometry: "true",
            outSR: "4326",
            orderByFields: "STREET ASC,CIVIC_NO ASC",
            resultRecordCount: LIMITS.addressRows,
          },
          { signal }
        )
          .then((json) => {
            const rows = dedupeOwnershipRows((json.features || []).map(normalizeOwnership));
            return { city: "kitchener", buildings: groupBuildings(rows, "kitchener"), truncated: !!json.exceededTransferLimit };
          })
          .catch((err) => {
            if (err && err.name === "AbortError") throw err;
            errors.push({ city: "kitchener", message: err.message });
            return { city: "kitchener", buildings: [], truncated: false };
          })
      );
    }
  }

  if (wantW) {
    const where = waterlooAddressWhere(parsed);
    if (where) {
      tasks.push(
        query(
          SOURCES.waterlooAddresses,
          {
            where,
            outFields: "ADDRESS_ID,CIVIC_ADDR,STREET_NM,WARD,LATITUDE,LONGITUDE",
            returnGeometry: "false",
            orderByFields: "CIVIC_ADDR ASC",
            resultRecordCount: Math.min(LIMITS.addressRows, 400),
          },
          { signal }
        )
          .then((json) => ({
            city: "waterloo",
            buildings: (json.features || []).map(normalizeWaterlooAddress),
            truncated: !!json.exceededTransferLimit,
          }))
          .catch((err) => {
            if (err && err.name === "AbortError") throw err;
            errors.push({ city: "waterloo", message: err.message });
            return { city: "waterloo", buildings: [], truncated: false };
          })
      );
    }
  }

  const results = await Promise.all(tasks);
  let buildings = results.flatMap((r) => r.buildings);
  const truncated = results.some((r) => r.truncated);

  const civicNum = parsed.civic ? String(parsed.civic).toUpperCase() : "";
  const streetKey = parsed.streetTokens.join(" ");
  buildings.sort((a, b) => scoreAddress(b, civicNum, streetKey) - scoreAddress(a, civicNum, streetKey) ||
    a.address.localeCompare(b.address));

  return { buildings, errors, truncated, parsed };
}

function scoreAddress(building, civic, streetKey) {
  let score = 0;
  const bCivic = String(building.civic || "").toUpperCase();
  const bStreet = String(building.street || "").toUpperCase();
  if (civic && bCivic === civic) score += 100;
  if (civic && bCivic.startsWith(civic)) score += 25;
  if (streetKey && bStreet.includes(streetKey)) score += 40;
  if (streetKey && bStreet.startsWith(streetKey)) score += 20;
  return score;
}

export async function suggestAddresses(queryText, { limit = LIMITS.suggestAddresses, signal } = {}) {
  const parsed = parseAddressQuery(queryText);
  if (!parsed) return [];
  const kWhere = kitchenerAddressWhere(parsed);
  const wWhere = waterlooAddressWhere(parsed);
  const items = [];

  if (kWhere) {
    const json = await query(
      SOURCES.kitchenerOwnership,
      {
        where: kWhere,
        outStatistics: JSON.stringify([
          { statisticType: "count", onStatisticField: "OBJECTID", outStatisticFieldName: "cnt" },
        ]),
        groupByFieldsForStatistics: "CIVIC_NO,STREET",
        orderByFields: "CIVIC_NO ASC",
        resultRecordCount: 25,
        returnGeometry: "false",
      },
      { signal }
    );
    (json.features || []).forEach((f) => {
      const a = attr(f);
      if (!a.STREET) return;
      items.push({
        city: "kitchener",
        civic: a.CIVIC_NO,
        street: a.STREET,
        address: `${a.CIVIC_NO ? a.CIVIC_NO + " " : ""}${titleCaseStreet(a.STREET)}`,
        count: Number(a.cnt) || 0,
      });
    });
  }

  if (wWhere) {
    const json = await query(
      SOURCES.waterlooAddresses,
      {
        where: wWhere,
        outFields: "ADDRESS_ID,CIVIC_ADDR,STREET_NM,WARD,LATITUDE,LONGITUDE",
        returnGeometry: "false",
        orderByFields: "CIVIC_ADDR ASC",
        resultRecordCount: 25,
      },
      { signal }
    );
    (json.features || []).forEach((f) => {
      const w = normalizeWaterlooAddress(f);
      items.push({
        city: "waterloo",
        civic: w.civic,
        street: w.street,
        address: w.address,
        id: w.id,
        count: 1,
      });
    });
  }

  const civic = parsed.civic ? String(parsed.civic).toUpperCase() : "";
  items.sort((a, b) => {
    const aExact = civic && String(a.civic).toUpperCase() === civic ? 1 : 0;
    const bExact = civic && String(b.civic).toUpperCase() === civic ? 1 : 0;
    return bExact - aExact || a.address.localeCompare(b.address);
  });

  const seen = new Set();
  return items.filter((i) => {
    const key = `${i.city}|${i.address}`.toUpperCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, limit);
}

/* ------------------------------------------------------------------ */
/* Property detail                                                     */
/* ------------------------------------------------------------------ */

export async function getKitchenerProperty(civic, street, { signal } = {}) {
  const civicNo = Number.parseInt(String(civic).replace(/[^0-9]/g, ""), 10);
  if (!Number.isFinite(civicNo)) return null;
  const where = `CIVIC_NO = ${civicNo} AND STREET = '${escapeSql(String(street).toUpperCase())}'`;
  const [ownershipJson, permits] = await Promise.all([
    query(
      SOURCES.kitchenerOwnership,
      {
        where,
        outFields: "OBJECTID,OWNERNAME,AGENCY,CIVIC_NO,STREET,UNIT,PROPERTY_UNIT_ID",
        returnGeometry: "true",
        outSR: "4326",
        orderByFields: "UNIT ASC",
        resultRecordCount: 2000,
      },
      { signal }
    ),
    getPermits("kitchener", `${civicNo} ${String(street).toUpperCase()}`, { signal }).catch(() => null),
  ]);

  const rows = dedupeOwnershipRows((ownershipJson.features || []).map(normalizeOwnership));
  if (!rows.length) return null;
  const buildings = groupBuildings(rows, "kitchener");
  const building = buildings[0];
  if (!building) return null;
  return { city: "kitchener", building, rows, permits, truncated: !!ownershipJson.exceededTransferLimit };
}

export async function getWaterlooProperty(address, id, { signal } = {}) {
  const clean = String(address || "").trim();
  const where = id
    ? `ADDRESS_ID = '${escapeSql(id)}'`
    : `CIVIC_ADDR = '${escapeSql(clean.toUpperCase())}'`;

  const [addressJson, permits] = await Promise.all([
    query(
      SOURCES.waterlooAddresses,
      {
        where,
        outFields: "ADDRESS_ID,CIVIC_ADDR,STREET_NM,WARD,LATITUDE,LONGITUDE",
        returnGeometry: "false",
        resultRecordCount: 5,
      },
      { signal }
    ),
    getPermits("waterloo", clean, { signal }).catch(() => null),
  ]);

  const features = addressJson.features || [];
  if (!features.length) return null;
  const building = normalizeWaterlooAddress(features[0]);
  return { city: "waterloo", building, rows: [], permits, truncated: false };
}

export async function getPermits(city, address, { signal } = {}) {
  const isKitchener = city === "kitchener";
  const source = isKitchener ? SOURCES.kitchenerPermits : SOURCES.waterlooPermits;
  const where = isKitchener
    ? `FOLDERNAME = '${escapeSql(String(address).toUpperCase())}'`
    : `ADDRESS = '${escapeSql(String(address).toUpperCase())}'`;

  const json = await query(
    source,
    isKitchener
      ? {
          where,
          outFields: "PERMITNO,PERMIT_TYPE,PERMIT_STATUS,ISSUE_DATE,WORK_TYPE,SUB_WORK_TYPE,PERMIT_DESCRIPTION,CONSTRUCTION_VALUE,TOTAL_UNITS,FOLDERNAME",
          returnGeometry: "false",
          orderByFields: "ISSUE_DATE DESC",
          resultRecordCount: LIMITS.permits,
        }
      : {
          where,
          outFields: "PERMIT_NUM,PERMITDESC,STATUS,ISSUEDATE,WORKDESC,SUBDESC,DESCRIPTN,CONTRVALUE,UNITS,BEDROOMS,PROPAREA,ADDRESS,ISSUE_YEAR",
          returnGeometry: "false",
          orderByFields: "ISSUEDATE DESC",
          resultRecordCount: LIMITS.permits,
        },
    { signal }
  );

  return (json.features || []).map(isKitchener ? normalizeKitchenerPermit : normalizeWaterlooPermit);
}
