# GitStat — SaaS Maker tool

GitHub activity, contributions and code churn analysis, absorbed into SaaS Maker
on October 9, 2026. It has no independent product roadmap. The existing React
dashboard and GitHub request/analysis implementation are preserved here.

Source: sass-maker/gitstat at ff78cd743a7574296ee9bf45a9b454fed4de1cfe.
The original checkout and existing hosted site remain retained; no deployment,
DNS change, owner-data movement or provider decommission accompanies this import.

Install the SaaS Maker workspace with its pinned pnpm and frozen lockfile
through Fleet Workspace. From the repository root run `pnpm --filter gitstat dev`
for the local dashboard, `pnpm --filter gitstat build` for a static build, and
`pnpm --filter gitstat test:lookup` for request-state qualification. The local Vite proxy supports credential-free public GitHub
requests; provider rate limits remain explicit. No production deploy command
is exposed here. The retained Pages Functions are source, not a new deployment.
