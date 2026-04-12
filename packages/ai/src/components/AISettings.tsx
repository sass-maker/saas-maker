import React, { useState, useRef, useEffect } from 'react';
import type { AIConfig } from '../types';
import { useModelDiscovery } from '../hooks/useModelDiscovery';

export interface AISettingsClassNames {
  container?: string;
  field?: string;
  label?: string;
  input?: string;
  button?: string;
  dropdown?: string;
  dropdownItem?: string;
  saveButton?: string;
  error?: string;
  hint?: string;
  modelRow?: string;
}

export interface AISettingsProps {
  config: AIConfig;
  onChange: (config: AIConfig) => void;
  onSave?: () => void;
  /** Server-side proxy URL for model discovery. */
  modelsApiUrl?: string;
  labels?: {
    endpointUrl?: string;
    apiKey?: string;
    model?: string;
    save?: string;
    fetchModels?: string;
    title?: string;
    subtitle?: string;
  };
  placeholders?: {
    endpointUrl?: string;
    apiKey?: string;
    model?: string;
  };
  /** Pass Tailwind or CSS classes per element. */
  classNames?: AISettingsClassNames;
  /** Hide the save button (useful when parent handles saving). */
  hideSave?: boolean;
}

export function AISettings({
  config,
  onChange,
  onSave,
  modelsApiUrl,
  labels = {},
  placeholders = {},
  classNames: cn = {},
  hideSave = false,
}: AISettingsProps) {
  const { models, loading, error, discover } = useModelDiscovery({ modelsApiUrl });
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const comboboxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (comboboxRef.current && !comboboxRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const filteredModels = config.model
    ? models.filter((m) => m.toLowerCase().includes(config.model.toLowerCase()))
    : models;

  const handleSave = () => {
    onSave?.();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className={cn.container} data-smw-ai-settings>
      {/* Endpoint URL */}
      <div className={cn.field} data-smw-ai-field>
        <label className={cn.label} data-smw-ai-label>
          {labels.endpointUrl ?? 'Endpoint URL'}
        </label>
        <input
          type="text"
          value={config.endpointUrl}
          onChange={(e) => onChange({ ...config, endpointUrl: e.target.value })}
          placeholder={placeholders.endpointUrl ?? 'https://api.openai.com/v1'}
          className={cn.input}
          data-smw-ai-input
        />
      </div>

      {/* API Key */}
      <div className={cn.field} data-smw-ai-field>
        <label className={cn.label} data-smw-ai-label>
          {labels.apiKey ?? 'API Key'}
        </label>
        <input
          type="password"
          value={config.apiKey}
          onChange={(e) => onChange({ ...config, apiKey: e.target.value })}
          placeholder={placeholders.apiKey ?? 'sk-...'}
          className={cn.input}
          data-smw-ai-input
        />
      </div>

      {/* Model (combobox) */}
      <div className={cn.field} data-smw-ai-field>
        <label className={cn.label} data-smw-ai-label>
          {labels.model ?? 'Model'}
        </label>
        <div style={{ position: 'relative' }} ref={comboboxRef}>
          <div className={cn.modelRow} style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="text"
              value={config.model}
              onChange={(e) => {
                onChange({ ...config, model: e.target.value });
                if (models.length > 0) setDropdownOpen(true);
              }}
              onFocus={() => {
                if (models.length > 0) setDropdownOpen(true);
              }}
              placeholder={placeholders.model ?? 'Enter model or fetch available'}
              className={cn.input}
              style={{ flex: 1 }}
              data-smw-ai-input
            />
            <button
              type="button"
              onClick={() => discover(config.endpointUrl, config.apiKey)}
              disabled={!config.endpointUrl || loading}
              className={cn.button}
              data-smw-ai-fetch-btn
            >
              {loading ? 'Loading...' : (labels.fetchModels ?? 'Fetch Models')}
            </button>
          </div>

          {dropdownOpen && filteredModels.length > 0 && (
            <div
              className={cn.dropdown}
              style={{
                position: 'absolute',
                zIndex: 50,
                marginTop: '0.25rem',
                width: '100%',
                maxHeight: '12rem',
                overflowY: 'auto',
              }}
              data-smw-ai-dropdown
            >
              {filteredModels.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    onChange({ ...config, model: m });
                    setDropdownOpen(false);
                  }}
                  className={cn.dropdownItem}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    padding: '0.5rem 0.75rem',
                    cursor: 'pointer',
                    border: 'none',
                    background: 'none',
                    font: 'inherit',
                  }}
                  data-smw-ai-dropdown-item
                >
                  {m}
                </button>
              ))}
            </div>
          )}
        </div>
        {error && (
          <p className={cn.error} style={{ fontSize: '0.75rem', marginTop: '0.375rem' }} data-smw-ai-error>
            {error}
          </p>
        )}
        {models.length > 0 && !error && (
          <p className={cn.hint} style={{ fontSize: '0.75rem', marginTop: '0.375rem' }} data-smw-ai-hint>
            {models.length} model{models.length !== 1 ? 's' : ''} available
          </p>
        )}
      </div>

      {/* Save */}
      {!hideSave && onSave && (
        <button
          type="button"
          onClick={handleSave}
          className={cn.saveButton}
          data-smw-ai-save-btn
        >
          {saved ? 'Saved' : (labels.save ?? 'Save Settings')}
        </button>
      )}
    </div>
  );
}
