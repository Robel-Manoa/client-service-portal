// Formats dates for API responses. Dates are still stored as ISO 8601
// internally (reliable chronological sorting, no ambiguity); this formatting
// only happens on the way out, right before the JSON response is sent.
// UTC is used instead of the server's local time so the output doesn't
// depend on where the server happens to be deployed.
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
