#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { generateIdeas, exploreNiche, suggestChannelNames } from '../src/studio/ideas.js';
import { generateTitles, generateDescription, generateTags, organizeTags } from '../src/studio/metadata.js';
import { generateScript } from '../src/studio/script.js';
import { deriveVoiceProfile } from '../src/studio/brand-voice.js';
import { researchKeywords } from '../src/studio/keywords.js';
import { fetchTranscript } from '../src/studio/transcript.js';
import { generateThumbnailConcepts, renderConceptHtml } from '../src/studio/thumbnails.js';
import { IdeaStore } from '../src/studio/idea-store.js';

const USAGE = `Usage: npm run studio -- <command> [flags]

Commands:
  ideas        --niche <niche> [--count N]
  niche        --niche <niche>
  channel      --niche <niche> [--count N]
  titles       --topic <topic> [--count N]
  description  --topic <topic> [--hook <hook>] [--cta <cta>]
  tags         --topic <topic> [--niche <niche>]
  organize     --tags "tag1,tag2,..."
  script       --topic <topic> [--duration S] [--article FILE] [--inspiration FILE] [--voice-profile FILE]
  voice        --samples FILE[,FILE...]
  keywords     --seed <keyword>
  transcript   --url <youtube-url>
  thumbnails   --topic <topic> [--count N] [--render DIR]
  save         --title <title> [--niche <niche>] [--hook <hook>] [--notes <notes>]
  list         [--status new|scripted|rendered|posted]
  status       --id <ideaId> --to <status>

All commands print JSON. Set DEEPSEEK_API_KEY for LLM-quality output;
without it every command still works via deterministic templates.`;

function parseFlags(argv) {
  const flags = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) {
      flags[key] = true;
    } else {
      flags[key] = next;
      i += 1;
    }
  }
  return flags;
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  const flags = parseFlags(rest);
  if (!command || command === 'help' || flags.help) {
    console.log(USAGE);
    return;
  }

  const result = await run(command, flags);
  console.log(JSON.stringify(result, null, 2));
}

async function run(command, flags) {
  switch (command) {
    case 'ideas':
      return generateIdeas({ niche: flags.niche, count: flags.count });
    case 'niche':
      return exploreNiche({ niche: flags.niche });
    case 'channel':
      return suggestChannelNames({ niche: flags.niche, count: flags.count });
    case 'titles':
      return generateTitles({ topic: flags.topic, count: flags.count });
    case 'description':
      return generateDescription({ topic: flags.topic, hook: flags.hook, cta: flags.cta });
    case 'tags':
      return generateTags({ topic: flags.topic, niche: flags.niche });
    case 'organize':
      return organizeTags(String(flags.tags ?? '').split(','));
    case 'script': {
      const article = flags.article ? await readFile(flags.article, 'utf8') : undefined;
      const inspiration = flags.inspiration ? await readFile(flags.inspiration, 'utf8') : undefined;
      const voiceProfile = flags['voice-profile']
        ? JSON.parse(await readFile(flags['voice-profile'], 'utf8'))
        : undefined;
      return generateScript({
        topic: flags.topic,
        durationSeconds: flags.duration ? Number(flags.duration) : undefined,
        article,
        inspiration,
        voiceProfile,
      });
    }
    case 'voice': {
      const files = String(flags.samples ?? '').split(',').filter(Boolean);
      if (!files.length) throw new Error('--samples FILE[,FILE...] is required');
      const transcripts = await Promise.all(files.map((file) => readFile(file, 'utf8')));
      return deriveVoiceProfile({ transcripts });
    }
    case 'keywords':
      return researchKeywords({ seed: flags.seed });
    case 'transcript':
      return fetchTranscript({ url: flags.url });
    case 'thumbnails': {
      const result = await generateThumbnailConcepts({ topic: flags.topic, count: flags.count });
      if (flags.render) {
        const concepts = result.data?.concepts ?? result.concepts ?? [];
        const rendered = [];
        for (const concept of concepts) {
          rendered.push(await renderConceptHtml(concept, typeof flags.render === 'string' ? flags.render : undefined));
        }
        return { ...result, rendered };
      }
      return result;
    }
    case 'save':
      return new IdeaStore().saveIdea({
        title: flags.title,
        niche: flags.niche,
        hook: flags.hook,
        notes: flags.notes,
      });
    case 'list':
      return new IdeaStore().listIdeas({ status: typeof flags.status === 'string' ? flags.status : undefined });
    case 'status':
      return new IdeaStore().updateIdeaStatus(flags.id, flags.to);
    default:
      throw new Error(`unknown command: ${command}\n\n${USAGE}`);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
