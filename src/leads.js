import { readFile } from "node:fs/promises";

/**
 * Parse a simple CSV with a header row.
 * Required column: email. Optional: name and any other {{placeholders}}.
 */
export async function loadLeads(csvPath) {
  const raw = await readFile(csvPath, "utf8");
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#"));

  if (lines.length < 2) {
    throw new Error(`CSV needs a header and at least one row: ${csvPath}`);
  }

  const headers = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  if (!headers.includes("email")) {
    throw new Error('CSV must include an "email" column');
  }

  const leads = [];
  const seen = new Set();

  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    const row = {};
    headers.forEach((h, idx) => {
      row[h] = (cols[idx] ?? "").trim();
    });

    const email = row.email.toLowerCase();
    if (!isValidEmail(email)) {
      console.warn(`Skipping invalid email on line ${i + 1}: ${row.email}`);
      continue;
    }
    if (seen.has(email)) continue;
    seen.add(email);

    leads.push({
      ...row,
      email,
      name: row.name || "",
    });
  }

  return leads;
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** Handles quoted fields and commas inside quotes. */
export function splitCsvLine(line) {
  const out = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}
