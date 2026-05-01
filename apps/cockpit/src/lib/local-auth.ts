const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

export const LOCAL_DEV_SESSION_TOKEN = "local-dev-session";

export function isLocalHost(hostHeader: string | null | undefined): boolean {
  if (!hostHeader) return false;
  const host = hostHeader.trim().toLowerCase();
  if (host.startsWith("[")) {
    return host.startsWith("[::1]");
  }
  return LOCAL_HOSTS.has(host.split(":")[0] ?? "");
}

export function isLocalAuthBypassEnabled(hostHeader: string | null | undefined): boolean {
  if (process.env.LOCAL_AUTH_BYPASS === "true") return true;
  return isLocalHost(hostHeader) && process.env.DISABLE_LOCAL_AUTH_BYPASS !== "true";
}

export function getLocalSessionToken(): string {
  return process.env.SAASMAKER_LOCAL_SESSION_TOKEN || LOCAL_DEV_SESSION_TOKEN;
}

export function getLocalDevSession() {
  return {
    user: {
      id: "local-dev",
      name: "Local Dev",
      email: "local@saasmaker.dev",
      image: null,
    },
    session: {
      token: getLocalSessionToken(),
    },
  };
}
