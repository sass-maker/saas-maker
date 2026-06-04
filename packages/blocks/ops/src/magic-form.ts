export type MagicFormFieldType =
  | 'text'
  | 'email'
  | 'url'
  | 'number'
  | 'select'
  | 'multiselect'
  | 'textarea'
  | 'rating'
  | 'boolean';

export interface MagicFormField {
  id: string;
  type: MagicFormFieldType;
  label: string;
  required?: boolean;
  options?: string[];
  min?: number;
  max?: number;
}

export interface MagicFormSchema {
  version: number;
  title: string;
  description: string;
  fields: MagicFormField[];
}

export interface MagicFormResponse {
  id: string;
  formId: string;
  schemaVersion: number;
  answers: Record<string, unknown>;
  analytics: {
    project_id: string;
    form_id: string;
    schema_version: number;
    answered_fields: number;
    missing_required: string[];
  };
}

export const MAGIC_FORM_TEMPLATES: Record<string, MagicFormSchema> = {
  beta_signup: {
    version: 1,
    title: 'Beta signup',
    description: 'Capture qualified early users for a private beta.',
    fields: [
      { id: 'email', type: 'email', label: 'Email', required: true },
      { id: 'role', type: 'text', label: 'Role or team', required: true },
      { id: 'use_case', type: 'textarea', label: 'What are you trying to do?', required: true },
      { id: 'platform', type: 'select', label: 'Preferred platform', options: ['Web', 'iOS', 'Android', 'Desktop'] },
    ],
  },
  product_feedback: {
    version: 1,
    title: 'Product feedback',
    description: 'Collect structured feedback without creating a custom widget.',
    fields: [
      { id: 'email', type: 'email', label: 'Email', required: true },
      { id: 'sentiment', type: 'select', label: 'How did it feel?', required: true, options: ['Great', 'Confusing', 'Broken'] },
      { id: 'message', type: 'textarea', label: 'What happened?', required: true },
      { id: 'priority', type: 'rating', label: 'How important is this?', min: 1, max: 5 },
    ],
  },
};

const FIELD_TYPE_HINTS: Array<[RegExp, MagicFormFieldType]> = [
  [/email|contact/i, 'email'],
  [/url|link|website|portfolio|twitter|github/i, 'url'],
  [/score|rating|priority|importance|stars/i, 'rating'],
  [/count|number|amount|budget|size/i, 'number'],
  [/message|note|reason|use case|describe|description/i, 'textarea'],
];

export function generateMagicFormSchema(input: {
  useCase: string;
  fields?: string[];
  templateId?: keyof typeof MAGIC_FORM_TEMPLATES;
}): MagicFormSchema {
  const base = input.templateId ? MAGIC_FORM_TEMPLATES[input.templateId] : undefined;
  const title = titleCase(input.useCase || base?.title || 'Custom form');
  const requestedFields = input.fields?.length
    ? input.fields
    : inferFieldsFromUseCase(input.useCase || base?.description || '');
  const fields = requestedFields.map((field, index) => buildField(field, index));

  return {
    version: 1,
    title,
    description: `Generated schema for ${title}.`,
    fields: limitFields(dedupeFields(base ? [...base.fields, ...fields] : fields)),
  };
}

export function validateMagicFormSchema(schema: MagicFormSchema): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  if (!schema.title.trim()) errors.push('title is required');
  if (!Number.isInteger(schema.version) || schema.version < 1) errors.push('version must be a positive integer');
  if (!schema.fields.length) errors.push('at least one field is required');
  if (schema.fields.length > 20) errors.push('schema can contain at most 20 fields');

  for (const field of schema.fields) {
    if (!/^[a-z][a-z0-9_]*$/.test(field.id)) errors.push(`field ${field.label} has an invalid id`);
    if (ids.has(field.id)) errors.push(`field id ${field.id} is duplicated`);
    ids.add(field.id);
    if (!field.label.trim()) errors.push(`field ${field.id} label is required`);
    if ((field.type === 'select' || field.type === 'multiselect') && !field.options?.length) {
      errors.push(`field ${field.id} requires options`);
    }
  }

  return errors;
}

export function captureMagicFormResponse(input: {
  projectId: string;
  formId: string;
  schema: MagicFormSchema;
  answers: Record<string, unknown>;
}): MagicFormResponse {
  const missing = input.schema.fields
    .filter((field) => field.required && isEmptyAnswer(input.answers[field.id]))
    .map((field) => field.id);

  if (missing.length) {
    throw new Error(`Missing required answers: ${missing.join(', ')}`);
  }

  return {
    id: stableResponseId(input.formId, input.answers),
    formId: input.formId,
    schemaVersion: input.schema.version,
    answers: Object.fromEntries(input.schema.fields.map((field) => [field.id, input.answers[field.id] ?? null])),
    analytics: {
      project_id: input.projectId,
      form_id: input.formId,
      schema_version: input.schema.version,
      answered_fields: Object.values(input.answers).filter((answer) => !isEmptyAnswer(answer)).length,
      missing_required: missing,
    },
  };
}

export function buildMagicFormEmbedExample(schema: MagicFormSchema, formId = 'mf_beta_signup'): string {
  return [
    '<MagicForm',
    `  formId="${formId}"`,
    '  projectId="pk_project_key"',
    '  apiBaseUrl="https://api.sassmaker.com"',
    `  schemaVersion={${schema.version}}`,
    '  onSuccess={(response) => console.log(response.id)}',
    '/>',
  ].join('\n');
}

function buildField(label: string, index: number): MagicFormField {
  const type = FIELD_TYPE_HINTS.find(([pattern]) => pattern.test(label))?.[1] ?? 'text';
  const id = slugField(label) || `field_${index + 1}`;
  const required = /email|name|use case|message|role/i.test(label);
  const field: MagicFormField = { id, type, label: sentenceCase(label), required };
  if (type === 'rating') {
    field.min = 1;
    field.max = 5;
  }
  return field;
}

function inferFieldsFromUseCase(useCase: string): string[] {
  const lower = useCase.toLowerCase();
  if (lower.includes('beta')) return ['email', 'role', 'use case', 'platform'];
  if (lower.includes('feedback')) return ['email', 'sentiment', 'message', 'priority'];
  if (lower.includes('application')) return ['name', 'email', 'portfolio link', 'why are you a fit'];
  return ['email', 'message'];
}

function dedupeFields(fields: MagicFormField[]) {
  const seen = new Set<string>();
  return fields.filter((field) => {
    if (seen.has(field.id)) return false;
    seen.add(field.id);
    return true;
  });
}

function limitFields(fields: MagicFormField[]) {
  return fields.slice(0, 20);
}

function stableResponseId(formId: string, answers: Record<string, unknown>) {
  const serialized = JSON.stringify(Object.keys(answers).sort().map((key) => [key, answers[key]]));
  let hash = 0;
  for (const char of `${formId}:${serialized}`) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return `mfr_${hash.toString(16).padStart(8, '0')}`;
}

function slugField(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function titleCase(input: string) {
  return sentenceCase(input).replace(/\b\w/g, (char) => char.toUpperCase());
}

function sentenceCase(input: string) {
  const cleaned = input.replace(/[_-]+/g, ' ').trim();
  return cleaned ? cleaned.charAt(0).toUpperCase() + cleaned.slice(1) : cleaned;
}

function isEmptyAnswer(answer: unknown) {
  return answer === undefined || answer === null || answer === '';
}
