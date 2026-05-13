import { createApp } from './app';
import { sandboxExecutor } from './executor';

export { Sandbox } from '@cloudflare/sandbox';

export default createApp(sandboxExecutor);
