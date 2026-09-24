/** Whole kilometres with thousands separators ("1,234 km"); metres below 1 km ("180 m"). */
export function formatKm(km: number): string {
  const metres = Math.round(km * 1000)
  if (metres < 1000) return `${metres} m`
  return `${Math.round(km).toLocaleString('en-US')} km`
}

/** Points with at most one decimal and no trailing ".0" (0.5 → "0.5", 2 → "2"). */
export function formatPoints(points: number): string {
  return Number.isInteger(points) ? String(points) : points.toFixed(1)
}

/** Whole seconds as `m:ss` ("2:59"); never negative. */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
}
