import { createDraftVideo } from '../src/pipeline.js';

const result = await createDraftVideo({
  id: 'smoke-brief',
  projectSlug: 'linkchat',
  channel: 'tiktok',
  title: 'AI profile answers repeated DMs',
  hook: 'POV: your link-in-bio answers the same DM before you see it.',
  body: [
    'Script: show a creator opening five repeated DMs, then one Linkchat profile answering them.',
    'Shot list: phone DM pile, product chat screen, clean result screen.',
    'Captions: "same question again" then "let the profile answer first".',
    'Asset prompts: vertical phone UI, creator desk, fast product demo.',
    'Edit notes: hard cuts, no generic AI b-roll, 20 seconds max.',
  ].join('\n'),
  cta: 'Open the profile and ask it one question.',
  renderMode: 'mock',
});

console.log(JSON.stringify(result, null, 2));
