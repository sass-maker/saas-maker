#!/usr/bin/env node

import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  DesignWorkflowError,
  validateDesignReview,
  validateDesignPreflight,
  validateDesignWorkflowPolicy,
  validateInstalledImpeccable,
} from '../lib/design-workflow.mjs';

const repositoryRoot = path.resolve(import.meta.dirname, '..');
const fleetRoot = path.resolve(repositoryRoot, '../..');
const policyPath = path.join(repositoryRoot, 'config/design-workflow.json');
const templatePath = path.join(repositoryRoot, 'templates/design-review.json');
const command = process.argv[2] ?? 'self-check';
const args = parseArgs(process.argv.slice(3));

try {
  if (command === 'prompt-hook') {
    let input = '';
    for await (const chunk of process.stdin) {
      input += chunk;
      if (Buffer.byteLength(input) > 1024 * 1024) throw new Error('hook input exceeds 1 MiB');
    }
    const payload = JSON.parse(input);
    const relative = typeof payload.cwd === 'string' ? path.relative(fleetRoot, path.resolve(payload.cwd)) : '..';
    const inFleet = relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
    const result = payload.hook_event_name === 'UserPromptSubmit' && inFleet ? {
      hookSpecificOutput: {
        hookEventName: 'UserPromptSubmit',
        additionalContext: `Fleet design routing: Before meaningful visual/frontend work, read ${path.join(repositoryRoot, 'skills/design-workflow/SKILL.md')}. New surfaces, meaningful redesigns, and owner dissatisfaction use overhaul: present 3–4 distinct rendered systems using real content and obtain explicit selection. A broad finish/improve/release request is not delegation. Before UI implementation run node ${process.argv[1]} preflight --project <owning-project-root>; before claiming completion run its check command. Landing and app share one product design system: inventory both, show paired direction previews, and record rendered continuity plus the CTA/onboarding/first-value handoff. Standalone products need a reason. For web work, run the pinned slop scale at direction review, first working render, and final review; record checkpoint reports, findings and fixes. Numeric scores are advisory; blocked scans are unknown, and native work records inapplicability. Preserve established direction for bounded work; copy-only, invisible refactors, accessibility corrections, and trivial deterministic CSS fixes are exempt. Review composition, typography, hierarchy, identity, interaction and responsive behavior against the selected direction; record concrete fixes and rendered evidence. Scores or a SKILL.md read do not prove design quality.`,
      },
    } : {};
    console.log(JSON.stringify(result));
  } else {
    const policy = JSON.parse(await readFile(policyPath, 'utf8'));
    validateDesignWorkflowPolicy(policy);

    if (command === 'create') {
      const projectRoot = resolveProject(args.project);
      const mode = args.mode;
      const register = args.register;
      const target = args.target;
      const surfaceMode = args['surface-mode'];
      if (!['preserve', 'overhaul'].includes(mode)) throw new Error('--mode must be preserve or overhaul');
      if (!['brand', 'product'].includes(register)) throw new Error('--register must be brand or product');
      if (!target) throw new Error('--target is required');
      if (!['persuade', 'operate', 'read', 'experience'].includes(surfaceMode)) {
        throw new Error('--surface-mode must be persuade, operate, read, or experience');
      }

      const platform = args.platform ?? 'web';
      if (!['web', 'native-macos'].includes(platform)) {
        throw new Error('--platform must be web or native-macos');
      }
      const minimum = Number(args['supported-minimum-width']);
      if (platform === 'native-macos' && (
        !/^\d+$/.test(args['supported-minimum-width'] ?? '')
        || !Number.isSafeInteger(minimum) || minimum < 600
      )) {
        throw new Error('--supported-minimum-width must be an integer at least 600 for native-macos');
      }
      if (platform === 'web' && args['supported-minimum-width'] !== undefined) {
        throw new Error('--supported-minimum-width requires --platform native-macos');
      }

      const destination = path.resolve(projectRoot, args.receipt ?? '.fleet/design-review.json');
      const relativeReceipt = path.relative(projectRoot, destination);
      if (relativeReceipt === '..' || relativeReceipt.startsWith(`..${path.sep}`) || path.isAbsolute(relativeReceipt)) {
        throw new Error('--receipt must stay inside the project');
      }
      await mkdir(path.dirname(destination), { recursive: true });
      await cp(templatePath, destination, {
        force: args.force === true,
        errorOnExist: args.force !== true,
      });
      const receipt = JSON.parse(await readFile(destination, 'utf8'));
      receipt.project = path.basename(projectRoot);
      receipt.target = target;
      receipt.surfaceMode = surfaceMode;
      receipt.mode = mode;
      receipt.register = register;
      if (platform === 'native-macos') {
        receipt.evidence.platform = platform;
        receipt.evidence.supportedMinimumWidth = minimum;
        receipt.evidence.screenshots = [0, 200, 400].map((offset) => ({
          width: Math.min(minimum + offset, Number.MAX_SAFE_INTEGER),
          height: null,
          path: `artifacts/design/after-native-${offset}.png`,
        }));
        receipt.evidence.slopScale = {
          platform: 'native', posture: 'advisory',
          reason: 'Native macOS windows require native rendered review; the browser slop scanner cannot inspect them.',
          checkpoints: [],
        };
      }
      receipt.direction.approval = mode === 'preserve' ? 'not-required' : 'pending';
      receipt.direction.source = mode === 'preserve' ? 'existing' : 'comparison';
      if (mode === 'preserve') {
        receipt.direction.library.primary = 'existing-project-system';
        receipt.direction.library.runtime = 'existing';
      }
      if (mode === 'overhaul') {
        receipt.direction.selected = '';
        receipt.direction.before = '';
        receipt.ownerFeedback = { decision: 'pending', note: '' };
      }
      await writeFile(destination, `${JSON.stringify(receipt, null, 2)}\n`);
      output({ ok: true, receipt: path.relative(projectRoot, destination), mode, register }, args.json);
    } else if (command === 'check' || command === 'preflight') {
      const projectRoot = resolveProject(args.project);
      const receiptPath = path.resolve(projectRoot, args.receipt ?? '.fleet/design-review.json');
      const receipt = JSON.parse(await readFile(receiptPath, 'utf8'));
      const validate = command === 'preflight' ? validateDesignPreflight : validateDesignReview;
      output(validate(receipt, policy, { projectRoot }), args.json);
    } else if (command === 'self-check') {
      const skillFile = args['skill-file']
        ? path.resolve(args['skill-file'])
        : path.join(fleetRoot, '.agents/skills/impeccable/SKILL.md');
      const version = validateInstalledImpeccable(policy, skillFile);
      output({
        ok: true,
        policy: path.relative(fleetRoot, policyPath),
        impeccablePackageVersion: policy.impeccablePackageVersion,
        impeccableVersion: version.installed,
        detectorPosture: policy.qualityGate.detectorPosture,
        minimumCritiqueScore: policy.qualityGate.minimumCritiqueScore,
        minimumAuditScore: policy.qualityGate.minimumAuditScore,
        minimumPurposeScore: policy.purposeGate.minimumScore,
        purposeScorePosture: policy.purposeGate.visualScorePosture,
      }, args.json);
    } else {
      throw new Error('usage: design-workflow.mjs <create|preflight|check|self-check|prompt-hook> [options]');
    }
  }
} catch (error) {
  if (args.json) {
    console.error(JSON.stringify({
      ok: false,
      error: error.message,
      findings: error instanceof DesignWorkflowError ? error.errors : [],
    }, null, 2));
  } else {
    console.error(error.message);
  }
  process.exitCode = 1;
}

function resolveProject(value) {
  return path.resolve(value ?? process.cwd());
}

function parseArgs(values) {
  const parsed = {};
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (!value.startsWith('--')) throw new Error(`unexpected argument: ${value}`);
    const key = value.slice(2);
    if (['json', 'force'].includes(key)) {
      parsed[key] = true;
    } else {
      const next = values[index + 1];
      if (!next || next.startsWith('--')) throw new Error(`${value} requires a value`);
      parsed[key] = next;
      index += 1;
    }
  }
  return parsed;
}

function output(value, json) {
  if (json) {
    console.log(JSON.stringify(value, null, 2));
  } else if (value.receipt) {
    console.log(`Created ${value.receipt} (${value.mode}, ${value.register})`);
  } else if (value.phase === 'preflight') {
    console.log(`Design preflight passed: ${value.project} / ${value.target}`);
  } else if (value.target) {
    console.log(`Design review passed: ${value.project} / ${value.target}`);
  } else {
    console.log(`Design workflow ready (Impeccable ${value.impeccableVersion})`);
  }
}
