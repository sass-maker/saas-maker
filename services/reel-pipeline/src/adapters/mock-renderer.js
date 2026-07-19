import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

export class MockRenderer {
  constructor(options = {}) {
    this.artifactDir = options.artifactDir ?? process.env.REEL_PIPELINE_ARTIFACT_DIR ?? './artifacts';
  }

  async createVideo(brief) {
    const taskId = `mock_${brief.id}_${Date.now()}`;
    const dir = path.resolve(this.artifactDir, taskId);
    await mkdir(dir, { recursive: true });
    const manifestPath = path.join(dir, 'manifest.json');
    const videoPath = path.join(dir, 'draft.mp4');
    await writeFile(videoPath, `mock mp4 placeholder for ${brief.title}\n`);
    await writeFile(manifestPath, JSON.stringify({ taskId, brief, videoPath, status: 'completed' }, null, 2));
    return {
      provider: 'mock',
      externalTaskId: taskId,
      status: 'completed',
      videos: [videoPath],
      raw: { manifestPath },
    };
  }

  async getStatus(externalTaskId) {
    return {
      provider: 'mock',
      externalTaskId,
      status: 'completed',
    };
  }
}
