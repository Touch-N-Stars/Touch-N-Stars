// Subsequence fuzzy match: every character of `query`, in order, appears
// somewhere in `text` (case-insensitive). Tolerates typos, missing spaces,
// and partial names — "m17" matches "M 17", "emisneb" matches "Emission
// Nebula" — the same technique editors use for command-palette filtering.
export function fuzzyMatch(text, query) {
  if (!query) return true;
  const t = text.toLowerCase();
  const q = query.toLowerCase();

  let ti = 0;
  for (let qi = 0; qi < q.length; qi++) {
    const ch = q[qi];
    if (ch === ' ') continue; // spaces in the query never have to match a literal space
    const found = t.indexOf(ch, ti);
    if (found === -1) return false;
    ti = found + 1;
  }
  return true;
}
