import http from 'node:http';
import { FileReelStore } from '../file-reel-store.js';
import { createDraftVideo, createRenderResponse, getDraftVideoStatus, renderAcceptedMarketingPosts, renderReelDraft } from '../pipeline.js';
import { postReadyMarketingVideos } from '../posting.js';
import { createReelDraft, decideRenderedReel, decideReelDraft, listReelDrafts } from '../reel-intake.js';
import { reelDraftInputFromSignal } from '../signal-intake.js';
import { reviewPageHtml } from '../review-ui.js';

const port = Number(process.env.PORT ?? 4317);

export function createServer(options = {}) {
  const reelOptions = { ...options, reelStore: options.reelStore ?? new FileReelStore(options.reelStoreOptions) };
  return http.createServer(async (req, res) => {
    try {
      if (req.method === 'GET' && req.url === '/health') {
        return json(res, 200, { ok: true });
      }
      if (req.method === 'GET' && (req.url === '/' || req.url === '/review')) {
        return html(res, 200, reviewPageHtml());
      }
      if (req.method === 'POST' && req.url === '/reels/signal') {
        const body = await readJson(req);
        const data = await createReelDraft(reelDraftInputFromSignal(body), reelOptions);
        return json(res, 201, { data });
      }
      if (req.method === 'POST' && req.url === '/reels') {
        const body = await readJson(req);
        const data = await createReelDraft(body, reelOptions);
        return json(res, 201, { data });
      }
      if (req.method === 'GET' && req.url?.startsWith('/reels')) {
        const url = new URL(req.url, 'http://127.0.0.1');
        if (url.pathname === '/reels') {
          const data = await listReelDrafts(Object.fromEntries(url.searchParams), reelOptions);
          return json(res, 200, { data });
        }
      }
      const decisionMatch = req.method === 'PATCH' && req.url?.match(/^\/reels\/([^/?#]+)\/decision$/);
      if (decisionMatch) {
        const body = await readJson(req);
        const data = await decideReelDraft(decodeURIComponent(decisionMatch[1]), body, reelOptions);
        if (!data) return json(res, 404, { error: 'reel not found' });
        return json(res, 200, { data });
      }
      const renderReelMatch = req.method === 'POST' && req.url?.match(/^\/reels\/([^/?#]+)\/render$/);
      if (renderReelMatch) {
        const body = await readJson(req);
        const data = await renderReelDraft(decodeURIComponent(renderReelMatch[1]), {
          ...options,
          reelStore: reelOptions.reelStore,
          mode: body.mode,
          force: body.force,
          allowUnapproved: body.allowUnapproved,
          variantCount: body.variantCount,
        });
        if (!data) return json(res, 404, { error: 'reel not found' });
        return json(res, 200, { data });
      }
      const videoDecisionMatch = req.method === 'PATCH' && req.url?.match(/^\/reels\/([^/?#]+)\/video-decision$/);
      if (videoDecisionMatch) {
        const body = await readJson(req);
        const data = await decideRenderedReel(decodeURIComponent(videoDecisionMatch[1]), body, reelOptions);
        if (!data) return json(res, 404, { error: 'reel not found' });
        return json(res, 200, { data });
      }
      if (req.method === 'POST' && req.url === '/renders') {
        const body = await readJson(req);
        const data = await createDraftVideo(body, options);
        return json(res, 201, { data: createRenderResponse(data) });
      }
      if (req.method === 'POST' && req.url === '/marketing/render-accepted') {
        const body = await readJson(req);
        const data = await renderAcceptedMarketingPosts({ ...options, ...body });
        return json(res, 200, { data });
      }
      if (req.method === 'POST' && req.url === '/marketing/post-ready') {
        const body = await readJson(req);
        const data = await postReadyMarketingVideos({ ...options, ...body });
        return json(res, 200, { data });
      }
      const statusMatch = req.method === 'GET' && req.url?.match(/^\/renders\/([^/?#]+)$/);
      if (statusMatch) {
        const data = await getDraftVideoStatus(decodeURIComponent(statusMatch[1]), options);
        if (!data) return json(res, 404, { error: 'render not found' });
        return json(res, 200, { data: createRenderResponse(data) });
      }
      return json(res, 404, { error: 'not found' });
    } catch (error) {
      return json(res, 400, { error: error instanceof Error ? error.message : String(error) });
    }
  });
}

function json(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json', 'access-control-allow-origin': '*' });
  res.end(JSON.stringify(body));
}

function html(res, status, body) {
  res.writeHead(status, { 'content-type': 'text/html; charset=utf-8' });
  res.end(body);
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  createServer().listen(port, () => {
    console.log(`reel-pipeline listening on http://127.0.0.1:${port}`);
  });
}
