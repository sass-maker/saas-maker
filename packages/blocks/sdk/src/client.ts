import { HttpClient } from './http';
import { FeedbackService } from './services/feedback';
import { WaitlistService } from './services/waitlist';
import { TestimonialService } from './services/testimonials';
import { ChangelogService } from './services/changelog';
import { AnalyticsService } from './services/analytics';
import { AIService } from './services/ai';
import { RoadmapService } from './services/roadmap';
import { ProjectService } from './services/projects';
import { KnowledgeService } from './services/knowledge';

export interface SaaSMakerConfig {
  apiKey?: string;
  sessionToken?: string;
  baseUrl?: string;
}

export class SaaSMakerClient {
  readonly feedback: FeedbackService;
  readonly waitlist: WaitlistService;
  readonly testimonials: TestimonialService;
  readonly changelog: ChangelogService;
  readonly analytics: AnalyticsService;
  readonly ai: AIService;
  readonly roadmap: RoadmapService;
  readonly projects: ProjectService;
  readonly knowledge: KnowledgeService;

  constructor(config: SaaSMakerConfig) {
    if (!config.apiKey && !config.sessionToken) {
      throw new Error('Provide at least one of apiKey or sessionToken.');
    }

    const http = new HttpClient(
      config.baseUrl || 'https://api.sassmaker.com',
      config.apiKey,
      config.sessionToken,
    );

    this.feedback = new FeedbackService(http);
    this.waitlist = new WaitlistService(http);
    this.testimonials = new TestimonialService(http);
    this.changelog = new ChangelogService(http);
    this.analytics = new AnalyticsService(http);
    this.ai = new AIService(http);
    this.roadmap = new RoadmapService(http);
    this.projects = new ProjectService(http);
    this.knowledge = new KnowledgeService(http);
  }
}
