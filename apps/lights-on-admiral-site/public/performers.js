export function choosePerformer(performers, { forced, previous, random = Math.random } = {}) {
  const keys = Object.keys(performers || {});
  if (!keys.length) throw new Error('At least one performer is required.');
  if (forced && performers[forced]) return forced;

  const pool = keys.length > 1 ? keys.filter((key) => key !== previous) : keys;
  const candidate = random();
  const value = Number.isFinite(candidate) ? candidate : 0;
  const index = Math.min(pool.length - 1, Math.max(0, Math.floor(value * pool.length)));
  return pool[index];
}
