import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

import brandConfig from '../config/brand-channels.json' with { type: 'json' };

const PLATFORM_FOR_CHANNEL = { youtube_shorts: 'youtube', instagram_reels: 'instagram' };
const REQUIRED_FIELDS = {
  youtube: ['clientIdEnv', 'clientSecretEnv', 'refreshTokenEnv'],
  instagram: ['appIdEnv', 'appSecretEnv', 'userIdEnv', 'longLivedTokenEnv'],
};

export function checkSocialReadiness(options = {}) {
  const configPath = path.resolve(options.configPath ?? process.env.SOCIAL_ACCOUNTS_CONFIG ?? 'config/social-accounts.json');
  const templatePath = path.resolve(options.templatePath ?? 'config/social-accounts.example.json');
  const env = options.env ?? process.env;
  const installed = existsSync(configPath);
  const raw = JSON.parse(readFileSync(installed ? configPath : templatePath, 'utf8'));
  const accounts = [];
  for (const [brandSlug, brand] of Object.entries(brandConfig.brands)) {
    for (const channel of brand.channels) {
      const platform = PLATFORM_FOR_CHANNEL[channel];
      const accountSlug = brand.accountMappings?.[channel] ?? null;
      const account = accountSlug ? raw?.[platform]?.[accountSlug] : null;
      const requiredFields = REQUIRED_FIELDS[platform] ?? [];
      const missingDeclarations = requiredFields.filter((field) => !account?.[field]);
      const missingEnv = requiredFields
        .map((field) => account?.[field])
        .filter(Boolean)
        .filter((name) => !env[name]);
      accounts.push({
        brand: brandSlug,
        channel,
        platform,
        accountSlug,
        routeConfigured: Boolean(accountSlug),
        accountDeclared: Boolean(account),
        missingDeclarations,
        missingEnv,
        ready: Boolean(accountSlug && account && missingDeclarations.length === 0 && missingEnv.length === 0),
      });
    }
  }
  const infrastructure = {
    saasMakerAccess: Boolean(env.SAASMAKER_SESSION_TOKEN) || fndAuthenticated(options.fndBin),
    artifactBucket: true,
    artifactBaseUrl: true,
    kokoro: options.kokoroReady ?? existsSync(path.resolve('tools/kokoro')),
    ffmpeg: options.ffmpegReady ?? commandExists('ffmpeg', options.pathEnv ?? env.PATH),
  };
  const summary = {
    totalAccounts: accounts.length,
    routedAccounts: accounts.filter((entry) => entry.routeConfigured && entry.accountDeclared).length,
    connectedAccounts: accounts.filter((entry) => entry.ready).length,
    missingCredentialVariables: [...new Set(accounts.flatMap((entry) => entry.missingEnv))].sort(),
    infrastructureReady: Object.values(infrastructure).every(Boolean),
  };
  return {
    schema: 'reel-pipeline.social-readiness.v1',
    generatedAt: new Date().toISOString(),
    configPath,
    configInstalled: installed,
    activeChannels: ['instagram_reels', 'youtube_shorts'],
    accounts,
    infrastructure,
    summary: { ...summary, readyForLivePosting: summary.connectedAccounts === summary.totalAccounts && summary.infrastructureReady },
  };
}

function commandExists(command, pathEnv = '') {
  return String(pathEnv).split(path.delimiter).some((dir) => existsSync(path.join(dir, command)));
}

function fndAuthenticated(input) {
  if (input) {
    if (!existsSync(input)) return false;
    return spawnSync(input, ['whoami'], { stdio: 'ignore', timeout: 10_000 }).status === 0;
  }
  const cli = process.env.FND_CLI_JS ?? path.resolve('../saas-maker/packages/cli/dist/index.js');
  if (!existsSync(cli)) return false;
  return spawnSync(process.execPath, [cli, 'whoami'], { stdio: 'ignore', timeout: 10_000 }).status === 0;
}
