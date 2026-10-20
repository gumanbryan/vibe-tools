// Refresh untouched built-ins; a user's own versions always win.
export function mergeThemeCatalog(current, seeds, legacy = []) {
  const out = structuredClone(current ?? []);
  for (const seed of seeds) {
    const i = out.findIndex(t => t.id === seed.id);
    if (i < 0) { out.push(structuredClone(seed)); continue; }
    const t = out[i], previous = legacy.find(x => x.id === t.id);
    const pristineLegacy = previous && JSON.stringify(t) === JSON.stringify(previous);
    if (t.seedManaged === true || pristineLegacy) out[i] = structuredClone(seed);
  }
  return out;
}
