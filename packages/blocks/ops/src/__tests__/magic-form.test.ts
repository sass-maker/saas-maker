import { describe, expect, it } from 'vitest';
import {
  buildMagicFormEmbedExample,
  captureMagicFormResponse,
  generateMagicFormSchema,
  validateMagicFormSchema,
} from '../magic-form.js';

describe('Magic Form prototype', () => {
  it('generates a valid schema from a beta signup use case', () => {
    const schema = generateMagicFormSchema({
      useCase: 'private beta signup for a mobile app',
      fields: ['email', 'platform', 'use case'],
    });

    expect(validateMagicFormSchema(schema)).toEqual([]);
    expect(schema.fields.map((field) => field.id)).toContain('email');
    expect(schema.fields.find((field) => field.id === 'email')?.type).toBe('email');
  });

  it('captures versioned responses with analytics metadata', () => {
    const schema = generateMagicFormSchema({
      useCase: 'product feedback',
      templateId: 'product_feedback',
    });

    const response = captureMagicFormResponse({
      projectId: 'reader',
      formId: 'mf_reader_feedback',
      schema,
      answers: {
        email: 'reader@example.com',
        sentiment: 'Confusing',
        message: 'Import asks for too many choices up front.',
      },
    });

    expect(response.schemaVersion).toBe(1);
    expect(response.analytics).toMatchObject({
      project_id: 'reader',
      form_id: 'mf_reader_feedback',
      schema_version: 1,
      missing_required: [],
    });
  });

  it('produces a widget-style embed example', () => {
    const schema = generateMagicFormSchema({ useCase: 'contact form' });

    expect(buildMagicFormEmbedExample(schema)).toContain('<MagicForm');
    expect(buildMagicFormEmbedExample(schema)).toContain('projectId="pk_project_key"');
  });
});
