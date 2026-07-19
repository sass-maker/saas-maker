# Phone Node

OpenClaw's companion node is the Fleet phone surface. It is open source and
talks only to the local Gateway after explicit device pairing.

## Same-LAN Setup

1. Keep the Gateway running: `./fleet-ops/scripts/agent-stack.sh resume`.
2. Install the OpenClaw companion app on the phone and open its Connect tab.
3. Select the discovered Gateway, or enter `192.168.29.190:18789` manually.
4. On the Mac, inspect the request with `openclaw devices list`.
5. Approve only the expected request: `openclaw devices approve <requestId>`.
6. Verify with `openclaw nodes status`.

The node can then provide chat, voice, notifications, location, camera, screen,
and Canvas capabilities, subject to its own mobile permission prompts. Do not
enable automatic node approval. For access away from the local network, use a
secure Tailscale Serve route rather than exposing the Gateway directly.
