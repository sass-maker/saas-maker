const configuredApiBase =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.SAASMAKER_API_URL ||
  process.env.FND_API_URL ||
  "https://api.sassmaker.com";

export const API_BASE = configuredApiBase.replace(/\/$/, "");
