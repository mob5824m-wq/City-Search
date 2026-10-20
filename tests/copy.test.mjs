import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const sources = ["assets/js/views/property.js", "assets/js/views/about.js", "assets/js/views/search.js", "assets/js/config.js"]
  .map((f) => read(f)).join("\n");

test("provincial pricing is stated, not called 'small'", () => {
  assert.ok(!/small fee/i.test(sources), "do not describe the provincial tariff as a small fee");
  assert.match(sources, /\$36\.50/);
  assert.match(sources, /\$2\.56/);
});

test("it is clear the fee is the province's, not this site's", () => {
  assert.match(sources, /Ledger KW charges nothing/);
  assert.match(sources, /provincial tariff|province set the fees/i);
});

test("the free routes are documented", () => {
  assert.match(sources, /assessment roll/i);
  assert.match(sources, /AboutMyProperty/);
  assert.match(sources, /tenancy agreement/i);
});
