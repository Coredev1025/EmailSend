import { readFile } from "node:fs/promises";
import { parse } from "csv-parse/sync";

const FREE_MAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "ymail.com",
  "hotmail.com",
  "outlook.com",
  "live.com",
  "msn.com",
  "aol.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "mail.com",
  "protonmail.com",
  "proton.me",
  "comcast.net",
  "sbcglobal.net",
  "att.net",
  "cox.net",
  "verizon.net",
  "bellsouth.net",
]);

/**
 * Parse CSV leads. Supports:
 * - Simple: email, name, ...
 * - LeadSays export: Emails (comma-separated), Full name, First Name, Company Name, Job title, ...
 */
export async function loadLeads(csvPath, options = {}) {
  const preferWorkEmail = options.preferWorkEmail !== false;
  const expandAllEmails = options.expandAllEmails === true;

  const raw = await readFile(csvPath, "utf8");
  const records = parse(raw, {
    columns: (header) => header.map((h) => normalizeHeader(h)),
    skip_empty_lines: true,
    relax_column_count: true,
    relax_quotes: true,
    trim: true,
  });

  if (records.length === 0) {
    throw new Error(`CSV has no data rows: ${csvPath}`);
  }

  const leads = [];
  const seen = new Set();

  for (let i = 0; i < records.length; i++) {
    const mapped = mapLeadSaysRow(records[i]);
    const emailCandidates = pickEmails(mapped.emails_raw || mapped.email || "", {
      preferWorkEmail,
    });

    if (emailCandidates.length === 0) {
      console.warn(`Skipping row ${i + 2}: no valid email`);
      continue;
    }

    const targets = expandAllEmails ? emailCandidates : [emailCandidates[0]];

    for (const email of targets) {
      if (seen.has(email)) continue;
      seen.add(email);

      leads.push({
        ...mapped,
        email,
        name: mapped.name || mapped.first_name || "",
      });
    }
  }

  return leads;
}

export function mapLeadSaysRow(row) {
  const first = row.first_name || "";
  const last = row.last_name || "";
  const full =
    row.full_name ||
    row.name ||
    [first, last].filter(Boolean).join(" ") ||
    "";

  const company = row.company_name || row.company || "";
  const jobTitle = row.job_title || row.title || "";
  const industry = row.industry || row.company_industry || "";
  const emailsRaw = row.emails || row.email || "";

  return {
    ...row,
    emails_raw: emailsRaw,
    email: "",
    name: titleCaseName(full || first),
    first_name: titleCaseName(first || full.split(/\s+/)[0] || ""),
    last_name: titleCaseName(last),
    full_name: titleCaseName(full),
    company,
    company_name: company,
    job_title: jobTitle,
    industry,
    location: row.location || "",
    company_website: row.company_website || "",
  };
}

export function pickEmails(raw, { preferWorkEmail = true } = {}) {
  const parts = String(raw)
    .split(/[,;]+/)
    .map((e) => e.trim().toLowerCase())
    .filter(isValidEmail);

  if (parts.length === 0) return [];
  if (!preferWorkEmail) return unique(parts);

  const work = parts.filter((e) => !FREE_MAIL_DOMAINS.has(e.split("@")[1]));
  const free = parts.filter((e) => FREE_MAIL_DOMAINS.has(e.split("@")[1]));
  return unique([...work, ...free]);
}

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function normalizeHeader(h) {
  return String(h || "")
    .trim()
    .toLowerCase()
    .replace(/[\s]+/g, "_")
    .replace(/_+/g, "_");
}

function titleCaseName(value) {
  const s = String(value || "").trim();
  if (!s) return "";
  return s
    .split(/\s+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : ""))
    .join(" ");
}

function unique(arr) {
  return [...new Set(arr)];
}

/** Kept for unit tests / simple one-line splits. */
export function splitCsvLine(line) {
  return parse(line, { relax_quotes: true })[0] || [];
}
