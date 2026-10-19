import test from "node:test";
import assert from "node:assert/strict";

import {
  searchOwners,
  getOwnerPortfolio,
  getKitchenerProperty,
  clearCache,
} from "../assets/js/api.js";

function stubFetch(handler) {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push(String(url));
    const body = handler(String(url), init);
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify(body),
    };
  };
  return {
    calls,
    restore() { globalThis.fetch = original; },
  };
}

test("searchOwners sends a grouped, filtered ArcGIS query", async () => {
  const stub = stubFetch(() => ({
    features: [
      { attributes: { OWNERNAME: "DREWLO HOLDINGS INC", cnt: 704 } },
      { attributes: { OWNERNAME: "DREWLO INVESTMENTS LTD", cnt: 2 } },
    ],
  }));
  try {
    clearCache();
    const results = await searchOwners("Drewlo Holdings");
    assert.equal(results.length, 2);
    assert.equal(results[0].name, "DREWLO HOLDINGS INC");

    const url = new URL(stub.calls[0]);
    assert.equal(url.searchParams.get("f"), "json");
    assert.equal(url.searchParams.get("groupByFieldsForStatistics"), "OWNERNAME");
    assert.equal(url.searchParams.get("returnGeometry"), "false");
    assert.equal(
      url.searchParams.get("where"),
      "OWNERNAME LIKE '%DREWLO%' AND OWNERNAME LIKE '%HOLDINGS%' AND OWNERNAME <> 'PRIVATE'"
    );
    assert.match(url.searchParams.get("outStatistics"), /outStatisticFieldName/);
  } finally {
    stub.restore();
  }
});

test("getOwnerPortfolio normalizes and groups unit rows", async () => {
  const stub = stubFetch(() => ({
    exceededTransferLimit: false,
    features: [
      {
        attributes: {
          OBJECTID: 1, OWNERNAME: "DREWLO HOLDINGS INC", CIVIC_NO: 425,
          STREET: "WILSON AVE", UNIT: "711", PROPERTY_UNIT_ID: 40257148, AGENCY: null,
        },
        geometry: { x: -80.4457872, y: 43.4222673 },
      },
      {
        attributes: {
          OBJECTID: 2, OWNERNAME: "DREWLO HOLDINGS INC", CIVIC_NO: 425,
          STREET: "WILSON AVE", UNIT: "111", PROPERTY_UNIT_ID: 40259471, AGENCY: null,
        },
        geometry: { x: -80.4457872, y: 43.4222673 },
      },
    ],
  }));
  try {
    clearCache();
    const portfolio = await getOwnerPortfolio("drewlo holdings inc");
    assert.equal(portfolio.owner, "DREWLO HOLDINGS INC");
    assert.equal(portfolio.rows.length, 2);
    assert.equal(portfolio.buildings.length, 1);
    assert.equal(portfolio.buildings[0].unitCount, 2);
    assert.equal(portfolio.buildings[0].lat, 43.4222673);

    const url = new URL(stub.calls[0]);
    assert.equal(url.searchParams.get("where"), "OWNERNAME = 'DREWLO HOLDINGS INC'");
    assert.equal(url.searchParams.get("outSR"), "4326");
  } finally {
    stub.restore();
  }
});

test("getKitchenerProperty queries ownership and permits in parallel", async () => {
  const stub = stubFetch((url) => {
    if (url.includes("Building_Permits")) {
      return {
        features: [{
          attributes: {
            PERMITNO: "24 123456", PERMIT_TYPE: "Residential Alteration",
            PERMIT_STATUS: "Issued", ISSUE_DATE: 1700000000000,
            WORK_TYPE: "Interior", SUB_WORK_TYPE: "Basement",
            PERMIT_DESCRIPTION: "Finished basement", CONSTRUCTION_VALUE: 25000,
            TOTAL_UNITS: null, FOLDERNAME: "425 WILSON AVE",
          },
        }],
      };
    }
    return {
      features: [{
        attributes: {
          OBJECTID: 1, OWNERNAME: "PRIVATE", CIVIC_NO: 425, STREET: "WILSON AVE",
          UNIT: null, PROPERTY_UNIT_ID: 999, AGENCY: null,
        },
        geometry: { x: -80.44, y: 43.42 },
      }],
      exceededTransferLimit: false,
    };
  });
  try {
    clearCache();
    const record = await getKitchenerProperty(425, "wilson ave");
    assert.ok(record);
    assert.equal(record.building.address, "425 Wilson Ave");
    assert.equal(record.permits.length, 1);
    assert.equal(record.permits[0].value, 25000);

    const ownershipCall = stub.calls.find((u) => u.includes("Property_Ownership_Public"));
    const permitCall = stub.calls.find((u) => u.includes("Building_Permits"));
    assert.ok(ownershipCall && permitCall);
    assert.equal(
      new URL(ownershipCall).searchParams.get("where"),
      "CIVIC_NO = 425 AND STREET = 'WILSON AVE'"
    );
    assert.equal(
      new URL(permitCall).searchParams.get("where"),
      "FOLDERNAME = '425 WILSON AVE'"
    );
  } finally {
    stub.restore();
  }
});
