/**
 * Data facade. Chooses between live city services and the offline
 * sample extract, and exposes one consistent API to the views.
 */

import * as api from "./api.js";
import * as sample from "./sample.js";

export const state = {
  live: null,          // null = checking, true = live, false = sample
  stats: null,
  error: null,
  checkedAt: null,
};

export async function initData() {
  try {
    state.stats = await api.getStats({ fresh: true, timeout: 8000 });
    state.live = true;
    state.error = null;
  } catch (err) {
    state.live = false;
    state.error = err;
    state.stats = sample.getSampleStats();
  }
  state.checkedAt = Date.now();
  return state;
}

export async function retryLive() {
  state.live = null;
  api.clearCache();
  return initData();
}

export function isLive() {
  return state.live !== false;
}

export function isSample() {
  return state.live === false;
}

export async function getStats() {
  if (state.stats) return state.stats;
  if (!isLive()) return sample.getSampleStats();
  try {
    state.stats = await api.getStats();
    return state.stats;
  } catch {
    return sample.getSampleStats();
  }
}

export async function getTopOwners(options = {}) {
  if (!isLive()) return sample.sampleGetTopOwners(options.limit || 8);
  return api.getTopOwners(options);
}

export async function searchOwners(query, options = {}) {
  if (!isLive()) return sample.sampleSearchOwners(query, options.limit || 45);
  return api.searchOwners(query, options);
}

export async function suggestOwners(query, options = {}) {
  if (!isLive()) return sample.sampleSuggestOwners(query, options.limit || 6);
  try {
    return await api.suggestOwners(query, options);
  } catch (err) {
    if (err && err.name === "AbortError") throw err;
    return [];
  }
}

export async function getOwnerPortfolio(name, options = {}) {
  if (!isLive()) return sample.sampleGetOwnerPortfolio(name);
  return api.getOwnerPortfolio(name, options);
}

export async function searchAddresses(query, city, options = {}) {
  if (!isLive()) return sample.sampleSearchAddresses(query, city);
  return api.searchAddresses(query, city, options);
}

export async function suggestAddresses(query, options = {}) {
  if (!isLive()) return sample.sampleSuggestAddresses(query, options.limit || 6);
  try {
    return await api.suggestAddresses(query, options);
  } catch (err) {
    if (err && err.name === "AbortError") throw err;
    return [];
  }
}

export async function getKitchenerProperty(civic, street, options = {}) {
  if (!isLive()) return sample.sampleKitchenerProperty(civic, street);
  return api.getKitchenerProperty(civic, street, options);
}

export async function getWaterlooProperty(address, id, options = {}) {
  if (!isLive()) return sample.sampleWaterlooProperty(address, id);
  return api.getWaterlooProperty(address, id, options);
}

export { DataError } from "./api.js";
