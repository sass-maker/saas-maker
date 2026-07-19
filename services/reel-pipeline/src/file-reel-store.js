import { FileJobStore } from './job-store.js';

export class FileReelStore extends FileJobStore {
  constructor(options = {}) {
    super({ dir: options.dir ?? process.env.REEL_PIPELINE_REEL_DIR ?? '.reel-pipeline/reels' });
  }
}
