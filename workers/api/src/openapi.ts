export const openApiDocument = {
  openapi: '3.1.0',
  info: {
    title: 'SaaS Maker Capture API',
    version: '1.0.0',
    description:
      'Submit product feedback or consented newsletter/waitlist requests with a publishable project key; review submissions through owner-authenticated JSON routes.',
  },
  servers: [{ url: 'https://api.sassmaker.com' }],
  paths: {
    '/health': {
      get: {
        summary: 'Liveness',
        security: [],
        responses: { '200': { description: 'Service is up' } },
      },
    },
    '/openapi.json': {
      get: {
        summary: 'This OpenAPI document',
        security: [],
        responses: { '200': { description: 'OpenAPI 3.1 JSON' } },
      },
    },
    '/v1/feedback': {
      post: {
        summary: 'Submit feedback',
        security: [{ projectKey: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/SubmitFeedback' },
            },
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['feedback'],
                properties: {
                  feedback: {
                    type: 'string',
                    description: 'JSON string matching SubmitFeedback',
                  },
                  screenshot: { type: 'string', format: 'binary' },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'Feedback created' },
          '400': { description: 'Invalid payload' },
          '401': { description: 'Missing or invalid project key' },
          '429': { description: 'Rate limited' },
        },
      },
      get: {
        summary: 'List feedback the caller is authorized to read',
        security: [{ bearerSession: [] }, { agentToken: [] }],
        parameters: [
          { name: 'project', in: 'query', schema: { type: 'string' } },
          {
            name: 'type',
            in: 'query',
            schema: { type: 'string', enum: ['bug', 'feature', 'feedback'] },
          },
          { name: 'status', in: 'query', schema: { type: 'string' } },
          { name: 'since', in: 'query', schema: { type: 'string', format: 'date-time' } },
          { name: 'until', in: 'query', schema: { type: 'string', format: 'date-time' } },
          { name: 'cursor', in: 'query', schema: { type: 'string' } },
          { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1 } },
        ],
        responses: { '200': { description: 'Newest-first feedback page' } },
      },
    },
    '/v1/subscriptions': {
      post: {
        summary: 'Join a product newsletter or waitlist',
        security: [{ projectKey: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/JoinSubscription' },
            },
          },
        },
        responses: {
          '202': { description: 'Request accepted; duplicate addresses receive the same response' },
          '400': { description: 'Invalid payload or missing consent' },
          '401': { description: 'Missing or invalid project key' },
          '503': { description: 'Capture is not configured' },
        },
      },
      get: {
        summary: 'List active subscriptions and signed removal tokens for an owned project',
        security: [{ bearerSession: [] }],
        parameters: [
          { name: 'project', in: 'query', required: true, schema: { type: 'string' } },
          {
            name: 'kind',
            in: 'query',
            schema: { type: 'string', enum: ['newsletter', 'waitlist'] },
          },
          { name: 'cursor', in: 'query', schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          '200': { description: 'Owner-scoped page of up to 100 active subscriptions' },
          '503': { description: 'Capture is not configured' },
        },
      },
    },
    '/v1/subscriptions/unsubscribe': {
      post: {
        summary: 'Remove a subscription using its signed token',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['id', 'token'],
                properties: {
                  id: { type: 'string', format: 'uuid' },
                  token: { type: 'string', pattern: '^[a-f0-9]{64}$' },
                },
              },
            },
          },
        },
        responses: {
          '202': { description: 'Request accepted without disclosing subscription state' },
        },
      },
    },
    '/v1/capture-config/{catalogId}': {
      get: {
        summary: 'Resolve a Fleet catalog id to a publishable capture config',
        description:
          'Returns the bound project publishable api key and minimal display metadata for the newsletter-capture element catalog-id mode. Public, credential-free, CORS-open to HTTPS web origins, bounded cached. Never returns owner/user data, private tokens, or unbound projects.',
        security: [],
        parameters: [
          {
            name: 'catalogId',
            in: 'path',
            required: true,
            schema: { type: 'string', pattern: '^[a-z][a-z0-9_-]{0,63}$' },
          },
        ],
        responses: {
          '200': {
            description: 'Publishable api key, product name, and slug for the bound project',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/CaptureConfig' },
              },
            },
          },
          '404': { description: 'Unknown, malformed, or unbound catalog id' },
        },
      },
    },
    '/v1/feedback/inbox': {
      get: {
        summary: 'Alias of GET /v1/feedback for the owner inbox',
        security: [{ bearerSession: [] }, { agentToken: [] }],
        responses: { '200': { description: 'Newest-first feedback page' } },
      },
    },
    '/v1/feedback/{id}': {
      get: {
        summary: 'Read one feedback item',
        security: [{ bearerSession: [] }, { agentToken: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Feedback record with status events' } },
      },
      patch: {
        summary: 'Update feedback status',
        security: [{ bearerSession: [] }, { agentToken: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['status'],
                properties: { status: { type: 'string' } },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Updated feedback record' },
          '403': { description: 'Read-only agent token' },
        },
      },
    },
    '/v1/upload': {
      post: {
        summary: 'Upload a screenshot for hosted JSON clients',
        security: [{ projectKey: [] }],
        responses: { '201': { description: 'Object URL' } },
      },
    },
    '/v1/projects': {
      get: {
        summary: 'List owned projects',
        security: [{ bearerSession: [] }],
        responses: { '200': { description: 'Project keys' } },
      },
      post: {
        summary: 'Create a project and publishable submission key',
        security: [{ bearerSession: [] }],
        responses: { '201': { description: 'Created project' } },
      },
    },
    '/v1/projects/{id}/agent-tokens': {
      get: {
        summary: 'List agent tokens for a project',
        security: [{ bearerSession: [] }],
        responses: { '200': { description: 'Token metadata; plaintext is never returned again' } },
      },
      post: {
        summary: 'Create a project-scoped agent token',
        description: 'Tokens default to read-only. Set can_write=true for lifecycle mutations.',
        security: [{ bearerSession: [] }],
        responses: { '201': { description: 'Token metadata plus one-time plaintext token' } },
      },
    },
  },
  components: {
    securitySchemes: {
      projectKey: { type: 'apiKey', in: 'header', name: 'X-Project-Key' },
      bearerSession: { type: 'http', scheme: 'bearer' },
      agentToken: {
        type: 'http',
        scheme: 'bearer',
        description: 'Project-scoped smk_ token. Defaults to read-only.',
      },
    },
    schemas: {
      JoinSubscription: {
        type: 'object',
        required: ['email', 'kind', 'consent'],
        properties: {
          email: { type: 'string', format: 'email', maxLength: 254 },
          kind: { type: 'string', enum: ['newsletter', 'waitlist'] },
          consent: { type: 'boolean', const: true },
          source: { type: 'string', pattern: '^[a-z][a-z0-9_-]{0,63}$' },
        },
      },
      SubmitFeedback: {
        type: 'object',
        required: ['type', 'title', 'description'],
        properties: {
          type: { type: 'string', enum: ['bug', 'feature', 'feedback'] },
          title: { type: 'string' },
          description: { type: 'string' },
          submitter_email: { type: 'string' },
          submitter_name: { type: 'string' },
          image_url: { type: 'string' },
          page: {
            type: 'object',
            properties: { url: { type: 'string' }, title: { type: 'string' } },
          },
          anchor: { type: 'object' },
          client_version: { type: 'string' },
          source: { type: 'string' },
        },
      },
      CaptureConfig: {
        type: 'object',
        required: ['api_key', 'name', 'slug'],
        description:
          'Publishable browser key and minimal display metadata for a bound catalog id. No owner or user data.',
        properties: {
          api_key: { type: 'string', description: 'Publishable project key (pk_…)' },
          name: { type: 'string', description: 'Product display name' },
          slug: { type: 'string', description: 'Project slug' },
        },
      },
    },
  },
} as const;
