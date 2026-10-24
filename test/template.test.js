import { test } from "node:test";
import assert from "node:assert/strict";
import { renderTemplate } from "../src/template.js";
import { splitCsvLine } from "../src/leads.js";

test("renderTemplate replaces placeholders", () => {
  assert.equal(renderTemplate("Hi {{name}}", { name: "Alex" }), "Hi Alex");
  assert.equal(renderTemplate("{{ missing }}", {}), "");
});

test("splitCsvLine handles quotes", () => {
  assert.deepEqual(splitCsvLine('a,"b,c",d'), ["a", "b,c", "d"]);
});
