const configuredApiBase =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.SAASMAKER_API_URL ||
  process.env.FND_API_URL ||
  "https://api.sassmaker.com";

export const API_BASE = configuredApiBase.replace(/\/$/, "");

export const API_FALLBACK_BASES = [
  API_BASE,
  "https://saasmaker-api.sarthakagrawal927.workers.dev",
].filter((base, index, all) => all.indexOf(base) === index);
