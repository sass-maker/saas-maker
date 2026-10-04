# AI Chat Footer

## Purpose

Give a product visitor one clear, backend-free way to open a useful question in
an AI assistant they already use.

## Users and job

The component serves visitors who want a concise explanation of a product
without first learning a new interface. Product teams embed it as a small
extension below their own authored footer.

## Product contract

- Keep the product name and the AI action explicit.
- Use publisher-supplied artwork as the visible provider control. Keep provider
  names in accessible labels and tooltips instead of permanent text.
- Open a pre-filled prompt in the selected provider without API keys, storage,
  analytics, authentication, or a SaaS Maker backend.
- In the opt-in question layout, let the visitor edit that question before the
  same provider handoff. Keep the question local until they open an assistant.
- Preserve the host product's footer, color, typography, and runtime boundary.
- Compose with the portfolio project strip when both hosted loaders are
  present, while keeping the AI handoff and project discovery independently
  operable.

## Non-goals

The package is not a chatbot, standalone prompt editor, analytics surface, model router,
or Fleet control plane. It does not judge providers or make claims about their
availability.
