import { PageHeader } from '@/components/page-header';
import { apiFetch } from '@/lib/api';
import type { AIProviderConfig, AIRequestsResponse, AIUsageStats } from '@saas-maker/contracts';
import { getAuthenticatedProject } from '../get-project';
import { AIGatewayPanel } from './ai-gateway-panel';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ slug: string }>;
}

const emptyConfig: AIProviderConfig = {
  ai_base_url: null,
  ai_model: null,
  ai_api_key_configured: false,
  ai_api_key_preview: null,
};

const emptyUsage: AIUsageStats = {
  total_requests: 0,
  success_count: 0,
  error_count: 0,
  avg_latency_ms: null,
  total_input_tokens: 0,
  total_output_tokens: 0,
};

const emptyRequests: AIRequestsResponse = {
  data: [],
  total: 0,
  limit: 20,
  offset: 0,
};

function settledValue<T>(result: PromiseSettledResult<T>, fallback: T): T {
  return result.status === 'fulfilled' ? result.value : fallback;
}

export default async function AIGatewayPage({ params }: Props) {
  const { slug } = await params;
  const { project, token } = await getAuthenticatedProject(slug);
  const projectQuery = `project_id=${encodeURIComponent(project.id)}`;
  const [config, usage, requests] = await Promise.allSettled([
    apiFetch(`/v1/ai/config?${projectQuery}`, {}, token) as Promise<AIProviderConfig>,
    apiFetch(`/v1/ai/usage?${projectQuery}&days=30`, {}, token) as Promise<AIUsageStats>,
    apiFetch(`/v1/ai/requests?${projectQuery}&limit=20`, {}, token) as Promise<AIRequestsResponse>,
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Gateway"
        description={`${project.name} provider config, usage, and request log`}
      />
      <AIGatewayPanel
        projectId={project.id}
        projectKey={project.api_key}
        apiBaseUrl={process.env.NEXT_PUBLIC_API_URL || 'https://api.sassmaker.com'}
        initialConfig={settledValue(config, emptyConfig)}
        initialUsage={settledValue(usage, emptyUsage)}
        initialRequests={settledValue(requests, emptyRequests)}
      />
    </div>
  );
}
