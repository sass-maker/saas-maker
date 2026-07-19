import { randomUUID } from "node:crypto";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { dirname, relative, sep } from "node:path";
import type { BridgeConfig, CommandMap, ProjectConfig } from "./config.js";
import type { RepositoryDetails } from "./discover.js";
import {
  commandsFromCandidates,
  type InternalCandidate,
} from "./repository-candidates.js";

interface Catalog {
  version: 1;
  projects: ProjectConfig[];
}

function contained(root: string, path: string): boolean {
  const location = relative(root, path);
  return (
    location === "" || (location !== ".." && !location.startsWith(`..${sep}`))
  );
}

function commandMap(value: unknown): CommandMap {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    throw new Error("Dynamic project commands must be an object");
  const result: CommandMap = {};
  const allowed = new Set([
    "dev",
    "tunnel",
    "build",
    "test",
    "agent",
    "agentResume",
    "deploy",
    "rollback",
  ]);
  for (const [operation, argv] of Object.entries(value)) {
    if (!allowed.has(operation))
      throw new Error(`Unknown dynamic operation: ${operation}`);
    if (
      !Array.isArray(argv) ||
      argv.length === 0 ||
      argv.length > 32 ||
      argv.some(
        (part) =>
          typeof part !== "string" || part.length === 0 || part.length > 4_096,
      )
    )
      throw new Error(`Invalid dynamic argv for ${operation}`);
    result[operation as keyof CommandMap] = argv as [string, ...string[]];
  }
  return result;
}

function parseDynamicProject(
  value: unknown,
  roots: readonly string[],
): ProjectConfig {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    throw new Error("Dynamic project must be an object");
  const project = value as Record<string, unknown>;
  const requiredStrings = [
    "id",
    "name",
    "repositoryPath",
    "discoveryRoot",
    "repositoryIdentity",
  ];
  for (const key of requiredStrings) {
    if (typeof project[key] !== "string" || !(project[key] as string).trim())
      throw new Error(`Dynamic project ${key} must be a string`);
  }
  if (project.source !== "dynamic")
    throw new Error("Catalog may contain only dynamic projects");
  const repositoryPath = realpathSync(project.repositoryPath as string);
  const discoveryRoot = realpathSync(project.discoveryRoot as string);
  if (
    !roots.includes(discoveryRoot) ||
    !contained(discoveryRoot, repositoryPath)
  )
    throw new Error("Dynamic project is outside configured discovery roots");
  const optionalUrl = (
    key: "previewUrl" | "productionUrl",
  ): string | undefined => {
    if (project[key] === undefined) return undefined;
    if (typeof project[key] !== "string")
      throw new Error(`${key} must be a string`);
    const url = new URL(project[key]);
    if (!["http:", "https:"].includes(url.protocol))
      throw new Error(`${key} must be HTTP(S)`);
    return url.toString();
  };
  return {
    id: project.id as string,
    name: project.name as string,
    repositoryPath,
    discoveryRoot,
    repositoryIdentity: project.repositoryIdentity as string,
    source: "dynamic",
    previewUrl: optionalUrl("previewUrl"),
    productionUrl: optionalUrl("productionUrl"),
    environment: {},
    commands: commandMap(project.commands),
  };
}

export class ProjectRegistry {
  private readonly staticProjects: ProjectConfig[];
  private dynamicProjects: ProjectConfig[] = [];

  constructor(private readonly config: BridgeConfig) {
    this.staticProjects = config.projects.map((project) => ({
      ...project,
      source: "static",
    }));
    this.load();
  }

  all(): ProjectConfig[] {
    return [...this.staticProjects, ...this.dynamicProjects];
  }

  get(projectId: string, revalidate = true): ProjectConfig | undefined {
    const project = this.all().find((candidate) => candidate.id === projectId);
    if (project && revalidate) this.revalidate(project);
    return project;
  }

  enrolledPaths(): Map<string, string> {
    return new Map(
      this.all().map((project) => [project.repositoryPath, project.id]),
    );
  }

  enroll(
    repository: RepositoryDetails,
    candidates: InternalCandidate[],
  ): ProjectConfig {
    const commands = commandsFromCandidates(candidates);
    const existing = this.dynamicProjects.find(
      (project) => project.repositoryPath === repository.repositoryPath,
    );
    const staticConflict = this.staticProjects.find(
      (project) => project.repositoryPath === repository.repositoryPath,
    );
    if (staticConflict)
      throw new Error(
        "Static projects can only be changed in local configuration",
      );
    const id = existing?.id ?? this.uniqueId(repository.name, repository.id);
    const project: ProjectConfig = {
      id,
      name: repository.name,
      repositoryPath: repository.repositoryPath,
      discoveryRoot: repository.discoveryRoot,
      repositoryIdentity: repository.id,
      source: "dynamic",
      environment: {},
      commands,
    };
    this.revalidate(project);
    this.dynamicProjects = existing
      ? this.dynamicProjects.map((candidate) =>
          candidate.id === id ? project : candidate,
        )
      : [...this.dynamicProjects, project];
    this.persist();
    return project;
  }

  remove(projectId: string): void {
    const project = this.dynamicProjects.find(
      (candidate) => candidate.id === projectId,
    );
    if (!project)
      throw new Error(
        "Only enrolled dynamic projects can be removed from the app",
      );
    this.dynamicProjects = this.dynamicProjects.filter(
      (candidate) => candidate.id !== projectId,
    );
    this.persist();
  }

  revalidate(project: ProjectConfig): void {
    if (project.source !== "dynamic") return;
    if (!project.discoveryRoot)
      throw new Error("Dynamic project has no discovery root");
    const current = realpathSync(project.repositoryPath);
    const root = realpathSync(project.discoveryRoot);
    if (
      current !== project.repositoryPath ||
      root !== project.discoveryRoot ||
      !this.config.discoveryRoots.includes(root) ||
      !contained(root, current)
    )
      throw new Error(
        "Dynamic repository moved or escaped its approved discovery root",
      );
  }

  private uniqueId(name: string, repositoryId: string): string {
    const slug =
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") || "project";
    const occupied = new Set(this.all().map((project) => project.id));
    if (!occupied.has(slug)) return slug;
    const candidate = `${slug}-${repositoryId.slice(-6).toLowerCase()}`;
    if (!occupied.has(candidate)) return candidate;
    return `${slug}-${randomUUID().slice(0, 6)}`;
  }

  private load(): void {
    if (!existsSync(this.config.catalogFile)) return;
    try {
      const value = JSON.parse(
        readFileSync(this.config.catalogFile, "utf8"),
      ) as unknown;
      if (typeof value !== "object" || value === null || Array.isArray(value))
        throw new Error("Catalog must be an object");
      const catalog = value as { version?: unknown; projects?: unknown };
      if (catalog.version !== 1 || !Array.isArray(catalog.projects))
        throw new Error("Unsupported dynamic catalog schema");
      const staticIds = new Set(
        this.staticProjects.map((project) => project.id),
      );
      const staticPaths = new Set(
        this.staticProjects.map((project) => project.repositoryPath),
      );
      this.dynamicProjects = catalog.projects
        .map((project) =>
          parseDynamicProject(project, this.config.discoveryRoots),
        )
        .filter(
          (project) =>
            !staticIds.has(project.id) &&
            !staticPaths.has(project.repositoryPath),
        );
    } catch (error) {
      this.dynamicProjects = [];
      console.warn(
        `Ignoring invalid dynamic project catalog: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private persist(): void {
    const directory = dirname(this.config.catalogFile);
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    chmodSync(directory, 0o700);
    const temporary = `${this.config.catalogFile}.${process.pid}.${randomUUID()}.tmp`;
    const catalog: Catalog = { version: 1, projects: this.dynamicProjects };
    writeFileSync(temporary, `${JSON.stringify(catalog, null, 2)}\n`, {
      mode: 0o600,
    });
    chmodSync(temporary, 0o600);
    renameSync(temporary, this.config.catalogFile);
    chmodSync(this.config.catalogFile, 0o600);
  }
}
