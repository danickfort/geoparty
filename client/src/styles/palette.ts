/**
 * Atlas colours for Leaflet vectors (circles, polylines), which take plain
 * colour strings and can't read CSS variables. Mirrors theme.css —
 * tests/palette.test.ts fails if the two drift apart.
 */
export const PALETTE = {
  /** --text: navy ink */
  ink: '#182337',
  /** --muted: guess-to-flag lines */
  muted: '#4b596f',
  /** --hot: the half-point ring, the winner's line */
  pin: '#d33f49',
  /** --water */
  water: '#2b6b9b',
} as const
