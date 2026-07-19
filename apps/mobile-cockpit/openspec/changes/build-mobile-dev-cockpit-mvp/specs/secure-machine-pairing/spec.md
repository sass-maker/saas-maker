## ADDED Requirements

### Requirement: One-time machine pairing

The bridge SHALL issue a high-entropy, short-lived, single-use pairing token and SHALL exchange a valid token for a distinct session credential.

#### Scenario: Pair successfully

- **WHEN** an unpaired app submits a valid unused token before expiry
- **THEN** the bridge invalidates the pairing token and returns a session credential plus machine metadata

#### Scenario: Reject invalid pairing

- **WHEN** an app submits an invalid, expired, or previously used pairing token
- **THEN** the bridge rejects the request without creating a session

### Requirement: Authenticated connection

The bridge MUST authenticate every control message after pairing, MUST expire session credentials after a configured bounded lifetime, and the app MUST store the session credential and last paired bridge URL using the platform secure credential store.

#### Scenario: Reconnect with stored credential

- **WHEN** the app reconnects with a valid stored session credential
- **THEN** the bridge authenticates the socket and sends the current machine and process snapshot

#### Scenario: Reject unauthenticated control

- **WHEN** a socket sends a control message without a valid session credential
- **THEN** the bridge closes or rejects the connection before executing an operation

#### Scenario: Reject expired session

- **WHEN** an app authenticates with a session credential at or after its expiry
- **THEN** the bridge rejects the credential and removes it from persistent session state

#### Scenario: Cold-launch reconnect

- **WHEN** the app starts with a saved bridge URL and valid session credential
- **THEN** it reconnects automatically without asking for the pairing token again

### Requirement: Transport visibility

The app SHALL distinguish secure `wss://` connections from development-only `ws://` connections.

#### Scenario: Insecure development transport

- **WHEN** the user enters a plain `ws://` bridge URL
- **THEN** the app labels the connection insecure before pairing or connecting

### Requirement: Tailnet-private secure transport

The bridge CLI SHALL offer an explicit Tailscale Serve mode that retains a loopback listener, configures private HTTPS proxying at a product-specific path, and reports the corresponding MagicDNS `wss://` URL without enabling public Funnel access.

#### Scenario: Start through Tailscale

- **WHEN** the user starts a loopback bridge with `--tailscale` while Tailscale is running
- **THEN** the CLI configures the scoped HTTPS Serve mapping and prints the secure WebSocket URL accepted by the iOS app

#### Scenario: Reject unsafe Tailscale binding

- **WHEN** Tailscale mode is requested for a bridge configured to bind beyond loopback
- **THEN** the CLI rejects startup before configuring Serve

#### Scenario: Remove the Serve mapping

- **WHEN** the user runs the scoped Tailscale cleanup command
- **THEN** the CLI disables only the Mobile Dev Cockpit Serve path and leaves unrelated Serve mappings untouched
