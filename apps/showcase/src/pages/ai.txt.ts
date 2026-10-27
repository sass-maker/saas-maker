import { handleAgentDocument } from '../data/agentDocuments';

export const prerender = true;
export function GET() {
  return handleAgentDocument(new Request('https://sassmaker.com/ai.txt'));
}
