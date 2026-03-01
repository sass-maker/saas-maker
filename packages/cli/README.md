# @saas-maker/cli

Command-line tool for managing SaaS Maker projects.

## Install

```bash
npm install -g @saas-maker/cli
# or use directly with npx
npx @saas-maker/cli
```

## Setup

```bash
# Save your API key
saasmaker login

# Link a project to the current directory
saasmaker init
```

## Commands

### `saasmaker login`

Prompts for your API key and saves it to `~/.saasmaker/config.json`.

### `saasmaker whoami`

Shows current authentication status and linked project.

### `saasmaker init`

Lists your projects and writes a `.saasmaker.json` file to the current directory, linking it to the selected project.

### `saasmaker projects list`

Lists all projects with name, slug, and creation date.

### `saasmaker projects create`

Prompts for a project name and creates a new project.

### `saasmaker status`

Shows stats for the linked project (feedback count, waitlist signups).

### `saasmaker keys`

Displays the API key for the current project.

## Configuration

### Global config (`~/.saasmaker/config.json`)

```json
{
  "apiKey": "pk_...",
  "apiBaseUrl": "https://api.saasmaker.dev"
}
```

### Project config (`.saasmaker.json`)

Created by `saasmaker init` in your project directory:

```json
{
  "projectId": "pk_...",
  "slug": "my-app"
}
```

### Environment variables

| Variable | Description |
|----------|-------------|
| `SAASMAKER_API_URL` | Override the API base URL |
