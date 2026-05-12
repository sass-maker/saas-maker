const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

export const LOCAL_DEV_SESSION_TOKEN = "local-dev-session";
export const LOCAL_ACCESS_COOKIE = "saasmaker_local_access";

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

export function getLocalProtectionToken(): string | undefined {
  return process.env.SAASMAKER_LOCAL_ACCESS_TOKEN || process.env.LOCAL_ACCESS_TOKEN;
}

export function isLocalProtectionEnabled(): boolean {
  return Boolean(getLocalProtectionToken());
}

type LocalCliConfig = {
  apiKey?: string;
  sessionToken?: string;
  token?: string;
};

type BuiltinFs = {
  readFileSync(path: string, encoding: "utf8"): string;
};

function readConfigToken(filePath: string): string | undefined {
  try {
    const runtimeProcess = process as typeof process & {
      getBuiltinModule?: (name: string) => unknown;
    };
    const getBuiltinModule = (
      process as typeof process & {
        getBuiltinModule?: (name: string) => unknown;
      }
    ).getBuiltinModule;
    const fs = (getBuiltinModule?.("fs") ??
      (runtimeProcess.versions?.node ? eval("require")("node:fs") : undefined)) as BuiltinFs | undefined;
    if (!fs) return undefined;

    const config = JSON.parse(fs.readFileSync(filePath, "utf8")) as LocalCliConfig;
    return config.apiKey || config.sessionToken || config.token;
  } catch {
    return undefined;
  }
}

export function getLocalSessionToken(): string {
  const home = process.env.HOME;
  const configCandidates = home
    ? [`${home}/.foundry/config.json`, `${home}/.saasmaker/config.json`]
    : [];
  const configuredToken =
    process.env.SAASMAKER_LOCAL_SESSION_TOKEN ||
    process.env.FOUNDRY_API_KEY ||
    process.env.FOUNDRY_SESSION_TOKEN ||
    configCandidates.map(readConfigToken).find(Boolean);

  return configuredToken || LOCAL_DEV_SESSION_TOKEN;
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
