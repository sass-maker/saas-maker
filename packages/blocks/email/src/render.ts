import { render } from '@react-email/render';
import * as React from 'react';

export async function renderEmail(
  component: React.ReactElement
): Promise<{ html: string; text: string }> {
  const [html, text] = await Promise.all([
    render(component),
    render(component, { plainText: true }),
  ]);
  return { html, text };
}
