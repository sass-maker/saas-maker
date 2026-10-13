# GitStat — SaaS Maker tool

GitHub activity, contributions and code churn analysis, retained in SaaS Maker
tooling after the October 9, 2026 absorption decision. It has no independent product roadmap. The existing React
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

The local proxy makes anonymous public GitHub requests and does not load tokens
or owner environment files. The imported dashboard does not execute the retired
GitStat Clarity, newsletter, Fleet footer or App Health browser trackers. Original
host metadata and optional server-monitoring files remain retained source; they
do not establish an active deployment or restore independent product policy.
