function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Send one-by-one with delay to respect free daily caps and reduce spam signals.
 */
export async function sendBatch({ leads, delayMs, sendOne }) {
  const errors = [];
  let sent = 0;
  let failed = 0;

  for (let i = 0; i < leads.length; i++) {
    const lead = leads[i];
    try {
      const result = await sendOne(lead);
      sent += 1;
      console.log(`[${i + 1}/${leads.length}] OK ${lead.email} ${result.id || ""}`);
    } catch (err) {
      failed += 1;
      const message = err.message || String(err);
      errors.push({ email: lead.email, message });
      console.error(`[${i + 1}/${leads.length}] FAIL ${lead.email}: ${message}`);
    }

    if (delayMs > 0 && i < leads.length - 1) {
      await sleep(delayMs);
    }
  }

  return { sent, failed, errors };
}
