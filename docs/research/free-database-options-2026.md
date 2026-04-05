# Free Database Options for Cloudflare Workers (2025-2026)

Research Date: 2026-03-16
Context: Migrating FROM CockroachDB, using Cloudflare Workers + Hyperdrive

---

## EXECUTIVE SUMMARY

**Top 3 Recommendations for your use case (Cloudflare Workers + Hyperdrive + small SaaS):**

1. **Neon** -- Best overall. Native Postgres, explicit Cloudflare Hyperdrive support, generous 100 CU-hours/month, scale-to-zero. The safe choice.
2. **Xata** -- Best free tier by storage (15 GB). Postgres-wire compatible, explicit Hyperdrive integration documented by Cloudflare. No cold starts, no pausing. Hidden gem.
3. **Turso** -- Best if you can use SQLite/libSQL. 9 GB storage, 1B reads/month. Not Hyperdrive-compatible (uses HTTP, not Postgres wire protocol) but has its own edge replication. Requires schema migration from Postgres.

**Runner-up:** Nile (1 GB, 50M query tokens, no cold starts, multi-tenant native) -- interesting for B2B SaaS but still in public preview.

---

## HYPERDRIVE COMPATIBILITY MATRIX

Hyperdrive supports **PostgreSQL 9.0-17.x** and **MySQL 5.7-8.x** (including MariaDB).

Explicitly supported providers in Cloudflare docs:
- Neon (Postgres)
- Supabase (Postgres)
- CockroachDB (Postgres-compatible)
- Xata (Postgres)
- Timescale (Postgres)
- Materialize (Postgres-compatible)
- AWS Aurora (Postgres and MySQL)
- PlanetScale (MySQL -- but no free tier)
- MariaDB (MySQL-compatible)

**NOT supported by Hyperdrive:**
- Turso (libSQL/SQLite -- uses HTTP protocol, not Postgres wire)
- Cloudflare D1 (SQLite -- native to Workers, no Hyperdrive needed)
- MongoDB (not supported)
- SQL Server (not supported)
- DuckDB/MotherDuck (not supported)
- Redis/Upstash (not a relational DB, different protocol)

**Important Hyperdrive note:** Hyperdrive is now available on the Workers Free plan (as of April 2025), but with limited usage. The Workers Paid plan ($5/month) gives full Hyperdrive access.

---

## TIER 1: BEST OPTIONS (Production-viable, Hyperdrive-compatible)

### 1. Neon (PostgreSQL)
- **Free Tier:** YES, permanent
- **Storage:** 0.5 GB per project (up to 100 projects, 5 GB aggregate)
- **Compute:** 100 CU-hours/project/month (doubled from 50 in Oct 2025)
- **Branches:** 10 per project
- **Data Transfer:** 5 GB/month
- **Connections:** Shared compute, up to 2 CU (8 GB RAM) autoscaling
- **Hyperdrive:** YES -- explicitly documented by Cloudflare
- **SQL Dialect:** PostgreSQL (native)
- **Scale to Zero:** YES, suspends after 5 min inactivity (cannot disable on free plan)
- **Cold Start:** ~500ms-2s on wake from suspension
- **Gotchas:**
  - 0.5 GB per project is tight for production
  - Cannot disable scale-to-zero on free plan (causes cold starts)
  - 6-hour PITR window, 1 GB change history cap
  - Community support only
  - When limits exceeded, compute suspends (no surprise charges)
- **Status (2026):** Active, improving. Free tier doubled in Oct 2025.
- **Migration from CockroachDB:** Straightforward -- both are Postgres-compatible. Minor SQL syntax differences possible.

### 2. Xata (PostgreSQL)
- **Free Tier:** YES, permanent
- **Storage:** 15 GB (most generous Postgres free tier available)
- **Compute:** Shared (not explicitly metered)
- **Connections:** 15 concurrent (6 primary + 9 replicas)
- **Request Rate:** 75 req/sec cap
- **Hyperdrive:** YES -- explicitly documented by Cloudflare
- **SQL Dialect:** PostgreSQL (native, connect with any Postgres client)
- **Scale to Zero:** NO -- always on, no cold starts, no pausing
- **Gotchas:**
  - 75 req/sec rate limit could be restrictive under load
  - 15 concurrent connections is low
  - Search APIs and Files APIs removed from free tier (Jan 2025)
  - Inactive databases moved to cold storage cell (re-activated on access)
  - Less well-known, smaller community
- **Status (2026):** Active. Made changes to free tier in Jan 2025 (removed search/files APIs) but core Postgres remains.
- **Migration from CockroachDB:** Easy -- standard Postgres wire protocol.

### 3. Supabase (PostgreSQL)
- **Free Tier:** YES, permanent
- **Storage:** 500 MB database + 1 GB file storage
- **Compute:** Shared CPU
- **Bandwidth:** 5 GB egress/month
- **MAU:** 50,000
- **Projects:** 2 active free projects max
- **Hyperdrive:** YES -- explicitly documented by Cloudflare
- **SQL Dialect:** PostgreSQL (native, full Postgres feature support)
- **Scale to Zero:** Projects PAUSE after 7 days of inactivity
- **Gotchas:**
  - **Pausing is the killer issue** -- production SaaS cannot afford 7-day inactivity pauses
  - 500 MB is very small for production
  - Need to set up GitHub Actions cron to prevent pausing (hacky)
  - 1-day log retention
  - Paused projects can be restored from dashboard but downtime occurs
- **Status (2026):** Active, stable. Pausing policy unchanged.
- **Migration from CockroachDB:** Easy -- standard Postgres.

### 4. Aiven (PostgreSQL)
- **Free Tier:** YES, permanent, no credit card
- **Storage:** 5 GB
- **Compute:** 1 GB RAM, 1 CPU
- **Connections:** 20 max
- **Hyperdrive:** Should work (standard Postgres) -- not explicitly documented by Cloudflare but uses standard Postgres wire protocol
- **SQL Dialect:** PostgreSQL (native)
- **Scale to Zero:** NO (always on, dedicated VM)
- **Gotchas:**
  - Single node only (no HA)
  - May shut down if unused for extended period (policy unclear)
  - 20 connections is very limiting
  - Only 1 free service per account
- **Status (2026):** Active. Solid offering from a major provider.
- **Migration from CockroachDB:** Easy -- standard Postgres.

---

## TIER 2: VIABLE BUT WITH TRADE-OFFS

### 5. TiDB Cloud Starter (MySQL-compatible)
- **Free Tier:** YES, permanent
- **Storage:** 25 GB row + 25 GB columnar (per org, across up to 5 clusters)
- **Compute:** 250M Request Units/month
- **Hyperdrive:** YES (MySQL-compatible, Hyperdrive supports MySQL)
- **SQL Dialect:** MySQL-compatible (NOT Postgres)
- **Gotchas:**
  - **Requires rewrite from Postgres to MySQL** -- significant migration effort
  - No stored procedures
  - Limited MySQL feature support
  - Supports Cloudflare Workers natively via MySQL driver
- **Status (2026):** Active. Rebranded to "TiDB Cloud Starter" in Aug 2025.
- **Migration from CockroachDB:** Hard -- need to convert from Postgres-compatible SQL to MySQL.

### 6. Turso (libSQL/SQLite)
- **Free Tier:** YES, permanent ("Starter" plan)
- **Storage:** 9 GB (some sources say 5 GB -- check current pricing page)
- **Databases:** 500 in 3 locations
- **Reads:** 1 billion rows/month
- **Writes:** 25 million rows/month
- **Hyperdrive:** NO -- uses HTTP protocol, not Postgres/MySQL wire protocol
- **SQL Dialect:** SQLite (libSQL fork)
- **Edge Replication:** YES -- built-in, databases replicated to edge locations
- **Gotchas:**
  - **Not Hyperdrive-compatible** -- connect via HTTP SDK (@libsql/client)
  - **Requires complete schema rewrite** from Postgres to SQLite
  - Scale-to-zero deprecated for new users (Jan 2026) -- now "no cold starts" on AWS
  - SQLite has different type system, no JSONB, different date handling
  - Works great with Cloudflare Workers via HTTP but loses Hyperdrive caching benefits
- **Status (2026):** Active but undergoing platform changes (migrating from Fly to AWS).
- **Migration from CockroachDB:** Hard -- complete schema and query rewrite needed.

### 7. Cloudflare D1 (SQLite)
- **Free Tier:** YES, permanent (Workers Free plan)
- **Storage:** 5 GB total (500 MB per database, 10 databases)
- **Reads:** 5 million rows/day
- **Writes:** 100,000 rows/day
- **Hyperdrive:** N/A -- native to Workers, no proxy needed
- **SQL Dialect:** SQLite
- **Gotchas:**
  - **Daily limits, not monthly** -- resets at 00:00 UTC
  - 100K writes/day could be limiting for active SaaS
  - SQLite dialect requires schema rewrite from Postgres
  - When daily limits exceeded, ALL queries fail until reset
  - No data transfer charges
- **Status (2026):** Active, GA. Limits enforced since Feb 2025.
- **Migration from CockroachDB:** Hard -- SQLite schema rewrite.

### 8. Nile (PostgreSQL, multi-tenant native)
- **Free Tier:** YES, permanent
- **Storage:** 1 GB
- **Compute:** 50 million query tokens/month
- **Databases:** Unlimited
- **Connections:** 500
- **Hyperdrive:** Should work (standard Postgres wire protocol) -- not explicitly tested
- **SQL Dialect:** PostgreSQL (native)
- **Scale to Zero:** NO -- no cold starts, always available
- **Gotchas:**
  - **Still in public preview** -- not fully production-ready
  - 1 GB storage is small
  - Single region only on free tier
  - No SLA on free tier
  - Built for multi-tenant B2B SaaS -- great fit if that is your model
  - No workspace sharing on free tier
- **Status (2026):** Public preview. Promising but risky for production.
- **Migration from CockroachDB:** Easy -- standard Postgres with added tenant concepts.

### 9. Koyeb (PostgreSQL)
- **Free Tier:** YES, permanent, no credit card
- **Storage:** 1 GB
- **Compute:** 0.25 vCPU, 1 GB RAM, 5 free compute hours/month (or 50 hours -- conflicting sources)
- **Hyperdrive:** Should work (standard Postgres) -- not explicitly documented
- **SQL Dialect:** PostgreSQL (versions 14-16)
- **Extensions:** pgVector, PostGIS, TimescaleDB
- **Gotchas:**
  - Auto-sleeps after 5 minutes of inactivity
  - Very limited compute hours on free tier
  - Regions: US (DC), EU (Frankfurt), Asia (Singapore)
- **Status (2026):** Active. Postgres went GA recently.
- **Migration from CockroachDB:** Easy -- standard Postgres.

---

## TIER 3: LIMITED OR NOT RECOMMENDED FOR YOUR USE CASE

### 10. CockroachDB (Postgres-compatible) -- CURRENT DB
- **Free Tier:** YES, permanent
- **Storage:** 10 GiB
- **Compute:** 50M Request Units/month
- **Hyperdrive:** YES -- explicitly supported
- **Note:** You are migrating away from this. Included for reference. The free tier is generous but the licensing changes (no more free Core for orgs >$10M revenue) and operational complexity may be factors.

### 11. Tembo (PostgreSQL)
- **Free Tier:** YES (Hobby tier), no credit card
- **Storage:** 10 GiB
- **Compute:** 0.25 CPU, 1 GiB RAM
- **Hyperdrive:** Should work (standard Postgres)
- **Gotchas:**
  - **Runs on Spot instances** -- can be interrupted ~10 min/day
  - No uptime SLA
  - Not suitable for production due to spot interruptions
- **Status (2026):** Active but hobby tier has reliability issues by design.

### 12. Crunchy Data / Crunchy Bridge (PostgreSQL)
- **Free Tier:** NO true free tier. Hobby starts at $10/month.
- **Note:** Can combine hobby tier with suspend/resume to minimize costs, but not free.

### 13. YugabyteDB (Postgres-compatible)
- **Free Tier:** YES, "free forever"
- **Storage:** 10 GB OS storage
- **Compute:** 2 GB RAM, 1 vCPU
- **Hyperdrive:** Should work (Postgres-compatible)
- **Gotchas:**
  - **Account deleted after 14 days of inactivity** -- CRITICAL
  - Single machine setup
- **Status (2026):** Active but the 14-day deletion policy is a dealbreaker.

### 14. pgEdge (Distributed PostgreSQL)
- **Free Tier:** YES (Developer Edition)
- **Storage:** 12 GB across 3 nodes
- **Architecture:** 3-node multi-master (active-active) with conflict resolution
- **Regions:** US, US+EU, US+EU+Asia presets
- **Hyperdrive:** Should work (standard Postgres)
- **Gotchas:**
  - Relatively new/unknown
  - Free tier is for "prototyping and evaluation"
  - Limited documentation
- **Status (2026):** Active. Interesting for geo-distributed use cases.

### 15. Gel (formerly EdgeDB) (PostgreSQL-based)
- **Free Tier:** YES
- **Storage:** 1 GB
- **Compute:** 1/4 compute unit
- **Network:** 2 GiB egress
- **Hyperdrive:** Unclear -- EdgeDB uses its own query language (EdgeQL), not standard Postgres wire protocol
- **Gotchas:**
  - Uses EdgeQL, not standard SQL -- massive rewrite needed
  - Rebranded from EdgeDB to Gel (confusing)
- **Status (2026):** Active but niche.

### 16. SingleStore (MySQL-compatible)
- **Free Tier:** YES, permanent ("Free Shared Tier")
- **Storage:** Not clearly documented
- **Hyperdrive:** Possibly (MySQL-compatible) -- not tested
- **Gotchas:**
  - Primarily OLAP/analytics focused
  - MySQL-compatible, not Postgres
  - Idle databases detach from compute
- **Status (2026):** Active. Has PlanetScale migration tool.

### 17. MotherDuck (DuckDB)
- **Free Tier:** YES, permanent
- **Storage:** 10 GB
- **Compute:** 10 CU-hours/month
- **Hyperdrive:** NO -- DuckDB, not Postgres/MySQL
- **Gotchas:** Analytics/OLAP focused, not for transactional SaaS workloads.

### 18. Render (PostgreSQL)
- **Free Tier:** YES but **expires after 30 days**
- **Storage:** 1 GB
- **Gotchas:** 30-day expiration + 14-day grace period then DELETION. Not viable for production.

### 19. Railway (PostgreSQL)
- **Free Tier:** NO permanent free tier. 30-day trial with $5 credits.
- **Note:** Hobby plan is $5/month after trial.

### 20. Fly.io (PostgreSQL)
- **Free Tier:** Effectively NO for new users. Legacy free tier may still exist for old accounts.
- **Note:** Managed Postgres (MPG) starts at $38/month.

### 21. ElephantSQL (PostgreSQL)
- **Free Tier:** YES but only 20 MB storage, 5 connections. Useless for production.

### 22. SQLite Cloud (SQLite)
- **Free Tier:** YES
- **Storage:** 1 GB
- **Gotchas:** Stops after 12 hours of inactivity. No backups. Beta status.

---

## COMPARISON TABLE: TOP CANDIDATES

| Provider | Dialect | Storage | Compute/Limits | Hyperdrive | Pauses? | Cold Start? | Production-Viable? |
|----------|---------|---------|----------------|------------|---------|-------------|-------------------|
| **Neon** | Postgres | 0.5 GB/project | 100 CU-hrs/mo | YES | After 5 min | ~1-2s wake | YES (small scale) |
| **Xata** | Postgres | 15 GB | 75 req/s cap | YES | NO | NO | YES |
| **Supabase** | Postgres | 500 MB | Shared CPU | YES | After 7 days | On restore | RISKY (pausing) |
| **Aiven** | Postgres | 5 GB | 1 CPU, 1GB RAM | Likely | NO | NO | YES |
| **TiDB** | MySQL | 25 GB | 250M RU/mo | YES (MySQL) | NO | NO | YES (if MySQL ok) |
| **Turso** | SQLite | 9 GB | 1B reads/mo | NO | Deprecated | NO (new) | YES (if SQLite ok) |
| **D1** | SQLite | 5 GB | 5M reads/day | N/A (native) | NO | NO | MAYBE (daily limits) |
| **Nile** | Postgres | 1 GB | 50M tokens/mo | Likely | NO | NO | RISKY (preview) |
| **CockroachDB** | Postgres* | 10 GiB | 50M RU/mo | YES | NO | NO | YES (current DB) |

---

## MIGRATION DIFFICULTY FROM COCKROACHDB

**Easy (Postgres-compatible wire protocol):**
- Neon, Xata, Supabase, Aiven, Nile, Koyeb, pgEdge, Tembo
- Mostly pg_dump/pg_restore or direct migration
- Minor SQL dialect differences possible (CockroachDB has some non-standard behaviors)

**Medium (MySQL, needs query rewrite):**
- TiDB, SingleStore

**Hard (Different paradigm entirely):**
- Turso, D1, SQLite Cloud (SQLite -- different type system, no JSONB, etc.)
- Gel/EdgeDB (EdgeQL, not SQL)
- MotherDuck (DuckDB, analytics-only)

---

## FINAL RECOMMENDATION

For a small SaaS on Cloudflare Workers with Hyperdrive, migrating from CockroachDB:

**If storage needs are under 0.5 GB:** Go with **Neon**. It is the most mature, best-documented option with explicit Cloudflare Hyperdrive support. The 100 CU-hours/month is generous. Cold starts from scale-to-zero (5 min idle) are the only annoyance.

**If you need more storage (up to 15 GB):** Go with **Xata**. The 15 GB free tier is extraordinary. No cold starts, no pausing. Explicitly supported by Hyperdrive. The 75 req/sec rate limit and 15 concurrent connections are the constraints to watch.

**If you want always-on with decent storage:** Consider **Aiven** (5 GB, always-on, standard Postgres). Less flashy but reliable.

**If you are willing to leave Postgres behind:** **Turso** (9 GB, edge-native) or **D1** (5 GB, zero-latency from Workers) are compelling if you can handle the SQLite migration.

**Stay on CockroachDB** if the current setup works. Its 10 GiB free tier is actually generous, and it is explicitly Hyperdrive-compatible. The main reason to leave would be operational complexity or licensing concerns.
