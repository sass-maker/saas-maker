import { SaaSMakerClient } from '@saas-maker/sdk';

let _client: SaaSMakerClient | null = null;

export function getSaasmaker(): SaaSMakerClient {
  if (_client) return _client;
  const apiKey = process.env.NEXT_PUBLIC_SAASMAKER_API_KEY;
  if (!apiKey) {
    throw new Error('NEXT_PUBLIC_SAASMAKER_API_KEY is not set');
  }
  _client = new SaaSMakerClient({
    apiKey,
    baseUrl: 'https://api.sassmaker.com',
  });
  return _client;
}
