const POSTER_PALETTES = [
  { glow: '#ff9a32', hot: '#e7432f', cool: '#5f1a78', ink: '#10080e' },
  { glow: '#d9ef62', hot: '#678f32', cool: '#31205f', ink: '#080d0a' },
  { glow: '#f6c55c', hot: '#8d2638', cool: '#1d4269', ink: '#0a0b13' },
  { glow: '#76d5cf', hot: '#2c6880', cool: '#6d2f7f', ink: '#070c13' },
  { glow: '#ff7f50', hot: '#9c2142', cool: '#283681', ink: '#0d0810' },
  { glow: '#c792ff', hot: '#5540a3', cool: '#862f4d', ink: '#090811' }
];

export function posterSeed(song = {}) {
  const source = [song.title, song.displayName, song.name, song.artist]
    .filter(Boolean)
    .join('|')
    .toLowerCase();
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function posterTheme(song = {}) {
  const seed = posterSeed(song);
  const palette = POSTER_PALETTES[seed % POSTER_PALETTES.length];
  return {
    ...palette,
    angle: `${-18 + (seed % 37)}deg`,
    flareX: `${18 + (seed % 65)}%`,
    flareY: `${12 + ((seed >>> 6) % 58)}%`,
    motif: seed % 3
  };
}

export function clampSongIndex(index, length) {
  if (!Number.isFinite(index) || length <= 0) return 0;
  return Math.min(length - 1, Math.max(0, Math.trunc(index)));
}
