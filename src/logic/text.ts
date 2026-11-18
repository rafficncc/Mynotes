/** Lower-case, trimmed, single-spaced text for matching names (shops, people, bills). */
export const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
