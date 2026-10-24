# Lead email sender (free-tier)

Node.js CLI that sends **HTML-templated emails** to a CSV of leads through **Brevo** or **Resend**, with dry-run, rate limiting, and multi-day batching so you can stay on free plans for about **2,000** recipients.

> **Legal / ToS:** Only email people who gave you permission (opt-in, customers, form signups). Bought or scraped “lead lists” often violate CAN-SPAM, GDPR/CASL, and provider terms — they also get you blocked and land in spam. This tool does not bypass spam filters.

## Free services compared (researched Oct 2026)

| Service | Free allowance | Fit for ~2,000 emails | Notes |
| --- | --- | --- | --- |
| **[Brevo](https://www.brevo.com/pricing/)** | **~300 emails/day** after account approval, free forever, no card | **Best free fit** (~7 days) | API + SMTP; free marketing sends may show a Brevo footer |
| **[Resend](https://resend.com/pricing)** | **100/day** and **3,000/month** | Works if spread over ~20 days | Excellent DX; custom domain required |
| **[Mailgun](https://www.mailgun.com/pricing/)** | ~100/day free | ~20 days | 1 domain on free |
| **SendGrid** | Trial only (~100/day, ~60 days) | Not ongoing free | Paid after trial |
| **Amazon SES** | No ongoing free tier (new AWS credits may apply) | **Cheapest paid**: ~$0.10–$0.40 for 2K | Sandbox until production access; best long-term cost |

**Recommendation for free + 2K leads:** use **Brevo**, send **≤300/day** with `--limit 300` and bump `--offset` each day. If you can spend a few cents, **Amazon SES** is the usual “almost free” production choice after domain + production access are approved.

Sign up:

1. [Brevo](https://www.brevo.com/) → Settings → SMTP & API → create an API key  
2. Or [Resend](https://resend.com/) → API Keys  

## How to stay out of the spam folder (required, not optional)

There is **no free trick** that puts cold bulk mail in the inbox. Providers (Gmail, Yahoo, Microsoft) require:

1. **Your own domain** — never send bulk from `@gmail.com` / `@yahoo.com` / `@outlook.com`.
2. **SPF + DKIM** via the ESP’s DNS records (Brevo/Resend dashboards show exact values).
3. **DMARC** TXT on `_dmarc.yourdomain.com`, e.g.  
   `v=DMARC1; p=none; rua=mailto:dmarc@yourdomain.com`  
   (Microsoft treats missing DMARC harshly.)
4. Prefer a **subdomain** for sending: `mail.yourdomain.com` or `updates.yourdomain.com` so marketing reputation does not burn your root domain.
5. **Warm up** — do not blast 2,000 on day one from a new domain. Start with tens/hundreds per day and ramp.
6. **One recipient per message** (this CLI does that). Never BCC a lead list.
7. Include **plain text + HTML**, a real **From** person, and a working **unsubscribe** link. Keep spam complaint rate **under ~0.3%**.
8. Personalize lightly (`{{name}}`, relevant `{{topic}}`); avoid spammy subjects (ALL CAPS, “FREE!!!”, misleading claims).

If authentication is wrong, **no API** will save you — fix DNS first, then send.

## Setup

```bash
cp .env.example .env
# edit .env: PROVIDER, API key, FROM_EMAIL on your verified domain
npm install
```

### CSV formats

**Simple** (`data/leads.sample.csv`):

```csv
email,name,company,topic,sender_name,consent_reason,unsubscribe_url
alex@example.com,Alex,Acme,inventory alerts,Sam,requested a demo,https://example.com/unsub?e=alex@example.com
```

**LeadSays export** (e.g. `data/leadsays-united-states.csv` — keep local; gitignored):

- Reads `Emails` (comma-separated), prefers a **work** address over Gmail/Yahoo/etc. when both exist
- Maps `First Name` → `{{first_name}}`, `Company Name` → `{{company_name}}`, `Job title` → `{{job_title}}`
- Dedupes by email; skips rows with no valid address

```bash
npm run dry-run -- --csv data/leadsays-united-states.csv --limit 5 --preview 2
npm run send -- --csv data/leadsays-united-states.csv --limit 300 --offset 0
```

Edit `templates/outreach.html` — placeholders use `{{column_name}}`. Set `TOPIC`, `SENDER_COMPANY`, and `UNSUBSCRIBE_URL_BASE` in `.env`.

## Run

```bash
# Safe preview (no API calls)
npm run dry-run -- --csv data/leads.sample.csv

# Live send (Brevo free: max ~300/day)
npm run send -- --csv data/leads.csv --limit 300 --offset 0

# Next day
npm run send -- --csv data/leads.csv --limit 300 --offset 300
```

Useful flags: `--provider brevo|resend`, `--template path`, `--subject "Hi {{name}}"`, `--dry-run`.

## Python alternative (same idea)

Use Brevo’s HTTP API with `requests` — same auth DNS rules apply:

```python
import os, requests

def send_brevo(to_email, to_name, subject, html, text):
    r = requests.post(
        "https://api.brevo.com/v3/smtp/email",
        headers={"api-key": os.environ["BREVO_API_KEY"], "accept": "application/json"},
        json={
            "sender": {"email": os.environ["FROM_EMAIL"], "name": os.environ["FROM_NAME"]},
            "to": [{"email": to_email, "name": to_name}],
            "subject": subject,
            "htmlContent": html,
            "textContent": text,
        },
        timeout=30,
    )
    r.raise_for_status()
    return r.json()
```

Throttle to your free daily cap the same way as the Node CLI.

## Project layout

```
src/cli.js          CLI entry
src/providers.js    Brevo + Resend HTTP clients
src/template.js     {{placeholder}} rendering
src/leads.js        CSV loader
src/sender.js       Rate-limited batch send
templates/          HTML email templates
data/               Sample CSV (keep real leads out of git)
```

## Tests

```bash
npm test
npm run dry-run -- --csv data/leads.sample.csv
```
