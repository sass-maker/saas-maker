import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  submitFeedbackToProject,
  submitFeedbackToUrl,
} from '../packages/widgets/feedback-widget/src/ingestion';
import { createSubmissionIntent } from '../packages/widgets/feedback-widget/src/submission-intent';
import type { FeedbackSubmission } from '../packages/widgets/feedback-widget/src/types';

const message: FeedbackSubmission = {
  type: 'feedback',
  title: 'Synthetic retry',
  description: 'One intended submission',
};

afterEach(() => vi.unstubAllGlobals());

describe('feedback submission intent', () => {
  it('preserves the existing payload contract of product-owned ingestion endpoints', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 201 }));
    vi.stubGlobal('fetch', fetch);
    await submitFeedbackToUrl('https://product.example/feedback', {
      ...message,
      submissionId: crypto.randomUUID(),
    });
    expect(JSON.parse(fetch.mock.calls[0][1].body.get('feedback'))).toEqual(message);
  });
  it('keeps a retry identity until success while edits and a new submission get new identities', () => {
    const intent = createSubmissionIntent();
    const first = intent.identify({ ...message });
    expect(first).toMatch(/^[0-9a-f-]{36}$/);
    expect(intent.identify({ ...message })).toBe(first);
    const edited = intent.identify({ ...message, description: 'A second intent' });
    expect(edited).not.toBe(first);
    expect(intent.identify({ ...message, description: 'A second intent' })).toBe(edited);
    intent.reset();
    expect(intent.identify({ ...message, description: 'A second intent' })).not.toBe(edited);
  });

  it('preserves an attached file on retry and distinguishes a replacement without mutating input', () => {
    const intent = createSubmissionIntent();
    const screenshot = new File(['synthetic'], 'test.png', { type: 'image/png' });
    const payload = { ...message, screenshot };
    const id = intent.identify(payload);
    expect(intent.identify({ ...payload })).toBe(id);
    expect(payload).not.toHaveProperty('submissionId');
    expect(intent.identify({ ...payload, submissionId: 'caller-value' })).toBe(id);
    expect(
      intent.identify({ ...message, screenshot: new File(['synthetic'], 'new.png') })
    ).not.toBe(id);
  });

  it('sends the same optional API identity when a lost response is retried', async () => {
    const fetch = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Synthetic lost response'))
      .mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', fetch);
    const intent = createSubmissionIntent();
    const payload = { ...message, submissionId: intent.identify(message) };
    await expect(submitFeedbackToProject('pk_synthetic', payload)).rejects.toThrow('lost response');
    await expect(submitFeedbackToProject('pk_synthetic', payload)).resolves.toBeUndefined();
    const bodies = fetch.mock.calls.map(([, init]) => JSON.parse(init.body.get('feedback')));
    expect(bodies[0].submission_id).toBe(payload.submissionId);
    expect(bodies[1]).toEqual(bodies[0]);
    expect(bodies[0].source).toBe('widget');
  });
});
