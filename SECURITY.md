# Security Policy

## Reporting

Please do not open a public issue for security reports.

Send a private report to the repository owner with:

- affected package, app, or worker
- reproduction steps
- expected impact
- any relevant logs with secrets removed

## Secrets

Never commit API keys, tokens, SSH keys, `.env` files, Cloudflare credentials, GitHub credentials, or production config. If a secret is exposed, rotate it immediately and remove it from history if it was committed.

## Supported Versions

This repository is under active development. Security fixes target `main` unless a separate supported release branch is announced.
