import { STUDIO_PROFILE } from './studio';
import { curatedAgentGuidance } from './agentGuidance';

export const AGENT_IDENTITY = {
  name: 'SaaS Maker',
  url: 'https://sassmaker.com',
  summary: STUDIO_PROFILE.oneLine,
  notes: [curatedAgentGuidance()],
  contact: 'team@sassmaker.com',
  trainingAllowed: true,
  updatedAt: '2026-10-26',
  excludedPaths: ['/admin', '/auth', '/dashboard', '/api', '/unsubscribe'],
};
