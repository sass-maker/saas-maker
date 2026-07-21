export { isLocalAuthBypassEnabled } from './local-auth-edge';

export const LOCAL_DEV_SESSION_TOKEN = 'local-dev-session';

type LocalCliConfig = {
  apiKey?: string;
  sessionToken?: string;
  token?: string;
};

type BuiltinFs = {
  readFileSync(path: string, encoding: 'utf8'): string;
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
    const fs = (getBuiltinModule?.('fs') ??
      (runtimeProcess.versions?.node ? eval('require')('node:fs') : undefined)) as
      | BuiltinFs
      | undefined;
    if (!fs) return undefined;

    const config = JSON.parse(fs.readFileSync(filePath, 'utf8')) as LocalCliConfig;
    return config.apiKey || config.sessionToken || config.token;
  } catch {
    return undefined;
  }
}

export function getLocalSessionToken(): string {
  const home = process.env.HOME;
  const configCandidates = home ? [`${home}/.saasmaker/config.json`] : [];
  const configuredToken =
    process.env.SAASMAKER_LOCAL_SESSION_TOKEN ||
    configCandidates.map(readConfigToken).find(Boolean);

  return configuredToken || LOCAL_DEV_SESSION_TOKEN;
}

export function getLocalDevSession() {
  return {
    user: {
      id: 'local-dev',
      name: 'Local Dev',
      email: 'local@saasmaker.dev',
      image: null,
    },
    session: {
      token: getLocalSessionToken(),
    },
  };
}
