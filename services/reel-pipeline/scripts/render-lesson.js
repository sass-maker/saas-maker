#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { generateScripts, renderLesson, runLessonEndToEnd } from '../src/lesson-pipeline.js';
import { FileLessonStore, decideLessonScript } from '../src/lesson-intake.js';

const HELP = `
Usage:
  npm run lesson:render -- --input <path> [--auto-approve] [--skip-render]
  npm run lesson:render -- --lesson <id> --render
  npm run lesson:render -- --lesson <id> --approve
  npm run lesson:render -- --list

Flags:
  --input <path>     Lesson spec JSON (creates draft + generates scripts).
  --lesson <id>      Operate on an existing lesson by ID.
  --auto-approve     After script generation, approve scripts and render immediately.
  --skip-render      Generate scripts but skip rendering.
  --approve          Approve the lesson's scripts (manual gate).
  --render           Render an already-approved lesson.
  --list             List all lessons with status.
  --help             Show this help.

Required env:
  DEEPSEEK_API_KEY
  ELEVENLABS_API_KEY
  ELEVENLABS_VOICE_ID
  PEXELS_API_KEY
`;

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(HELP);
    return;
  }

  const lessonStore = new FileLessonStore();

  if (args.list) {
    const records = await lessonStore.list();
    for (const record of records) {
      console.log(
        `${record.id}\t${record.status.padEnd(18)}\t${record.topic}`,
      );
    }
    return;
  }

  if (args.lesson && args.approve) {
    const updated = await decideLessonScript(args.lesson, 'approve', { lessonStore });
    if (!updated) throw new Error(`lesson not found: ${args.lesson}`);
    console.log(`approved ${updated.id}`);
    return;
  }

  if (args.lesson && args.render) {
    const updated = await renderLesson(args.lesson, { lessonStore, allowUnapproved: args.allowUnapproved });
    console.log(JSON.stringify(summary(updated), null, 2));
    return;
  }

  if (!args.input) {
    console.error('Provide --input <lesson.json>, --lesson <id> --render, or --list');
    process.exit(1);
  }

  const lessonInput = JSON.parse(await readFile(path.resolve(args.input), 'utf8'));

  if (args.autoApprove) {
    const updated = await runLessonEndToEnd(lessonInput, { lessonStore });
    console.log(JSON.stringify(summary(updated), null, 2));
    return;
  }

  const drafted = await generateScripts(lessonInput, { lessonStore });
  console.log(JSON.stringify(summary(drafted), null, 2));
  if (!args.skipRender) {
    console.log(`\nNext: review ${drafted.id} via /review, then re-run with --lesson ${drafted.id} --render`);
  }
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    switch (arg) {
      case '--input':
        args.input = argv[++index];
        break;
      case '--lesson':
        args.lesson = argv[++index];
        break;
      case '--auto-approve':
        args.autoApprove = true;
        break;
      case '--allow-unapproved':
        args.allowUnapproved = true;
        break;
      case '--skip-render':
        args.skipRender = true;
        break;
      case '--approve':
        args.approve = true;
        break;
      case '--render':
        args.render = true;
        break;
      case '--list':
        args.list = true;
        break;
      case '--help':
      case '-h':
        args.help = true;
        break;
      default:
        if (arg.startsWith('--')) throw new Error(`unknown flag: ${arg}`);
    }
  }
  return args;
}

function summary(lesson) {
  return {
    id: lesson.id,
    status: lesson.status,
    topic: lesson.topic,
    variantCount: lesson.variants?.length ?? lesson.scripts?.length ?? 0,
    variants: (lesson.variants ?? []).map((variant) => ({
      variantId: variant.variantId,
      status: variant.status,
      assetUrl: variant.assetUrl ?? null,
      durationSeconds: variant.durationSeconds ?? null,
      error: variant.error ?? null,
    })),
    scripts: (lesson.scripts ?? []).map((script) => ({
      variantId: script.variantId,
      template: script.template,
      hook: script.hook,
      sceneCount: script.scenes.length,
    })),
  };
}

main().catch((error) => {
  console.error(error.stack ?? error.message ?? error);
  process.exit(1);
});
