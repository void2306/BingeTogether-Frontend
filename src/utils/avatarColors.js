// Curated vibrant palette for multiplayer seek bar pins & member badges
const MARKER_COLORS = [
  "#6366f1", // Indigo
  "#ec4899", // Pink
  "#10b981", // Emerald
  "#f59e0b", // Amber
  "#06b6d4", // Cyan
  "#8b5cf6", // Purple
  "#f43f5e", // Rose
  "#14b8a6", // Teal
  "#e11d48", // Crimson
];

/**
 * Deterministically maps a userId or name to a persistent vibrant color.
 * @param {string|number} userId
 * @returns {string} Hex color string
 */
export function getMemberColor(userId) {
  if (!userId) return MARKER_COLORS[0];
  const numId = Number(userId);
  if (!isNaN(numId) && numId > 0) {
    return MARKER_COLORS[Math.abs(numId) % MARKER_COLORS.length];
  }
  const str = String(userId);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return MARKER_COLORS[Math.abs(hash) % MARKER_COLORS.length];
}
