// Strict publication schema; unknown adoption stays absent, never a default.
const fail = (path) => {
  throw new Error(`Invalid design policy: ${path}`);
};
const text = (value, path) => {
  if (typeof value !== 'string' || !value.trim()) fail(path);
};
const boolean = (value, path) => {
  if (typeof value !== 'boolean') fail(path);
};
const number =
  (min, max = Infinity, integer = false) =>
  (value, path) => {
    if (
      typeof value !== 'number' ||
      !Number.isFinite(value) ||
      value < min ||
      value > max ||
      (integer && !Number.isInteger(value))
    )
      fail(path);
  };
const oneOf =
  (...values) =>
  (value, path) => {
    if (!values.includes(value)) fail(path);
  };
const date = (value, path) => {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(Date.parse(value)) ||
    new Date(value).toISOString().slice(0, 10) !== value
  )
    fail(path);
};
const tag = (value, path) => {
  if (typeof value !== 'string' || !/^v\d+\.\d+\.\d+$/.test(value)) fail(path);
};
const list = (item) => (value, path) => {
  if (!Array.isArray(value) || value.length === 0) fail(path);
  value.forEach((entry, index) => item(entry, `${path}[${index}]`));
};
const object =
  (fields, optional = false) =>
  (value, path) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) fail(path);
    for (const key of Object.keys(value)) {
      if (!Object.hasOwn(fields, key)) fail(`${path}.${key}`);
    }
    for (const [key, validate] of Object.entries(fields)) {
      if (optional && !Object.hasOwn(value, key)) continue;
      validate(value[key], `${path}.${key}`);
    }
  };
const strings = list(text);
const common = {
  schemaVersion: oneOf(1),
  decidedAt: date,
  source: object({ quote: text, date }),
};
const loading = {
  placeholderWithinMs: number(0),
  maxDataArrivalCls: number(0, 1),
  placeholder: text,
  forbidden: strings,
  requiredStates: strings,
  revisits: text,
};

export const designPolicySchema = {
  uiLibrary: object({
    ...common,
    repository: text,
    visibility: oneOf('public'),
    npmPublish: oneOf(false),
    currentTag: tag,
    web: object({
      installMethod: text,
      packages: list(object({ name: text, path: text, install: text })),
      consumerGuide: text,
      notes: strings,
    }),
    native: object({ name: text, url: text, manifest: text, install: text }),
    templates: object({ landing: strings, app: strings, heroLayouts: strings }),
    footer: object({ react: text, frameworkFree: text, replaces: text, contracts: strings }),
  }),
  designDefaults: object({
    ...common,
    mode: oneOf('dark'),
    theme: text,
    continuity: object({ required: boolean, attributes: strings, defect: text }),
    quietDesign: strings,
    lowercase: strings,
    tasteCalls: object({
      askOwner: boolean,
      renderedOptions: object({ min: oneOf(2), max: oneOf(4) }),
    }),
  }),
  loadingStates: object({
    ...common,
    ...loading,
    primitives: list(object({ name: text, import: text, use: text })),
  }),
  releaseGate: object({
    ...common,
    performanceContract: text,
    execution: object({
      phases: strings,
      allChecksMustPass: boolean,
      noBaselineRegression: boolean,
      failureAction: text,
      scorecard: strings,
    }),
    speed: object({
      device: oneOf('mobile'),
      runs: oneOf(3),
      aggregation: oneOf('median'),
      reportSpread: boolean,
      pages: object({ home: boolean, keyInnerPages: number(0, Infinity, true) }),
      lighthouse: object({
        performance: number(0, 100),
        accessibility: number(0, 100),
        bestPractices: number(0, 100),
        seo: number(0, 100),
      }),
      maxLcpSeconds: number(0),
      maxCls: number(0, 1),
      maxTbtMs: number(0),
    }),
    seo: object({
      h1Count: number(1, 1, true),
      maxTitleChars: number(1, Infinity, true),
      maxDescriptionChars: number(1, Infinity, true),
      checks: strings,
    }),
    geo: object({ crawlers: strings, checks: strings }),
    fleetContracts: object({ checks: strings, minimumRouteProbes: number(1, Infinity, true) }),
    ux: object({ viewportWidths: list(number(1, Infinity, true)), checks: strings }),
    designTaste: object({ checks: strings, screenshots: text }),
    loadingStates: object({ ...loading, network: text, cpuSlowdown: number(1) }),
    continuityTheme: object({
      attributes: strings,
      defaultMode: oneOf('dark'),
      theme: text,
      ownerPick: text,
    }),
  }),
};

const mode = oneOf('light', 'dark', null);
const ui = object(
  {
    landing: object({ library: boolean, version: text, template: text, mode }, true),
    app: object({ library: boolean, version: text, mode }, true),
    native: object({ saasMakerUI: boolean, version: text }, true),
    continuity: object(
      {
        score: (value, path) => {
          if (value !== null) number(0, 3, true)(value, path);
        },
        notes: text,
        checkedAt: date,
      },
      true
    ),
  },
  true
);

export function validateProjectUi(value, projectId) {
  if (value !== undefined) ui(value, `projects.${projectId}.systems.ui`);
}

export function validateDesignPolicies(systems, projects) {
  for (const [key, validate] of Object.entries(designPolicySchema)) {
    validate(systems?.[key], `systems.${key}`);
  }
  for (const project of projects) validateProjectUi(project.systems?.ui, project.id);
}
