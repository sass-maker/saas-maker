---
title: CLI
description: Manage SaaS Maker projects from the terminal.
---

The SaaS Maker CLI lets you manage projects, view API keys, and check service stats from the terminal.

## Installation

```bash
npm install -g @saas-maker/cli
```

## Authentication

```bash
saasmaker login
```

Opens your browser for Google OAuth. Once authenticated, the session token is saved locally.

## Commands

### `login`

Authenticate with Google OAuth. Opens a browser window for sign-in.

```bash
saasmaker login
```

### `whoami`

Show the currently authenticated user.

```bash
saasmaker whoami
```

### `projects list`

List all your projects.

```bash
saasmaker projects list
```

### `projects create`

Create a new project interactively.

```bash
saasmaker projects create
```

### `init`

Link the current directory to a SaaS Maker project. Creates a `.saasmaker.json` config file.

```bash
saasmaker init
```

### `keys`

Show the API key for the linked project.

```bash
saasmaker keys
```

### `status`

Show stats for the linked project (feedback count, waitlist entries, etc.).

```bash
saasmaker status
```
