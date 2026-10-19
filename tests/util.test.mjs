import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizeName,
  nameTokens,
  ownerWhere,
  likeClause,
  parseAddressQuery,
  streetAlternatives,
  kitchenerAddressWhere,
  waterlooAddressWhere,
  dedupeOwnershipRows,
  groupBuildings,
  ownerType,
  ownerTypeLabel,
  monogram,
  titleCaseStreet,
  formatAddress,
  rankOwnerMatches,
  csvEscape,
  toCsv,
  formatNumber,
  buildPropertyHref,
  buildOwnerHref,
  parseHash,
  sortBuildings,
} from "../assets/js/util.js";

test("normalizeName strips punctuation and uppercases", () => {
  assert.equal(normalizeName("Drewlo Holdings Inc."), "DREWLO HOLDINGS INC");
  assert.equal(normalizeName("A & B  Corp"), "A AND B CORP");
  assert.equal(normalizeName("  O'Brien   Holdings "), "O BRIEN HOLDINGS");
});

test("nameTokens drops legal suffixes but keeps distinctive words", () => {
  assert.deepEqual(nameTokens("Drewlo Holdings Inc."), ["DREWLO", "HOLDINGS"]);
  assert.deepEqual(nameTokens("City of Kitchener"), ["CITY", "KITCHENER"]);
  assert.deepEqual(nameTokens("1000137516 Ontario Inc"), ["1000137516", "ONTARIO"]);
  assert.deepEqual(nameTokens("10 Overlea Dr (Kit) Ltd"), ["10", "OVERLEA", "DR", "KIT"]);
  assert.deepEqual(nameTokens("Inc."), ["INC"]);
});

test("ownerWhere builds a token AND clause and refuses suffix-only queries", () => {
  const built = ownerWhere("Drewlo Holdings");
  assert.ok(built);
  assert.equal(
    built.where,
    "OWNERNAME LIKE '%DREWLO%' AND OWNERNAME LIKE '%HOLDINGS%' AND OWNERNAME <> 'PRIVATE'"
  );
  assert.equal(ownerWhere("Inc."), null);
  assert.equal(ownerWhere("   "), null);
  assert.equal(ownerWhere("A"), null);
});

test("ownerWhere escapes single quotes for ArcGIS SQL", () => {
  const built = ownerWhere("O'Brien Holdings");
  assert.ok(built);
  assert.match(built.where, /BRIEN/);
  const quoted = likeClause("OWNERNAME", ["ST. MARY'S"]);
  assert.equal(quoted, "OWNERNAME LIKE '%ST. MARY''S%'");
});

test("parseAddressQuery handles civic numbers, suffixes, units and cities", () => {
  assert.deepEqual(parseAddressQuery("425 Wilson Ave"), {
    civic: "425", streetTokens: ["WILSON", "AVE"], unit: null, cityHint: null,
  });
  assert.deepEqual(parseAddressQuery("425 Wilson Avenue, Kitchener"), {
    civic: "425", streetTokens: ["WILSON", "AVE"], unit: null, cityHint: "kitchener",
  });
  assert.deepEqual(parseAddressQuery("Unit 5, 200 King St W"), {
    civic: "200", streetTokens: ["KING", "ST", "W"], unit: "5", cityHint: null,
  });
  assert.deepEqual(parseAddressQuery("213 Pastern Trail #4"), {
    civic: "213", streetTokens: ["PASTERN", "TRL"], unit: "4", cityHint: null,
  });
  assert.deepEqual(parseAddressQuery("100-110 King St W"), {
    civic: "100", streetTokens: ["KING", "ST", "W"], unit: null, cityHint: null,
  });
  assert.deepEqual(parseAddressQuery("578 Exmoor St, Waterloo, ON"), {
    civic: "578", streetTokens: ["EXMOOR", "ST"], unit: null, cityHint: "waterloo",
  });
  assert.equal(parseAddressQuery(""), null);
  assert.equal(parseAddressQuery("   "), null);
});

test("street-only address queries are allowed", () => {
  const parsed = parseAddressQuery("King St W");
  assert.equal(parsed.civic, null);
  assert.deepEqual(parsed.streetTokens, ["KING", "ST", "W"]);
});

test("street types accept both abbreviated and spelled-out forms", () => {
  assert.deepEqual(streetAlternatives("TRL"), ["TRL", "TRAIL"]);
  assert.deepEqual(streetAlternatives("AVENUE"), ["AVENUE", "AVE"]);
  assert.deepEqual(streetAlternatives("PASTERN"), ["PASTERN"]);
});

test("kitchenerAddressWhere builds the right SQL", () => {
  assert.equal(
    kitchenerAddressWhere(parseAddressQuery("425 Wilson Ave")),
    "CIVIC_NO = 425 AND STREET LIKE '%WILSON%' AND (STREET LIKE '%AVE%' OR STREET LIKE '%AVENUE%')"
  );
  assert.equal(
    kitchenerAddressWhere(parseAddressQuery("King St W")),
    "STREET LIKE '%KING%' AND (STREET LIKE '%ST%' OR STREET LIKE '%STREET%') AND (STREET LIKE '%W%' OR STREET LIKE '%WEST%')"
  );
  assert.equal(kitchenerAddressWhere(null), null);
});

test("waterlooAddressWhere uses the civic address prefix and full street types", () => {
  assert.equal(
    waterlooAddressWhere(parseAddressQuery("213 Pastern Trail")),
    "CIVIC_ADDR LIKE '213 %' AND STREET_NM LIKE '%PASTERN%' AND (STREET_NM LIKE '%TRL%' OR STREET_NM LIKE '%TRAIL%')"
  );
});

test("dedupeOwnershipRows removes repeated property units", () => {
  const rows = [
    { propertyUnitId: 1, civic: 425, street: "WILSON AVE", unit: "111" },
    { propertyUnitId: 1, civic: 425, street: "WILSON AVE", unit: "111" },
    { propertyUnitId: 1, civic: 425, street: "WILSON AVE", unit: "711" },
    { propertyUnitId: 2, civic: 425, street: "WILSON AVE", unit: null },
  ];
  assert.equal(dedupeOwnershipRows(rows).length, 3);
});

test("groupBuildings groups units and counts owners", () => {
  const rows = [
    { owner: "DREWLO HOLDINGS INC", civic: 425, street: "WILSON AVE", unit: "111", propertyUnitId: 1, lat: 43.4, lng: -80.4 },
    { owner: "DREWLO HOLDINGS INC", civic: 425, street: "WILSON AVE", unit: "711", propertyUnitId: 2, lat: 43.4, lng: -80.4 },
    { owner: "PRIVATE", civic: 425, street: "WILSON AVE", unit: "212", propertyUnitId: 3, lat: 43.4, lng: -80.4 },
    { owner: "DREWLO HOLDINGS INC", civic: 310, street: "QUEEN ST S", unit: null, propertyUnitId: 4, lat: 43.45, lng: -80.49 },
  ];
  const buildings = groupBuildings(rows, "kitchener");
  assert.equal(buildings.length, 2);
  const wilson = buildings.find((b) => b.civic === 425);
  assert.equal(wilson.unitCount, 3);
  assert.equal(wilson.ownerCount, 1);
  assert.equal(wilson.publicOwners[0].name, "DREWLO HOLDINGS INC");
  assert.equal(wilson.publicOwners[0].units, 2);
  assert.equal(wilson.isPrivate, false);
  assert.equal(buildings.find((b) => b.civic === 310).unitCount, 1);
});

test("sortBuildings is numeric for civic numbers", () => {
  const buildings = [
    { street: "KING ST W", civic: 1000, unitCount: 1 },
    { street: "KING ST W", civic: 90, unitCount: 4 },
    { street: "DUKE ST W", civic: 5, unitCount: 2 },
  ];
  assert.deepEqual(
    sortBuildings(buildings, "street").map((b) => b.civic),
    [5, 90, 1000]
  );
  assert.deepEqual(
    sortBuildings(buildings, "units-desc").map((b) => b.civic),
    [90, 5, 1000]
  );
});

test("ownerType classifies common owners", () => {
  assert.equal(ownerType("DREWLO HOLDINGS INC"), "business");
  assert.equal(ownerType("CITY OF KITCHENER"), "government");
  assert.equal(ownerType("REGIONAL MUNICIPALITY OF WATERLOO"), "government");
  assert.equal(ownerType("1000137516 ONTARIO INC"), "numbered");
  assert.equal(ownerType("WATERLOO CATHOLIC DISTRICT SCHOOL BOARD"), "institution");
  assert.equal(ownerTypeLabel("numbered"), "Numbered co.");
});

test("monogram handles companies and numbered companies", () => {
  assert.equal(monogram("DREWLO HOLDINGS INC"), "DH");
  assert.equal(monogram("CITY OF KITCHENER"), "CK");
  assert.equal(monogram("1000137516 ONTARIO INC"), "10");
});

test("street formatting", () => {
  assert.equal(titleCaseStreet("WILSON AVE"), "Wilson Ave");
  assert.equal(titleCaseStreet("DUKE ST W"), "Duke St W");
  assert.equal(titleCaseStreet("MOUNT ANNE DR"), "Mount Anne Dr");
  assert.equal(formatAddress(425, "WILSON AVE", "711"), "425 Wilson Ave, Unit 711");
  assert.equal(formatAddress(425, "WILSON AVE"), "425 Wilson Ave");
});

test("rankOwnerMatches puts exact matches first", () => {
  const matches = [
    { name: "DREWLO HOLDINGS INC", count: 704 },
    { name: "DREWLO INVESTMENTS LTD", count: 20 },
    { name: "DREWLO", count: 1 },
  ];
  const ranked = rankOwnerMatches(matches, "Drewlo");
  assert.equal(ranked[0].name, "DREWLO");
});

test("csv helpers quote correctly", () => {
  assert.equal(csvEscape('a,b'), '"a,b"');
  assert.equal(csvEscape('say "hi"'), '"say ""hi"""');
  assert.equal(csvEscape("plain"), "plain");
  assert.equal(toCsv([["a", "b"], ["1", "2"]]), "a,b\r\n1,2");
});

test("URL helpers encode correctly", () => {
  assert.equal(buildOwnerHref("DREWLO HOLDINGS INC"), "#/owner?name=DREWLO%20HOLDINGS%20INC");
  assert.equal(
    buildPropertyHref({ city: "kitchener", civic: 425, street: "WILSON AVE" }),
    "#/property?city=kitchener&civic=425&street=WILSON%20AVE"
  );
  assert.match(buildPropertyHref({ city: "waterloo", address: "213 Pastern Trail", id: "1" }), /^#\/property\?city=waterloo/);
});

test("parseHash splits path and params", () => {
  const { path, params } = parseHash("#/owner?name=DREWLO%20HOLDINGS%20INC");
  assert.equal(path, "/owner");
  assert.equal(params.get("name"), "DREWLO HOLDINGS INC");
  assert.equal(parseHash("").path, "/");
});

test("formatNumber is stable", () => {
  assert.equal(formatNumber(1234567), "1,234,567");
  assert.equal(formatNumber(null), "—");
});
