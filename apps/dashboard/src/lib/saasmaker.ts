import { SaaSMakerClient } from '@saas-maker/sdk';

export const saasmaker = new SaaSMakerClient({
  apiKey: process.env.NEXT_PUBLIC_SAASMAKER_API_KEY!,
  baseUrl: 'https://api.sassmaker.com',
});
