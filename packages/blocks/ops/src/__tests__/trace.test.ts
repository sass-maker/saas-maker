import { describe, it, expect, vi } from 'vitest';
import { trace } from '../trace.js';
import { FoundryError } from '../error.js';

describe('Foundry Ops - Trace', () => {
  it('should return result and log timing on success', async () => {
    const consoleSpy = vi.spyOn(console, 'info');
    const result = await trace('test-op', async () => 'success');
    
    expect(result).toBe('success');
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('test-op completed in'));
  });

  it('should wrap generic errors in FoundryError', async () => {
    const consoleSpy = vi.spyOn(console, 'error');
    
    await expect(trace('fail-op', async () => {
      throw new Error('raw error');
    })).rejects.toThrow(FoundryError);

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('fail-op failed after'));
  });

  it('should include project metadata when wrapping generic errors', async () => {
    expect.assertions(3);

    try {
      await trace('project-op', async () => {
        throw new Error('raw error');
      }, { project: 'saasmaker-api', silent: true });
    } catch (err: any) {
      expect(err).toBeInstanceOf(FoundryError);
      expect(err.context.project).toBe('saasmaker-api');
      expect(err.context.traceName).toBe('project-op');
    }
  });

  it('should enrich existing FoundryError with trace context', async () => {
    expect.assertions(5);

    try {
      await trace('nested-op', async () => {
        throw new FoundryError('known failure', { code: 'FAIL_CODE' });
      }, { project: 'saasmaker-api', silent: true });
    } catch (err: any) {
      expect(err).toBeInstanceOf(FoundryError);
      expect(err.code).toBe('FAIL_CODE');
      expect(err.context.project).toBe('saasmaker-api');
      expect(err.context.traceName).toBe('nested-op');
      expect(err.context.traceDuration).toBeGreaterThan(0);
    }
  });
});
