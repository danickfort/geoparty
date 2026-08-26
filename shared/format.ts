/** Whole kilometres with thousands separators, e.g. "1,234 km". */
export function formatKm(km: number): string {
  return `${Math.round(km).toLocaleString('en-US')} km`
}

/** Points with at most one decimal and no trailing ".0" (0.5 → "0.5", 2 → "2"). */
export function formatPoints(points: number): string {
  return Number.isInteger(points) ? String(points) : points.toFixed(1)
}
