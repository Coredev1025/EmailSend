/**
 * Replace {{key}} placeholders. Missing keys become empty string.
 * Supports nested-looking keys only as flat map entries (e.g. company).
 */
export function renderTemplate(source, vars) {
  return source.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
    const value = vars[key];
    return value == null ? "" : String(value);
  });
}
