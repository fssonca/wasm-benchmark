export function normalizeSeed(rawSeed, fallback = 12345) {
  const parsed = Number.parseInt(rawSeed, 10);
  if (!Number.isFinite(parsed)) return fallback >>> 0;
  return (parsed >>> 0) || fallback >>> 0;
}

export function hashStringFNV1a32(value) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function buildTickerSeed(seedBase, ticker, tickerIndex) {
  const tickerHash = hashStringFNV1a32(String(ticker));
  const mixed = (seedBase ^ tickerHash ^ (tickerIndex * 0x9e3779b9)) >>> 0;
  return mixed || 0x6d2b79f5;
}
