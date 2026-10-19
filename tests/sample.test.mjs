import test from "node:test";
import assert from "node:assert/strict";

import {
  sampleSearchOwners,
  sampleGetOwnerPortfolio,
  sampleSearchAddresses,
  sampleKitchenerProperty,
  sampleWaterlooProperty,
  sampleGetTopOwners,
  getSampleStats,
} from "../assets/js/sample.js";

test("sample owner search is token based", () => {
  const results = sampleSearchOwners("drewlo");
  assert.equal(results.length, 1);
  assert.equal(results[0].name, "DREWLO HOLDINGS INC");

  assert.equal(sampleSearchOwners("city kitchener").length, 1);
  assert.equal(sampleSearchOwners("zzzz").length, 0);
  assert.equal(sampleSearchOwners("Inc.").length, 0);
});

test("sample portfolio groups real rows into buildings", () => {
  const portfolio = sampleGetOwnerPortfolio("drewlo holdings inc");
  assert.equal(portfolio.owner, "DREWLO HOLDINGS INC");
  assert.equal(portfolio.rows.length, 3);
  assert.equal(portfolio.buildings.length, 2);
  const wilson = portfolio.buildings.find((b) => b.civic === 425);
  assert.equal(wilson.unitCount, 2);
});

test("sample address search works across both cities", () => {
  const k = sampleSearchAddresses("425 Wilson", "all");
  assert.equal(k.buildings.length, 1);
  assert.equal(k.buildings[0].city, "kitchener");

  const w = sampleSearchAddresses("Pastern", "waterloo");
  assert.equal(w.buildings.length, 1);
  assert.equal(w.buildings[0].address, "213 Pastern Trail");

  const none = sampleSearchAddresses("999 Nowhere", "all");
  assert.equal(none.buildings.length, 0);
});

test("sample property detail", () => {
  const k = sampleKitchenerProperty(425, "WILSON AVE");
  assert.ok(k);
  assert.equal(k.building.address, "425 Wilson Ave");
  assert.equal(k.building.unitCount, 2);

  const w = sampleWaterlooProperty("213 PASTERN TRAIL", null);
  assert.ok(w);
  assert.equal(w.building.city, "waterloo");
  assert.equal(w.building.ward, 5);

  assert.equal(sampleKitchenerProperty(1, "NOWHERE RD"), null);
});

test("sample stats and top owners", () => {
  const stats = getSampleStats();
  assert.ok(stats.kTotal > 100000);
  const top = sampleGetTopOwners(3);
  assert.equal(top.length, 3);
  assert.ok(top[0].count >= top[1].count);
});

/*
 * The sample uses 213 PASTERN TRAIL for Waterloo. It has no house-number
 * prefix in CIVIC_ADDR's title-cased display, so this guards the title-casing
 * helper's numeric handling too.
 */
test("sample Waterloo display address keeps the civic number", () => {
  const w = sampleSearchAddresses("213 Pastern", "waterloo");
  assert.equal(w.buildings[0].address, "213 Pastern Trail");
});
