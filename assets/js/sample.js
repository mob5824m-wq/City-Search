/**
 * A tiny, real-data extract used only when the live city services
 * cannot be reached (offline previews, blocked networks).
 * Every row below was read from the City of Kitchener's public
 * Property Ownership layer. It is labelled as a sample in the UI.
 */

import { LAST_KNOWN } from "./config.js";
import {
  groupBuildings,
  normalizeName,
  ownerWhere,
  ownerType,
  rankOwnerMatches,
  parseAddressQuery,
  titleCaseStreet,
} from "./util.js";

const K_ROWS = [
  { owner: "DREWLO HOLDINGS INC", civic: 425, street: "WILSON AVE", unit: "111", propertyUnitId: 40259471, lat: 43.4222673, lng: -80.4457872 },
  { owner: "DREWLO HOLDINGS INC", civic: 425, street: "WILSON AVE", unit: "711", propertyUnitId: 40257148, lat: 43.4222673, lng: -80.4457872 },
  { owner: "DREWLO HOLDINGS INC", civic: 310, street: "QUEEN ST S", unit: "816", propertyUnitId: 40259284, lat: 43.446714, lng: -80.493258 },
  { owner: "KERBS REALTY INC", civic: 85, street: "DUKE ST W", unit: "602", propertyUnitId: 40274226, lat: 43.451108, lng: -80.491611 },
  { owner: "ACTIVA HOLDINGS INC", civic: 104, street: "BENNINGER DR", unit: null, propertyUnitId: 40293818, lat: 43.406583, lng: -80.535641 },
  { owner: "ACTIVA HOLDINGS INC", civic: 108, street: "BENNINGER DR", unit: null, propertyUnitId: 40293819, lat: 43.406672, lng: -80.535736 },
  { owner: "CITY OF KITCHENER", civic: 200, street: "KING ST W", unit: null, propertyUnitId: 40250001, lat: 43.451639, lng: -80.492489 },
];

const W_PLACES = [
  { id: "95099.0", address: "213 PASTERN TRAIL", ward: 5, lat: 43.4891086, lng: -80.4869707 },
  { id: "94111.0", address: "576 MOUNT ANNE DR", ward: 3, lat: 43.4923961, lng: -80.5459994 },
  { id: "94849.0", address: "578 EXMOOR ST", ward: 5, lat: 43.4872112, lng: -80.483342 },
];

function waterlooBuilding(p) {
  const m = p.address.match(/^(\d{1,6}[A-Z]?)\s+(.*)$/);
  return {
    key: `waterloo:${p.address}`,
    id: p.id,
    city: "waterloo",
    civic: m ? m[1] : "",
    street: (m ? m[2] : p.address).trim(),
    address: titleCaseStreet(p.address),
    rawAddress: p.address,
    ward: p.ward,
    lat: p.lat,
    lng: p.lng,
    unitCount: 1,
    unitList: [],
    owners: [],
    publicOwners: [],
    ownerCount: 0,
    isPrivate: true,
    rows: 1,
  };
}

export function getSampleStats() {
  return { ...LAST_KNOWN, fetchedAt: null, sample: true };
}

export function sampleOwnerNames() {
  const counts = new Map();
  K_ROWS.forEach((r) => counts.set(r.owner, (counts.get(r.owner) || 0) + 1));
  return Array.from(counts.entries()).map(([name, count]) => ({ name, count }));
}

export function sampleSearchOwners(query, limit = 45) {
  if (!ownerWhere(query)) return [];
  const q = normalizeName(query);
  const tokens = q.split(" ").filter(Boolean);
  const matches = sampleOwnerNames().filter(({ name }) => {
    const n = normalizeName(name);
    return tokens.every((t) => n.includes(t));
  });
  return rankOwnerMatches(matches, query).slice(0, limit);
}

export function sampleGetTopOwners(limit = 8) {
  return sampleOwnerNames()
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map((o) => ({ ...o, type: ownerType(o.name) }));
}

export function sampleGetOwnerPortfolio(rawName) {
  const name = String(rawName || "").trim().toUpperCase();
  const rows = K_ROWS.filter((r) => r.owner === name);
  return {
    owner: name,
    rows,
    buildings: groupBuildings(rows, "kitchener"),
    truncated: false,
  };
}

export function sampleSuggestOwners(query, limit = 6) {
  return sampleSearchOwners(query, 30).slice(0, limit);
}

export function sampleSearchAddresses(query, city = "all") {
  const parsed = parseAddressQuery(query);
  if (!parsed) return { buildings: [], errors: [], truncated: false, parsed };
  const civic = parsed.civic;
  const tokens = parsed.streetTokens;
  const matchesK = city === "waterloo" ? [] : K_ROWS.filter((r) => {
    const street = r.street.toUpperCase();
    if (civic && String(r.civic) !== String(civic)) return false;
    return tokens.every((t) => street.includes(t));
  });
  const matchesW = city === "kitchener" ? [] : W_PLACES.filter((p) => {
    if (civic && !p.address.startsWith(civic + " ")) return false;
    return tokens.every((t) => p.address.includes(t));
  });

  const buildings = [
    ...groupBuildings(matchesK, "kitchener"),
    ...matchesW.map(waterlooBuilding),
  ];
  return { buildings, errors: [], truncated: false, parsed };
}

export function sampleSuggestAddresses(query, limit = 6) {
  const { buildings } = sampleSearchAddresses(query, "all");
  return buildings.slice(0, limit).map((b) => ({
    city: b.city,
    civic: b.civic,
    street: b.street,
    address: b.address,
    id: b.id,
    count: b.unitCount || 1,
  }));
}

export function sampleKitchenerProperty(civic, street) {
  const rows = K_ROWS.filter(
    (r) => String(r.civic) === String(civic) && r.street.toUpperCase() === String(street).toUpperCase()
  );
  if (!rows.length) return null;
  const building = groupBuildings(rows, "kitchener")[0];
  return { city: "kitchener", building, rows, permits: [], truncated: false };
}

export function sampleWaterlooProperty(address, id) {
  const p = W_PLACES.find((x) => (id && x.id === id) || x.address === String(address).toUpperCase());
  if (!p) return null;
  return { city: "waterloo", building: waterlooBuilding(p), rows: [], permits: [], truncated: false };
}
