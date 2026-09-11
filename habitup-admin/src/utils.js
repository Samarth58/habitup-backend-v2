/**
 * Format a duration given in seconds to a human-readable string.
 * Examples: 3661 → "1h 1m", 90 → "1m"
 */
export function formatDuration(seconds) {
  if (!seconds && seconds !== 0) return '—';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hrs > 0) return `${hrs}h ${mins}m`;
  return `${mins}m`;
}

/**
 * Build a URLSearchParams string from a params object,
 * omitting any keys whose value is falsy (null, undefined, '').
 */
export function buildQuery(params) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      query.append(key, value);
    }
  }
  return query.toString();
}
