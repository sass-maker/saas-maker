import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_BASE_URL = 'https://api.elevenlabs.io';
const DEFAULT_MODEL = 'eleven_turbo_v2_5';
const DEFAULT_OUTPUT_FORMAT = 'mp3_44100_128';

export class ElevenLabsClient {
  constructor(options = {}) {
    this.apiKey = options.apiKey ?? process.env.ELEVENLABS_API_KEY;
    this.baseUrl = (options.baseUrl ?? process.env.ELEVENLABS_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, '');
    this.defaultVoiceId = options.voiceId ?? process.env.ELEVENLABS_VOICE_ID;
    this.defaultModelId = options.modelId ?? process.env.ELEVENLABS_MODEL_ID ?? DEFAULT_MODEL;
    this.outputFormat = options.outputFormat ?? process.env.ELEVENLABS_OUTPUT_FORMAT ?? DEFAULT_OUTPUT_FORMAT;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async synthesize(text, options = {}) {
    if (!this.apiKey) throw new Error('ELEVENLABS_API_KEY is required');
    const voiceId = options.voiceId ?? this.defaultVoiceId;
    if (!voiceId) throw new Error('ELEVENLABS_VOICE_ID is required');
    const modelId = options.modelId ?? this.defaultModelId;

    const url = `${this.baseUrl}/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=${encodeURIComponent(this.outputFormat)}`;
    const res = await this.fetchImpl(url, {
      method: 'POST',
      headers: {
        'xi-api-key': this.apiKey,
        'content-type': 'application/json',
        accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text,
        model_id: modelId,
        voice_settings: {
          stability: options.stability ?? 0.45,
          similarity_boost: options.similarity ?? 0.85,
          style: options.style ?? 0.0,
          use_speaker_boost: options.speakerBoost ?? true,
        },
      }),
    });

    if (!res.ok) {
      throw new Error(`ElevenLabs synthesize failed ${res.status}: ${await res.text()}`);
    }
    return Buffer.from(await res.arrayBuffer());
  }
}

export async function synthesizeSceneAudio(scenes, options = {}) {
  const client = options.client ?? new ElevenLabsClient(options);
  const outputDir = options.outputDir;
  if (!outputDir) throw new Error('outputDir is required');
  await mkdir(outputDir, { recursive: true });

  const sceneAudio = [];
  for (let index = 0; index < scenes.length; index += 1) {
    const scene = scenes[index];
    if (!scene.narration?.trim()) {
      sceneAudio.push({ sceneIndex: index, path: null, byteLength: 0 });
      continue;
    }
    const audio = await client.synthesize(scene.narration, options);
    const filePath = path.join(outputDir, `scene-${String(index + 1).padStart(2, '0')}.mp3`);
    await writeFile(filePath, audio);
    sceneAudio.push({ sceneIndex: index, path: filePath, byteLength: audio.byteLength });
  }
  return sceneAudio;
}
