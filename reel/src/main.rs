//! `reel` binary entry point. Wires the CLI to the library. Live/network-heavy
//! subcommands default to dry-run (printing the exact shell-out) so the binary
//! is safe to run without a render environment.

mod cli;

use std::path::Path;

use anyhow::{Context, Result};
use clap::Parser;

use reel::autopilot::{load_fixture_posts, run_autopilot_tick, AutopilotConfig};
use reel::autopilot_daemon::{run_autopilot_daemon, AutopilotDaemonConfig};
use reel::brief::normalize_from_value;
use reel::config::{load_project_urls, resolve_social_accounts};
use reel::engine::factory::create_renderer;
use reel::engine::render_pro::RenderProEngine;
use reel::engine::RenderEngine;
use reel::engine::RenderOptions;
use reel::marketing::{render_accepted_marketing_posts, RenderAcceptedOptions};
use reel::marketing_metrics::{
    sync_marketing_post_metrics, ChannelRoutingMetricsFetcher, MetricsSyncOptions,
};
use reel::marketing_posting::{create_poster, post_ready_marketing_videos, PostReadyOptions};
use reel::orchestrator::render_reel_variants;
use reel::publisher::NoopPublisher;
use reel::quality::{score_variant, ScoreInput};
use reel::runner::ProcessRunner;
use reel::saas_maker::stub::StubMarketingClient;
use reel::saas_maker::SaaSMakerClient;
use reel::templates::build_variant_plan;
use reel::watcher::{run_watch, WatchConfig};
use time::{format_description::well_known::Rfc3339, OffsetDateTime};

use cli::{Cli, Command, ConfigKind};

fn main() -> Result<()> {
    let cli = Cli::parse();
    match &cli.command {
        Command::Render(args) => cmd_render(&cli.repo_root, args),
        Command::Watch(args) => cmd_watch(&cli.repo_root, args),
        Command::Plan(args) => cmd_plan(args),
        Command::ValidateBrief(args) => cmd_validate(args),
        Command::Score(args) => cmd_score(args),
        Command::Config(args) => cmd_config(&cli.repo_root, args),
        Command::Autopilot(args) => cmd_autopilot(&cli.repo_root, args),
        Command::RenderAccepted(args) => cmd_render_accepted(&cli.repo_root, args),
        Command::Post(args) => cmd_post(&cli.repo_root, args),
        Command::Metrics(args) => cmd_metrics(&cli.repo_root, args),
    }
}

fn read_brief_value(path: &Path) -> Result<serde_json::Value> {
    let raw = std::fs::read_to_string(path)
        .with_context(|| format!("reading brief {}", path.display()))?;
    serde_json::from_str(&raw).with_context(|| format!("parsing brief json {}", path.display()))
}

fn cmd_render(repo_root: &Path, args: &cli::RenderArgs) -> Result<()> {
    let engine = RenderProEngine::new(ProcessRunner, repo_root);
    let execute = args.execute;
    for reel_id in &args.reel_ids {
        let spec = engine.command_for(reel_id, args.variant_count);
        if execute {
            println!("▸ rendering {reel_id}: {}", spec.display());
            let opts = RenderOptions {
                variant_count: args.variant_count,
                ..Default::default()
            };
            let result = engine.render_reel_by_id(reel_id, &opts)?;
            println!(
                "✓ {reel_id}: {} ({} log lines)",
                result.status.as_str(),
                result.render_log.len()
            );
        } else {
            println!(
                "[dry-run] would run (cwd={}): {}",
                repo_root.display(),
                spec.display()
            );
            println!(
                "          REEL_VARIANT_COUNT={}",
                spec.env
                    .get("REEL_VARIANT_COUNT")
                    .cloned()
                    .unwrap_or_default()
            );
        }
    }
    Ok(())
}

fn cmd_watch(repo_root: &Path, args: &cli::WatchArgs) -> Result<()> {
    run_watch(
        repo_root,
        &WatchConfig {
            worker_url: args.worker_url.clone(),
            interval_ms: args.interval_ms,
            max_per_tick: args.max_per_tick,
            variant_count: args.variant_count,
            once: args.once || !args.execute,
            execute: args.execute,
        },
        ProcessRunner,
    )
}

fn cmd_plan(args: &cli::BriefArgs) -> Result<()> {
    let value = read_brief_value(&args.brief)?;
    let brief = normalize_from_value(&value)?;
    let plan = build_variant_plan(&brief, args.variant_count);
    println!(
        "brief {}: project={} channel={} mode={}",
        brief.id, brief.project_slug, brief.channel, brief.render_mode
    );
    for entry in &plan {
        println!(
            "  {} → template={} ({})\n      hook: {}\n      cta:  {}",
            entry.variant_id,
            entry.template.id,
            entry.template.label,
            entry.hook,
            entry.cta.clone().unwrap_or_else(|| "(none)".into())
        );
    }
    Ok(())
}

fn cmd_validate(args: &cli::BriefArgs) -> Result<()> {
    let value = read_brief_value(&args.brief)?;
    let brief = normalize_from_value(&value)?;
    println!("{}", serde_json::to_string_pretty(&brief)?);
    eprintln!("✓ valid brief");
    Ok(())
}

fn cmd_score(args: &cli::BriefArgs) -> Result<()> {
    let value = read_brief_value(&args.brief)?;
    let brief = normalize_from_value(&value)?;
    let score = score_variant(&ScoreInput {
        hook: Some(brief.hook.clone()),
        cta: brief.cta.clone(),
        body: Some(brief.body.clone()),
        product_url: brief.product_url.clone(),
        proof_url: brief.proof_url.clone(),
        proof_type: brief
            .proof_type
            .clone()
            .or(Some("generated_card".to_string())),
        proof_path_count: brief.screenshots.as_ref().map(|s| s.len()).unwrap_or(0),
        aspect: "9:16".to_string(),
        duration_seconds: Some(brief.duration_seconds),
        render_failed: false,
        video_url: None,
    });
    println!("{}", serde_json::to_string_pretty(&score)?);
    Ok(())
}

fn cmd_autopilot(repo_root: &Path, args: &cli::AutopilotArgs) -> Result<()> {
    let now = OffsetDateTime::now_utc();
    let config = AutopilotConfig {
        hold_window_ms: args.hold_window_ms,
        intake_status: args.intake_status.clone(),
        created_at_field: args.created_at_field.clone(),
        limit: args.limit,
        render_mode: args.render_mode.clone(),
        posting_provider: args.posting_provider.clone(),
        ..Default::default()
    };

    if !args.execute {
        println!(
            "[dry-run] would run autopilot tick · render={} · posting={} · limit={}",
            config.render_mode, config.posting_provider, config.limit
        );
        if !args.once {
            println!(
                "[dry-run] would daemon loop every {}ms until SIGINT",
                args.interval_ms.max(15_000)
            );
        }
        return Ok(());
    }

    let poster = create_poster(&config.posting_provider, repo_root, now)?;
    let mut log = |message: &str| {
        println!("[{}] {message}", now.format(&Rfc3339).unwrap_or_default());
    };

    if let Some(fixture) = &args.fixture {
        let posts = load_fixture_posts(fixture)?;
        let client = StubMarketingClient::new(posts);
        let report = run_autopilot_tick(&client, repo_root, &poster, now, &config, &mut log)?;
        print_tick_summary(&report);
        if args.once {
            return Ok(());
        }
        return run_autopilot_daemon(
            repo_root,
            &poster,
            &client,
            &config,
            &AutopilotDaemonConfig {
                interval_ms: args.interval_ms,
            },
        );
    }

    let client = SaaSMakerClient::from_env();
    let report = run_autopilot_tick(&client, repo_root, &poster, now, &config, &mut log)?;
    print_tick_summary(&report);
    if args.once {
        return Ok(());
    }
    run_autopilot_daemon(
        repo_root,
        &poster,
        &client,
        &config,
        &AutopilotDaemonConfig {
            interval_ms: args.interval_ms,
        },
    )
}

fn print_tick_summary(report: &reel::autopilot::AutopilotTickReport) {
    println!(
        "✓ tick complete: accepted={} rendered={} posted={}",
        report.accepted.len(),
        report.rendered.results.len(),
        report.posted.results.len()
    );
}

fn cmd_render_accepted(repo_root: &Path, args: &cli::RenderAcceptedArgs) -> Result<()> {
    let options = RenderAcceptedOptions {
        limit: args.limit,
        project_slug: args.project_slug.clone(),
        channel: args.channel.clone(),
        poll_limit: args.poll_limit,
        poll_interval_ms: args.poll_interval_ms,
    };

    if !args.execute {
        println!(
            "[dry-run] would render accepted marketing posts · mode={} · limit={}",
            args.render_mode, args.limit
        );
        if args.fixture.is_some() {
            println!(
                "[dry-run] fixture={}",
                args.fixture.as_ref().unwrap().display()
            );
        } else {
            println!("[dry-run] requires SAASMAKER_SESSION_TOKEN for live SaaS Maker");
        }
        return Ok(());
    }

    let engine = create_renderer(&args.render_mode, repo_root, ProcessRunner)?;
    let publisher = reel::marketing::resolve_artifact_publisher(repo_root, ProcessRunner);

    let report = if let Some(fixture) = &args.fixture {
        let posts = load_fixture_posts(fixture)?;
        let client = StubMarketingClient::new(posts);
        render_accepted_marketing_posts(&client, &engine, &publisher, repo_root, &options)?
    } else {
        let client = SaaSMakerClient::from_env();
        render_accepted_marketing_posts(&client, &engine, &publisher, repo_root, &options)?
    };

    println!("{}", serde_json::to_string_pretty(&report)?);
    Ok(())
}

fn cmd_post(repo_root: &Path, args: &cli::PostArgs) -> Result<()> {
    if !args.execute {
        println!(
            "[dry-run] would post ready marketing videos · provider={} · limit={}",
            args.posting_provider, args.limit
        );
        return Ok(());
    }
    let now = OffsetDateTime::now_utc();
    let poster = create_poster(&args.posting_provider, repo_root, now)?;
    let options = PostReadyOptions {
        limit: args.limit,
        project_slug: args.project_slug.clone(),
        channel: args.channel.clone(),
        include_unscheduled: args.include_unscheduled,
        missed_only: args.missed_only,
        confirm_post: true,
    };
    let report = if let Some(fixture) = &args.fixture {
        let posts = load_fixture_posts(fixture)?;
        let client = StubMarketingClient::new(posts);
        post_ready_marketing_videos(&client, &poster, now, &options)?
    } else {
        let client = SaaSMakerClient::from_env();
        post_ready_marketing_videos(&client, &poster, now, &options)?
    };
    println!("{}", serde_json::to_string_pretty(&report)?);
    Ok(())
}

fn cmd_metrics(repo_root: &Path, args: &cli::MetricsArgs) -> Result<()> {
    if !args.execute {
        println!(
            "[dry-run] would sync sent post metrics · status={} · limit={}",
            args.status, args.limit
        );
        if args.fixture.is_some() {
            println!(
                "[dry-run] fixture={}",
                args.fixture.as_ref().unwrap().display()
            );
        } else {
            println!(
                "[dry-run] requires SAASMAKER_SESSION_TOKEN plus configured YouTube/Instagram accounts"
            );
        }
        return Ok(());
    }

    let now = OffsetDateTime::now_utc();
    let options = MetricsSyncOptions {
        limit: args.limit,
        project_slug: args.project_slug.clone(),
        channel: args.channel.clone(),
        status: args.status.clone(),
        confirm_sync: true,
    };
    let fetcher = ChannelRoutingMetricsFetcher::from_config(repo_root)?;
    let report = if let Some(fixture) = &args.fixture {
        let posts = load_fixture_posts(fixture)?;
        let client = StubMarketingClient::new(posts);
        sync_marketing_post_metrics(&client, &fetcher, now, &options)?
    } else {
        let client = SaaSMakerClient::from_env();
        sync_marketing_post_metrics(&client, &fetcher, now, &options)?
    };
    println!("{}", serde_json::to_string_pretty(&report)?);
    Ok(())
}

fn cmd_config(repo_root: &Path, args: &cli::ConfigArgs) -> Result<()> {
    match args.which {
        ConfigKind::ProjectUrls => {
            let path = args
                .path
                .clone()
                .unwrap_or_else(|| repo_root.join("config/project-urls.json"));
            let urls = load_project_urls(&path)?;
            for (slug, url) in &urls {
                println!("{slug} → {url}");
            }
        }
        ConfigKind::SocialAccounts => {
            let path = args
                .path
                .clone()
                .unwrap_or_else(|| repo_root.join("config/social-accounts.json"));
            let raw = std::fs::read_to_string(&path)
                .with_context(|| format!("reading social accounts {}", path.display()))?;
            let cfg = resolve_social_accounts(&raw, |k| std::env::var(k).ok())?;
            println!(
                "youtube accounts: {}",
                cfg.youtube.keys().cloned().collect::<Vec<_>>().join(", ")
            );
            println!(
                "instagram accounts: {}",
                cfg.instagram.keys().cloned().collect::<Vec<_>>().join(", ")
            );
        }
    }
    Ok(())
}

#[allow(unused_imports)]
use reel::orchestrator::RenderReport as _RenderReport;
#[allow(dead_code)]
fn _orchestrator_link() {
    let _ = render_reel_variants::<RenderProEngine<ProcessRunner>, NoopPublisher>;
}
