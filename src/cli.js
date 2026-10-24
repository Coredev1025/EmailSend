#!/usr/bin/env node
import "dotenv/config";
import { parseArgs } from "node:util";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { loadLeads } from "./leads.js";
import { renderTemplate } from "./template.js";
import { createProvider } from "./providers.js";
import { sendBatch } from "./sender.js";

const HELP = `
lead-email — send templated emails via Brevo or Resend (free tiers)

Usage:
  npm run dry-run -- --csv data/leads.sample.csv
  npm run send -- --csv data/leads.csv

Options:
  --csv <path>         CSV with email,name,... columns (required)
  --template <path>    HTML template (default: templates/outreach.html)
  --subject <text>     Subject; supports {{name}} etc. (default from env SUBJECT)
  --provider <name>    brevo | resend (default: PROVIDER or brevo)
  --limit <n>          Max recipients this run (default: all)
  --offset <n>         Skip first N rows (for multi-day free-tier batches)
  --dry-run            Render + log only; do not call the API
  --help               Show this help

Env (see .env.example):
  PROVIDER, BREVO_API_KEY, RESEND_API_KEY, FROM_EMAIL, FROM_NAME, SUBJECT
  DELAY_MS, DAILY_CAP
`;

async function main() {
  const { values } = parseArgs({
    options: {
      csv: { type: "string" },
      template: { type: "string", default: "templates/outreach.html" },
      subject: { type: "string" },
      provider: { type: "string" },
      limit: { type: "string" },
      offset: { type: "string" },
      "dry-run": { type: "boolean", default: false },
      help: { type: "boolean", default: false },
    },
    allowPositionals: false,
  });

  if (values.help) {
    console.log(HELP.trim());
    process.exit(0);
  }

  if (!values.csv) {
    console.error("Missing --csv. Run with --help for usage.");
    process.exit(1);
  }

  const dryRun = values["dry-run"];
  const providerName = (values.provider || process.env.PROVIDER || "brevo").toLowerCase();
  const subjectTpl = values.subject || process.env.SUBJECT || "Quick note for {{name}}";
  const fromEmail = process.env.FROM_EMAIL;
  const fromName = process.env.FROM_NAME || "Your Company";
  const delayMs = Number(process.env.DELAY_MS || 1200);
  const dailyCap = Number(process.env.DAILY_CAP || (providerName === "resend" ? 100 : 300));
  const offset = Number(values.offset || 0);
  const limit = values.limit != null ? Number(values.limit) : undefined;

  if (!dryRun && !fromEmail) {
    console.error("Set FROM_EMAIL in .env (must be on your verified custom domain).");
    process.exit(1);
  }

  const csvPath = path.resolve(values.csv);
  const templatePath = path.resolve(values.template);
  const [leadsAll, htmlTpl] = await Promise.all([
    loadLeads(csvPath),
    readFile(templatePath, "utf8"),
  ]);

  let leads = leadsAll.slice(offset);
  if (limit != null && Number.isFinite(limit)) {
    leads = leads.slice(0, limit);
  }

  if (leads.length === 0) {
    console.error("No leads to send after offset/limit.");
    process.exit(1);
  }

  if (leads.length > dailyCap && !dryRun) {
    console.warn(
      `Warning: ${leads.length} recipients exceeds free daily cap (~${dailyCap}). ` +
        `Use --limit ${dailyCap} and --offset for multi-day sends.`,
    );
  }

  const provider = dryRun
    ? {
        name: "dry-run",
        async send() {
          return { id: "dry-run" };
        },
      }
    : createProvider(providerName);

  console.log(
    JSON.stringify(
      {
        provider: provider.name,
        dryRun,
        from: fromEmail ? `${fromName} <${fromEmail}>` : null,
        recipients: leads.length,
        offset,
        delayMs: dryRun ? 0 : delayMs,
        dailyCap,
      },
      null,
      2,
    ),
  );

  const result = await sendBatch({
    leads,
    delayMs: dryRun ? 0 : delayMs,
    sendOne: async (lead) => {
      const vars = { ...lead, email: lead.email, name: lead.name || "there" };
      const html = renderTemplate(htmlTpl, vars);
      const subject = renderTemplate(subjectTpl, vars);
      const text = htmlToText(html);
      return provider.send({
        to: lead.email,
        toName: lead.name,
        fromEmail,
        fromName,
        subject,
        html,
        text,
      });
    },
  });

  console.log(
    JSON.stringify(
      {
        sent: result.sent,
        failed: result.failed,
        errors: result.errors.slice(0, 20),
      },
      null,
      2,
    ),
  );

  process.exit(result.failed > 0 ? 1 : 0);
}

/** Minimal HTML → plain text for multipart (helps inbox placement). */
function htmlToText(html) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
