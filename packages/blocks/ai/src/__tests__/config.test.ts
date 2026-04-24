import { describe, it, expect, beforeEach } from 'vitest';
import { getAIConfig, saveAIConfig } from '../config';

describe('config', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('getAIConfig', () => {
    it('returns default empty config when storage is empty', () => {
      expect(getAIConfig()).toEqual({ endpointUrl: '', apiKey: '', model: '' });
    });

    it('reads config from localStorage with custom storage key', () => {
      localStorage.setItem(
        'my-key',
        JSON.stringify({ endpointUrl: 'https://api.openai.com/v1', apiKey: 'sk-123', model: 'gpt-4' }),
      );
      expect(getAIConfig('my-key')).toEqual({
        endpointUrl: 'https://api.openai.com/v1',
        apiKey: 'sk-123',
        model: 'gpt-4',
      });
    });

    it('normalizes trailing slashes and whitespace on read', () => {
      localStorage.setItem(
        'ai-config',
        JSON.stringify({ endpointUrl: '  https://api.openai.com/v1///  ', apiKey: '  sk-123  ', model: '  gpt-4  ' }),
      );
      expect(getAIConfig()).toEqual({
        endpointUrl: 'https://api.openai.com/v1',
        apiKey: 'sk-123',
        model: 'gpt-4',
      });
    });

    it('returns default on corrupt JSON', () => {
      localStorage.setItem('ai-config', 'not-json');
      expect(getAIConfig()).toEqual({ endpointUrl: '', apiKey: '', model: '' });
    });
  });

  describe('saveAIConfig', () => {
    it('writes to localStorage with default key', () => {
      saveAIConfig({ endpointUrl: 'https://api.openai.com/v1', apiKey: 'sk-1', model: 'gpt-4' });
      expect(JSON.parse(localStorage.getItem('ai-config')!)).toEqual({
        endpointUrl: 'https://api.openai.com/v1',
        apiKey: 'sk-1',
        model: 'gpt-4',
      });
    });

    it('writes to custom storage key', () => {
      saveAIConfig({ endpointUrl: 'url', apiKey: 'k', model: 'm' }, 'custom-key');
      expect(localStorage.getItem('ai-config')).toBeNull();
      expect(localStorage.getItem('custom-key')).toBeTruthy();
    });

    it('normalizes on save', () => {
      saveAIConfig({ endpointUrl: '  https://api.openai.com/v1/  ', apiKey: ' k ', model: ' m ' });
      expect(JSON.parse(localStorage.getItem('ai-config')!)).toEqual({
        endpointUrl: 'https://api.openai.com/v1',
        apiKey: 'k',
        model: 'm',
      });
    });
  });
});
