import { HttpClient } from './http';
import { FeedbackService } from './services/feedback';
import { WaitlistService } from './services/waitlist';
import { TestimonialService } from './services/testimonials';
import { ChangelogService } from './services/changelog';
import { KnowledgeBaseService } from './services/knowledge-base';
import { AnalyticsService } from './services/analytics';

export interface SaaSMakerConfig {
  apiKey: string;
  baseUrl?: string;
}

export class SaaSMakerClient {
  readonly feedback: FeedbackService;
  readonly waitlist: WaitlistService;
  readonly testimonials: TestimonialService;
  readonly changelog: ChangelogService;
  readonly knowledgeBase: KnowledgeBaseService;
  readonly analytics: AnalyticsService;

  constructor(config: SaaSMakerConfig) {
    const http = new HttpClient(
      config.baseUrl || 'https://api.sassmaker.com',
      config.apiKey,
    );

    this.feedback = new FeedbackService(http);
    this.waitlist = new WaitlistService(http);
    this.testimonials = new TestimonialService(http);
    this.changelog = new ChangelogService(http);
    this.knowledgeBase = new KnowledgeBaseService(http);
    this.analytics = new AnalyticsService(http);
  }
}
