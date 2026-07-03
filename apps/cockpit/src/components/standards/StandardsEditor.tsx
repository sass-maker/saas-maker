'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Save, AlertCircle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Types ───────────────────────────────────────────────────────────────────

type EslintSeverity = 'error' | 'warn' | 'off';
type TrailingComma = 'none' | 'es5' | 'all';
type TabWidth = 2 | 4;
type PrintWidth = 80 | 100 | 120;

interface EslintRules {
  'react-hooks/set-state-in-effect': EslintSeverity;
  'react-hooks/exhaustive-deps': EslintSeverity;
  'react-refresh/only-export-components': EslintSeverity;
  '@typescript-eslint/no-unused-vars': EslintSeverity;
  '@typescript-eslint/no-explicit-any': EslintSeverity;
  'no-console': EslintSeverity;
  'no-debugger': EslintSeverity;
}

interface TypeScriptOptions {
  strict: boolean;
  skipLibCheck: boolean;
  noUnusedLocals: boolean;
  noUnusedParameters: boolean;
  exactOptionalPropertyTypes: boolean;
  noImplicitReturns: boolean;
}

interface PrettierOptions {
  semi: boolean;
  singleQuote: boolean;
  tabWidth: TabWidth;
  trailingComma: TrailingComma;
  printWidth: PrintWidth;
}

interface ProjectStandards {
  eslint: EslintRules;
  typescript: TypeScriptOptions;
  prettier: PrettierOptions;
}

export interface StandardsConfig {
  nextjs?: ProjectStandards;
  vite?: ProjectStandards;
  node?: ProjectStandards;
}

// ─── Defaults ────────────────────────────────────────────────────────────────

const defaultEslint: EslintRules = {
  'react-hooks/set-state-in-effect': 'error',
  'react-hooks/exhaustive-deps': 'warn',
  'react-refresh/only-export-components': 'warn',
  '@typescript-eslint/no-unused-vars': 'error',
  '@typescript-eslint/no-explicit-any': 'warn',
  'no-console': 'warn',
  'no-debugger': 'error',
};

const defaultTypescript: TypeScriptOptions = {
  strict: true,
  skipLibCheck: true,
  noUnusedLocals: false,
  noUnusedParameters: false,
  exactOptionalPropertyTypes: false,
  noImplicitReturns: false,
};

const defaultPrettier: PrettierOptions = {
  semi: true,
  singleQuote: false,
  tabWidth: 2,
  trailingComma: 'es5',
  printWidth: 80,
};

const defaultStandards: ProjectStandards = {
  eslint: defaultEslint,
  typescript: defaultTypescript,
  prettier: defaultPrettier,
};

function makeDefaultConfig(): StandardsConfig {
  return {
    nextjs: {
      ...defaultStandards,
      eslint: { ...defaultEslint },
      typescript: { ...defaultTypescript },
      prettier: { ...defaultPrettier },
    },
    vite: {
      ...defaultStandards,
      eslint: { ...defaultEslint },
      typescript: { ...defaultTypescript },
      prettier: { ...defaultPrettier },
    },
    node: {
      ...defaultStandards,
      eslint: { ...defaultEslint },
      typescript: { ...defaultTypescript },
      prettier: { ...defaultPrettier },
    },
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ESLINT_RULES: Array<{ key: keyof EslintRules; label: string }> = [
  { key: 'react-hooks/set-state-in-effect', label: 'react-hooks/set-state-in-effect' },
  { key: 'react-hooks/exhaustive-deps', label: 'react-hooks/exhaustive-deps' },
  { key: 'react-refresh/only-export-components', label: 'react-refresh/only-export-components' },
  { key: '@typescript-eslint/no-unused-vars', label: '@typescript-eslint/no-unused-vars' },
  { key: '@typescript-eslint/no-explicit-any', label: '@typescript-eslint/no-explicit-any' },
  { key: 'no-console', label: 'no-console' },
  { key: 'no-debugger', label: 'no-debugger' },
];

const TYPESCRIPT_OPTIONS: Array<{
  key: keyof TypeScriptOptions;
  label: string;
  description: string;
}> = [
  { key: 'strict', label: 'strict', description: 'Enable all strict type-checking options' },
  {
    key: 'skipLibCheck',
    label: 'skipLibCheck',
    description: 'Skip type checking of declaration files',
  },
  { key: 'noUnusedLocals', label: 'noUnusedLocals', description: 'Report errors on unused locals' },
  {
    key: 'noUnusedParameters',
    label: 'noUnusedParameters',
    description: 'Report errors on unused parameters',
  },
  {
    key: 'exactOptionalPropertyTypes',
    label: 'exactOptionalPropertyTypes',
    description: 'Differentiate between undefined and missing optional properties',
  },
  {
    key: 'noImplicitReturns',
    label: 'noImplicitReturns',
    description: 'Require all code paths in a function to return a value',
  },
];

const SEVERITY_OPTIONS: Array<{ value: EslintSeverity; label: string }> = [
  { value: 'error', label: 'Error' },
  { value: 'warn', label: 'Warn' },
  { value: 'off', label: 'Off' },
];

async function getToken(): Promise<string> {
  const res = await fetch('/api/token');
  if (!res.ok) throw new Error('Failed to get auth token');
  const data = await res.json();
  return data.token;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SeverityToggle({
  value,
  onChange,
}: {
  value: EslintSeverity;
  onChange: (v: EslintSeverity) => void;
}) {
  return (
    <div className="inline-flex rounded-md border overflow-hidden text-xs font-medium">
      {SEVERITY_OPTIONS.map((opt, i) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            'px-2.5 py-1 transition-colors',
            i > 0 && 'border-l',
            value === opt.value
              ? opt.value === 'error'
                ? 'bg-destructive text-destructive-foreground'
                : opt.value === 'warn'
                  ? 'bg-yellow-500 text-white dark:bg-yellow-600'
                  : 'bg-muted text-muted-foreground'
              : 'bg-background text-muted-foreground hover:bg-muted/60'
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function EslintSection({
  rules,
  onChange,
}: {
  rules: EslintRules;
  onChange: (rules: EslintRules) => void;
}) {
  return (
    <Card>
      <CardHeader className="border-b pb-4">
        <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          ESLint Rules
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4 divide-y">
        {ESLINT_RULES.map(({ key, label }) => (
          <div
            key={key}
            className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
          >
            <code className="text-sm font-mono text-foreground">{label}</code>
            <SeverityToggle value={rules[key]} onChange={(v) => onChange({ ...rules, [key]: v })} />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function TypeScriptSection({
  options,
  onChange,
}: {
  options: TypeScriptOptions;
  onChange: (opts: TypeScriptOptions) => void;
}) {
  return (
    <Card>
      <CardHeader className="border-b pb-4">
        <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          TypeScript
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4 divide-y">
        {TYPESCRIPT_OPTIONS.map(({ key, label, description }) => (
          <div
            key={key}
            className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
          >
            <div className="min-w-0">
              <p className="text-sm font-mono text-foreground">{label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
            </div>
            <Switch
              checked={options[key]}
              onCheckedChange={(checked) => onChange({ ...options, [key]: checked })}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function PrettierSection({
  options,
  onChange,
}: {
  options: PrettierOptions;
  onChange: (opts: PrettierOptions) => void;
}) {
  return (
    <Card>
      <CardHeader className="border-b pb-4">
        <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Prettier
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4 space-y-5">
        {/* semi */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <Label className="font-mono text-sm">semi</Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Print semicolons at the ends of statements
            </p>
          </div>
          <Switch
            checked={options.semi}
            onCheckedChange={(checked) => onChange({ ...options, semi: checked })}
          />
        </div>

        {/* singleQuote */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <Label className="font-mono text-sm">singleQuote</Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Use single quotes instead of double quotes
            </p>
          </div>
          <Switch
            checked={options.singleQuote}
            onCheckedChange={(checked) => onChange({ ...options, singleQuote: checked })}
          />
        </div>

        {/* tabWidth */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <Label className="font-mono text-sm">tabWidth</Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Specify the number of spaces per indentation level
            </p>
          </div>
          <div className="inline-flex rounded-md border overflow-hidden text-xs font-medium">
            {([2, 4] as TabWidth[]).map((w, i) => (
              <button
                key={w}
                type="button"
                onClick={() => onChange({ ...options, tabWidth: w })}
                className={cn(
                  'px-3 py-1.5 transition-colors',
                  i > 0 && 'border-l',
                  options.tabWidth === w
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-background text-muted-foreground hover:bg-muted/60'
                )}
              >
                {w}
              </button>
            ))}
          </div>
        </div>

        {/* trailingComma */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <Label className="font-mono text-sm">trailingComma</Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Print trailing commas wherever possible
            </p>
          </div>
          <Select
            value={options.trailingComma}
            onValueChange={(v) => onChange({ ...options, trailingComma: v as TrailingComma })}
          >
            <SelectTrigger size="sm" className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">none</SelectItem>
              <SelectItem value="es5">es5</SelectItem>
              <SelectItem value="all">all</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* printWidth */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <Label className="font-mono text-sm">printWidth</Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Specify the line length that the printer will wrap on
            </p>
          </div>
          <div className="inline-flex rounded-md border overflow-hidden text-xs font-medium">
            {([80, 100, 120] as PrintWidth[]).map((w, i) => (
              <button
                key={w}
                type="button"
                onClick={() => onChange({ ...options, printWidth: w })}
                className={cn(
                  'px-3 py-1.5 transition-colors',
                  i > 0 && 'border-l',
                  options.printWidth === w
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-background text-muted-foreground hover:bg-muted/60'
                )}
              >
                {w}
              </button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Tab panel ────────────────────────────────────────────────────────────────

function ProjectTab({
  type: _type,
  standards,
  onChange,
  onSave,
  saving,
  saveResult,
}: {
  type: 'nextjs' | 'vite' | 'node';
  standards: ProjectStandards;
  onChange: (s: ProjectStandards) => void;
  onSave: () => void;
  saving: boolean;
  saveResult: { ok: boolean; message: string } | null;
}) {
  return (
    <div className="space-y-4">
      <EslintSection
        rules={standards.eslint}
        onChange={(eslint) => onChange({ ...standards, eslint })}
      />
      <TypeScriptSection
        options={standards.typescript}
        onChange={(typescript) => onChange({ ...standards, typescript })}
      />
      <PrettierSection
        options={standards.prettier}
        onChange={(prettier) => onChange({ ...standards, prettier })}
      />

      {/* Save footer */}
      <div className="flex items-center justify-between gap-4 pt-2">
        {saveResult ? (
          <div
            className={cn(
              'flex items-center gap-2 text-sm',
              saveResult.ok ? 'text-green-600 dark:text-green-400' : 'text-destructive'
            )}
          >
            {saveResult.ok ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0" />
            )}
            {saveResult.message}
          </div>
        ) : (
          <span />
        )}
        <Button onClick={onSave} disabled={saving} className="gap-2">
          <Save className="h-4 w-4" />
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface StandardsEditorProps {
  initialConfig: StandardsConfig | null;
  fetchError: string | null;
}

type TabType = 'nextjs' | 'vite' | 'node';

export function StandardsEditor({ initialConfig, fetchError }: StandardsEditorProps) {
  const defaults = makeDefaultConfig();

  const [config, setConfig] = useState<Required<StandardsConfig>>({
    nextjs: initialConfig?.nextjs ?? defaults.nextjs!,
    vite: initialConfig?.vite ?? defaults.vite!,
    node: initialConfig?.node ?? defaults.node!,
  });

  const [saving, setSaving] = useState<TabType | null>(null);
  const [saveResults, setSaveResults] = useState<
    Partial<Record<TabType, { ok: boolean; message: string }>>
  >({});

  async function handleSave(type: TabType) {
    setSaving(type);
    setSaveResults((prev) => ({ ...prev, [type]: null }));
    try {
      const token = await getToken();
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'https://api.sassmaker.com'}/v1/standards/${type}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(config[type]),
        }
      );
      if (!res.ok) throw new Error(await res.text());
      setSaveResults((prev) => ({
        ...prev,
        [type]: { ok: true, message: 'Standards saved successfully.' },
      }));
    } catch (err) {
      setSaveResults((prev) => ({
        ...prev,
        [type]: {
          ok: false,
          message: err instanceof Error ? err.message : 'Failed to save',
        },
      }));
    } finally {
      setSaving(null);
    }
  }

  if (fetchError) {
    return (
      <Card className="border-destructive/50">
        <CardHeader className="flex flex-row items-center gap-3">
          <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
          <div>
            <CardTitle className="text-base text-destructive">Failed to load standards</CardTitle>
            <p className="mt-1 text-xs font-mono text-muted-foreground break-all">{fetchError}</p>
          </div>
        </CardHeader>
      </Card>
    );
  }

  const tabs: Array<{ value: TabType; label: string }> = [
    { value: 'nextjs', label: 'Next.js' },
    { value: 'vite', label: 'Vite' },
    { value: 'node', label: 'Node' },
  ];

  return (
    <Tabs defaultValue="nextjs">
      <TabsList>
        {tabs.map(({ value, label }) => (
          <TabsTrigger key={value} value={value}>
            {label}
          </TabsTrigger>
        ))}
      </TabsList>

      {tabs.map(({ value }) => (
        <TabsContent key={value} value={value} className="mt-4">
          <ProjectTab
            type={value}
            standards={config[value]}
            onChange={(s) => setConfig((prev) => ({ ...prev, [value]: s }))}
            onSave={() => handleSave(value)}
            saving={saving === value}
            saveResult={saveResults[value] ?? null}
          />
        </TabsContent>
      ))}
    </Tabs>
  );
}
