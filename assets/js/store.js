/**
 * Saved records, kept in localStorage. No account, no server.
 */

import { STORAGE } from "./config.js";

const empty = { owners: [], properties: [] };

function read() {
  try {
    const raw = localStorage.getItem(STORAGE.saved);
    if (!raw) return { ...empty };
    const parsed = JSON.parse(raw);
    return {
      owners: Array.isArray(parsed.owners) ? parsed.owners : [],
      properties: Array.isArray(parsed.properties) ? parsed.properties : [],
    };
  } catch {
    return { ...empty };
  }
}

function write(next) {
  try {
    localStorage.setItem(STORAGE.saved, JSON.stringify(next));
  } catch {
    /* storage may be unavailable (private mode); saved state is best-effort */
  }
  window.dispatchEvent(new CustomEvent("saved:change", { detail: next }));
}

export function getSaved() {
  return read();
}

export function savedCount() {
  const s = read();
  return s.owners.length + s.properties.length;
}

export function propertyKey(property) {
  return `${property.city}:${String(property.address || "").toUpperCase()}`;
}

export function isOwnerSaved(name) {
  const key = String(name || "").toUpperCase();
  return read().owners.some((o) => String(o.name).toUpperCase() === key);
}

export function toggleOwner(name, meta = {}) {
  const s = read();
  const key = String(name || "").toUpperCase();
  const i = s.owners.findIndex((o) => String(o.name).toUpperCase() === key);
  if (i >= 0) {
    s.owners.splice(i, 1);
    write(s);
    return false;
  }
  s.owners.unshift({ name, savedAt: Date.now(), ...meta });
  write(s);
  return true;
}

export function isPropertySaved(property) {
  const key = propertyKey(property);
  return read().properties.some((p) => propertyKey(p) === key);
}

export function toggleProperty(property) {
  const s = read();
  const key = propertyKey(property);
  const i = s.properties.findIndex((p) => propertyKey(p) === key);
  if (i >= 0) {
    s.properties.splice(i, 1);
    write(s);
    return false;
  }
  s.properties.unshift({
    city: property.city,
    address: property.address,
    civic: property.civic,
    street: property.street,
    id: property.id || null,
    savedAt: Date.now(),
  });
  write(s);
  return true;
}

export function removeOwner(name) {
  const s = read();
  const key = String(name || "").toUpperCase();
  s.owners = s.owners.filter((o) => String(o.name).toUpperCase() !== key);
  write(s);
}

export function removeProperty(property) {
  const s = read();
  const key = propertyKey(property);
  s.properties = s.properties.filter((p) => propertyKey(p) !== key);
  write(s);
}
