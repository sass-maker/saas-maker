import { existsSync, readFileSync, realpathSync } from "node:fs";
import { homedir, hostname } from "node:os";
import { dirname, isAbsolute, resolve } from "node:path";
import type { OperationName } from "@mobile-dev-cockpit/protocol";

type CommandName = OperationName | "agentResume";
export type CommandMap = Partial<
  Record<CommandName, readonly [string, ...string[]]>
>;

export interface ProjectConfig {
  id: string;
  name: string;
  repositoryPath: string;
  previewUrl?: string;
  productionUrl?: string;
  environment: Record<string, string>;
  commands: CommandMap;
  source?: "static" | "dynamic";
  discoveryRoot?: string;
  repositoryIdentity?: string;
}

export interface BridgeConfig {
  machineName: string;
  host: string;
  advertisedHost?: string;
  port: number;
  pairingTtlSeconds: number;
  sessionTtlSeconds: number;
  approvalTtlSeconds: number;
  logLineLimit: number;
  diffByteLimit: number;
  stateFile: string;
  catalogFile: string;
  discoveryRoots: string[];
  projects: ProjectConfig[];
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function text(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim() === "")
    throw new Error(`${label} must be a string`);
  return value;
}

function positiveInteger(
  value: unknown,
  fallback: number,
  label: string,
): number {
  if (value === undefined) return fallback;
  if (!Number.isInteger(value) || (value as number) <= 0)
    throw new Error(`${label} must be positive`);
  return value as number;
}

function boundedInteger(
  value: unknown,
  fallback: number,
  label: string,
  maximum: number,
): number {
  const parsed = positiveInteger(value, fallback, label);
  if (parsed > maximum) throw new Error(`${label} must be at most ${maximum}`);
  return parsed;
}

function optionalUrl(value: unknown, label: string): string | undefined {
  if (value === undefined) return undefined;
  const parsed = new URL(text(value, label));
  if (!["http:", "https:"].includes(parsed.protocol))
    throw new Error(`${label} must use http or https`);
  return parsed.toString();
}

export function parseConfig(input: unknown, configPath: string): BridgeConfig {
  const root = record(input, "config");
  const rawProjects = root.projects === undefined ? [] : root.projects;
  if (!Array.isArray(rawProjects)) throw new Error("projects must be an array");

  const rawDiscoveryRoots =
    root.discoveryRoots === undefined ? [] : root.discoveryRoots;
  if (!Array.isArray(rawDiscoveryRoots))
    throw new Error("discoveryRoots must be an array");
  const discoveryRoots = rawDiscoveryRoots.map((value, index) => {
    const configured = text(value, `discoveryRoots[${index}]`);
    if (!isAbsolute(configured))
      throw new Error(`discoveryRoots[${index}] must be absolute`);
    if (!existsSync(configured))
      throw new Error(`discoveryRoots[${index}] does not exist`);
    return realpathSync(configured);
  });

  if (rawProjects.length === 0 && discoveryRoots.length === 0) {
    throw new Error("Configure at least one project or discovery root");
  }

  const seen = new Set<string>();
  const projects = rawProjects.map((raw, index): ProjectConfig => {
    const project = record(raw, `projects[${index}]`);
    const id = text(project.id, `projects[${index}].id`);
    if (!/^[a-z0-9][a-z0-9-]*$/.test(id))
      throw new Error(`Invalid project id: ${id}`);
    if (seen.has(id)) throw new Error(`Duplicate project id: ${id}`);
    seen.add(id);

    const configuredPath = text(project.repositoryPath, `${id}.repositoryPath`);
    if (!isAbsolute(configuredPath))
      throw new Error(`${id}.repositoryPath must be absolute`);
    if (!existsSync(configuredPath))
      throw new Error(`${id}.repositoryPath does not exist`);
    const repositoryPath = realpathSync(configuredPath);

    const commandsRecord = record(project.commands, `${id}.commands`);
    const commands: CommandMap = {};
    for (const operation of [
      "dev",
      "tunnel",
      "build",
      "test",
      "agent",
      "agentResume",
      "deploy",
      "rollback",
    ] as const) {
      const candidate = commandsRecord[operation];
      if (candidate === undefined) continue;
      if (
        !Array.isArray(candidate) ||
        candidate.length === 0 ||
        candidate.some((part) => typeof part !== "string" || part === "")
      ) {
        throw new Error(
          `${id}.commands.${operation} must be a non-empty argv string array`,
        );
      }
      commands[operation] = candidate as [string, ...string[]];
    }

    const environmentRecord =
      project.environment === undefined
        ? {}
        : record(project.environment, `${id}.environment`);
    const environment: Record<string, string> = {};
    for (const [key, value] of Object.entries(environmentRecord)) {
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) || typeof value !== "string") {
        throw new Error(
          `${id}.environment must map valid variable names to strings`,
        );
      }
      environment[key] = value;
    }

    return {
      id,
      name: text(project.name, `${id}.name`),
      repositoryPath,
      previewUrl: optionalUrl(project.previewUrl, `${id}.previewUrl`),
      productionUrl: optionalUrl(project.productionUrl, `${id}.productionUrl`),
      environment,
      commands,
    };
  });

  const configDirectory = dirname(resolve(configPath));
  const rawStateFile =
    typeof root.stateFile === "string"
      ? root.stateFile
      : ".mobile-dev-cockpit/state.json";
  const stateFile = isAbsolute(rawStateFile)
    ? rawStateFile
    : resolve(configDirectory, rawStateFile);
  const rawCatalogFile =
    typeof root.catalogFile === "string"
      ? root.catalogFile
      : resolve(dirname(stateFile), "projects.json");
  const catalogFile = isAbsolute(rawCatalogFile)
    ? rawCatalogFile
    : resolve(configDirectory, rawCatalogFile);

  return {
    machineName: text(root.machineName, "machineName"),
    host: typeof root.host === "string" ? root.host : "127.0.0.1",
    advertisedHost:
      typeof root.advertisedHost === "string" ? root.advertisedHost : undefined,
    port: positiveInteger(root.port, 4782, "port"),
    pairingTtlSeconds: boundedInteger(
      root.pairingTtlSeconds,
      300,
      "pairingTtlSeconds",
      3_600,
    ),
    sessionTtlSeconds: boundedInteger(
      root.sessionTtlSeconds,
      86_400,
      "sessionTtlSeconds",
      604_800,
    ),
    approvalTtlSeconds: boundedInteger(
      root.approvalTtlSeconds,
      60,
      "approvalTtlSeconds",
      600,
    ),
    logLineLimit: positiveInteger(root.logLineLimit, 500, "logLineLimit"),
    diffByteLimit: positiveInteger(
      root.diffByteLimit,
      200_000,
      "diffByteLimit",
    ),
    stateFile,
    catalogFile,
    discoveryRoots,
    projects,
  };
}

export function loadConfig(configPath: string): BridgeConfig {
  return parseConfig(
    JSON.parse(readFileSync(configPath, "utf8")) as unknown,
    configPath,
  );
}

export function createLowConfiguration(
  roots: string[],
  stateDirectory = resolve(
    homedir(),
    "Library",
    "Application Support",
    "Mobile Dev Cockpit",
  ),
): BridgeConfig {
  return parseConfig(
    {
      machineName: hostname().replace(/\.local$/i, ""),
      discoveryRoots: roots.map((root) => resolve(root)),
      stateFile: resolve(stateDirectory, "state.json"),
      catalogFile: resolve(stateDirectory, "projects.json"),
      projects: [],
    },
    resolve(stateDirectory, "config.json"),
  );
}
