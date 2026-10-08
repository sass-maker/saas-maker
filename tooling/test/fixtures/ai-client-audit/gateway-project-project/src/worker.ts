export async function ask(env: { AI_GATEWAY_API_KEY: string }, prompt: string) {
  const response = await fetch('https://ai-gateway.sassmaker.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.AI_GATEWAY_API_KEY}`,
      'content-type': 'application/json',
      'X-Gateway-Project-Id': 'gateway-project-project',
    },
    body: JSON.stringify({ model: 'auto', messages: [{ role: 'user', content: prompt }] }),
  });
  return response.json();
}
