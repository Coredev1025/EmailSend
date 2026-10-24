import { test } from "node:test";
import assert from "node:assert/strict";
import { pickEmails, normalizeHeader, mapLeadSaysRow, splitCsvLine } from "../src/leads.js";

test("prefer work email over gmail when both present", () => {
  const emails = pickEmails("sfrers@gmail.com, sfrers@salesforce.com");
  assert.equal(emails[0], "sfrers@salesforce.com");
});

test("normalizeHeader maps LeadSays columns", () => {
  assert.equal(normalizeHeader("Full name"), "full_name");
  assert.equal(normalizeHeader("Emails"), "emails");
  assert.equal(normalizeHeader("Company Name"), "company_name");
});

test("mapLeadSaysRow fills template fields", () => {
  const mapped = mapLeadSaysRow({
    full_name: "niko contardi",
    first_name: "niko",
    company_name: "elitelyfe",
    job_title: "chief executive officer",
    emails: "niko@elitelyfe.com",
  });
  assert.equal(mapped.first_name, "Niko");
  assert.equal(mapped.company_name, "elitelyfe");
  assert.equal(mapped.job_title, "chief executive officer");
});

test("splitCsvLine handles quoted commas", () => {
  assert.deepEqual(splitCsvLine('"x,y",z'), ["x,y", "z"]);
});
