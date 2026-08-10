// Storage stays ISO 8601 (sorts correctly, no ambiguity) — this only runs
// on the way out, right before a response is sent. UTC, not server local
// time, so output doesn't change depending on where this gets deployed.
export function formatDate(iso: string, withTime = true): string {
  const date = new Date(iso);

  const dd = String(date.getUTCDate()).padStart(2, "0");
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = date.getUTCFullYear();

  if (!withTime) return `${dd}-${mm}-${yyyy}`;

  const hh = String(date.getUTCHours()).padStart(2, "0");
  const min = String(date.getUTCMinutes()).padStart(2, "0");
  return `${dd}-${mm}-${yyyy} ${hh}:${min}`;
}
