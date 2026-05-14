import type { CommandResult, RunExecutionInput, RunEventInput } from './types';

export type DroidProviderName = 'command' | 'deepseek-native' | 'opencode' | 'codebuff' | 'codex';

export type DroidProviderCapability =
  | 'event_stream'
  | 'heartbeat'
  | 'cancel'
  | 'resume'
  | 'structured_final'
  | 'pull_request';

export interface DroidProviderFinal {
  summary: string;
  filesChanged: string[];
  checksRun: string[];
  blockers: string[];
  risks: string[];
}

export interface DroidProviderRunResult extends CommandResult {
  final?: DroidProviderFinal;
}

export interface DroidProviderAdapter {
  name: DroidProviderName;
  label: string;
  capabilities: DroidProviderCapability[];
  start(input: RunExecutionInput): Promise<DroidProviderRunResult>;
  cancel?(input: Pick<RunExecutionInput, 'env' | 'runId' | 'sandboxId'>): Promise<void>;
  resume?(input: RunExecutionInput, state: unknown): Promise<DroidProviderRunResult>;
}

export interface DroidProviderContract {
  name: DroidProviderName;
  label: string;
  capabilities: DroidProviderCapability[];
  requiresHeartbeat: boolean;
  requiresStructuredFinal: boolean;
}

export function resolveProviderContract(input: {
  mode: RunExecutionInput['mode'];
  provider?: RunExecutionInput['provider'];
}): DroidProviderContract {
  if (input.mode === 'command') {
    return {
      name: 'command',
      label: 'Shell command',
      capabilities: ['cancel', 'pull_request'],
      requiresHeartbeat: false,
      requiresStructuredFinal: false,
    };
  }

  return {
    name: 'deepseek-native',
    label: 'Native DeepSeek tool loop',
    capabilities: ['event_stream', 'heartbeat', 'cancel', 'structured_final', 'pull_request'],
    requiresHeartbeat: true,
    requiresStructuredFinal: true,
  };
}

export function providerContractEvent(contract: DroidProviderContract): RunEventInput {
  return {
    type: 'provider_contract',
    actor: 'droid',
    source: 'worker',
    message: `${contract.label} selected for this Droid run.`,
    metadata: {
      provider: contract.name,
      capabilities: contract.capabilities,
      requires_heartbeat: contract.requiresHeartbeat,
      requires_structured_final: contract.requiresStructuredFinal,
    },
  };
}
