import { readFileSync } from 'node:fs';
import { validateApiOperation } from '../lib/openapi.js';
import { printOutput, type OutputFormat } from '../lib/output.js';
import { getResponseError, requestApi, type AuthMode } from '../lib/request.js';
import { log } from '../lib/ui.js';

interface ApiCommandOptions {
  auth?: AuthMode;
  body?: string;
  bodyFile?: string;
  query?: string[];
  header?: string[];
  token?: string;
  projectKey?: string;
  output?: OutputFormat;
  select?: string;
  quiet?: boolean;
  raw?: boolean;
  validate?: boolean;
}

function parseKeyValue(input: string, label: string): { key: string; value: string } {
  const idx = input.indexOf('=');
  if (idx <= 0) throw new Error(`${label} must use key=value format`);
  const key = input.slice(0, idx).trim();
  const value = input.slice(idx + 1).trim();
  if (!key) throw new Error(`${label} key cannot be empty`);
  return { key, value };
}

function parsePairs(entries: string[] | undefined, label: string): Record<string, string> {
  const parsed: Record<string, string> = {};
  for (const entry of entries ?? []) {
    const { key, value } = parseKeyValue(entry, label);
    parsed[key] = value;
  }
  return parsed;
}

function getBody(options: ApiCommandOptions): unknown {
  if (options.body && options.bodyFile) {
    throw new Error('Use either --body or --body-file, not both.');
  }

  const bodyText = options.bodyFile ? readFileSync(options.bodyFile, 'utf-8') : options.body;
  if (!bodyText) return undefined;

  try {
    return JSON.parse(bodyText) as unknown;
  } catch {
    throw new Error('Request body must be valid JSON.');
  }
}

export async function apiCommand(
  methodInput: string,
  pathInput: string,
  options: ApiCommandOptions
): Promise<void> {
  const method = methodInput.toUpperCase();
  const allowedMethods = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);
  if (!allowedMethods.has(method)) {
    log.error(`Unsupported method "${method}". Use GET, POST, PUT, PATCH, or DELETE.`);
    return;
  }

  if (options.validate !== false) {
    const validation = validateApiOperation(method, pathInput);
    if (!validation.ok) {
      log.error(`${validation.message} Pass --no-validate to bypass.`);
      process.exitCode = 1;
      return;
    }
  }

  let body: unknown;
  try {
    body = getBody(options);
  } catch (err) {
    log.error(err instanceof Error ? err.message : 'Invalid body options');
    return;
  }

  if (body !== undefined && (method === 'GET' || method === 'DELETE')) {
    log.error(`Method ${method} should not be used with --body/--body-file.`);
    return;
  }

  let query: Record<string, string>;
  let headers: Record<string, string>;
  try {
    query = parsePairs(options.query, 'Query');
    headers = parsePairs(options.header, 'Header');
  } catch (err) {
    log.error(err instanceof Error ? err.message : 'Invalid key=value option');
    return;
  }

  try {
    const response = await requestApi({
      method: method as 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
      path: pathInput,
      auth: options.auth ?? 'auto',
      query,
      headers,
      body,
      token: options.token,
      projectKey: options.projectKey,
    });

    if (!options.quiet) log.dim(`${method} ${response.url}`);

    if (!response.ok) {
      log.error(`HTTP ${response.status}: ${getResponseError(response)}`);
      if (response.data !== undefined) {
        printOutput(response.data, { output: 'json', raw: options.raw });
      } else if (response.text) {
        console.error(response.text);
      }
      process.exitCode = 1;
      return;
    }

    if (!options.quiet) log.success(`HTTP ${response.status}`);

    if (response.data !== undefined) {
      printOutput(response.data, {
        output: options.output ?? 'json',
        select: options.select,
        raw: options.raw,
      });
      return;
    }

    if (response.text) {
      console.log(response.text);
    }
  } catch (err) {
    log.error(err instanceof Error ? err.message : 'Request failed');
    process.exitCode = 1;
  }
}
