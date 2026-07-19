//! Production render watcher — replaces `scripts/auto-render-watcher.js`.
//!
//! Polls the worker for approved-but-unrendered reels and runs
//! `node scripts/render-pro.js <reelId>` serially (one render at a time).

use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread;
use std::time::{Duration, Instant};

use anyhow::Result;

use crate::engine::render_pro::RenderProEngine;
use crate::engine::{RenderEngine, RenderOptions};
use crate::runner::CommandRunner;
use crate::worker_client::{needs_render, ReelRecord, WorkerClient};

const MIN_INTERVAL_MS: u64 = 5_000;

#[derive(Debug, Clone)]
pub struct WatchConfig {
    pub worker_url: Option<String>,
    pub interval_ms: u64,
    pub max_per_tick: usize,
    pub variant_count: usize,
    pub once: bool,
    pub execute: bool,
}

impl WatchConfig {
    pub fn interval_ms(&self) -> u64 {
        self.interval_ms.max(MIN_INTERVAL_MS)
    }

    pub fn max_per_tick(&self) -> usize {
        self.max_per_tick.max(1)
    }
}

pub fn run_watch<R: CommandRunner>(
    repo_root: &Path,
    config: &WatchConfig,
    runner: R,
) -> Result<()> {
    let client = WorkerClient::from_env_or_default(config.worker_url.clone());
    let interval = Duration::from_millis(config.interval_ms());
    let engine = RenderProEngine::new(runner, repo_root);

    let stop = Arc::new(AtomicBool::new(false));
    let stop_flag = stop.clone();
    ctrlc::set_handler(move || {
        eprintln!("\n▸ signal received — finishing current render then exiting");
        stop_flag.store(true, Ordering::SeqCst);
    })?;

    if config.execute {
        println!(
            "▸ auto-render-watcher started · worker={} · interval={}ms{}",
            client.base_url(),
            interval.as_millis(),
            if config.once { " · once" } else { "" }
        );
    } else {
        println!(
            "[dry-run] poll {} · interval={}ms{} · for each approved+unrendered reel:",
            client.base_url(),
            interval.as_millis(),
            if config.once { " · once" } else { "" }
        );
        println!("          run `node scripts/render-pro.js <reelId>` (serially)");
    }

    loop {
        if stop.load(Ordering::SeqCst) {
            break;
        }

        match tick(&client, &engine, config, stop.clone()) {
            Ok(()) => {}
            Err(err) => eprintln!("! tick error: {err:#}"),
        }

        if config.once || stop.load(Ordering::SeqCst) {
            break;
        }

        thread::sleep(interval);
    }

    if config.execute {
        println!("▸ watcher stopped");
    }
    Ok(())
}

fn tick<R: CommandRunner>(
    client: &WorkerClient,
    engine: &RenderProEngine<R>,
    config: &WatchConfig,
    stop: Arc<AtomicBool>,
) -> Result<()> {
    let approved = client.fetch_approved()?;
    let candidates: Vec<ReelRecord> = approved.into_iter().filter(needs_render).collect();

    if candidates.is_empty() {
        log("no approved+unrendered reels");
        return Ok(());
    }

    let batch: Vec<_> = candidates.into_iter().take(config.max_per_tick()).collect();

    if !config.execute {
        for reel in &batch {
            let spec = engine.command_for(&reel.id, config.variant_count);
            println!(
                "[dry-run] would render {} ({}): {}",
                reel.id,
                reel.project_slug.as_deref().unwrap_or("?"),
                spec.display()
            );
        }
        return Ok(());
    }

    for reel in batch {
        if stop.load(Ordering::SeqCst) {
            break;
        }
        render_one(engine, &reel, config.variant_count)?;
    }
    Ok(())
}

fn render_one<R: CommandRunner>(
    engine: &RenderProEngine<R>,
    reel: &ReelRecord,
    variant_count: usize,
) -> Result<()> {
    let label = reel
        .title
        .as_deref()
        .or(reel.project_slug.as_deref())
        .unwrap_or("?");
    log(&format!("rendering {} ({label})…", reel.id));
    let start = Instant::now();
    let opts = RenderOptions {
        variant_count,
        ..Default::default()
    };
    match engine.render_reel_by_id(&reel.id, &opts) {
        Ok(_) => {
            let secs = start.elapsed().as_secs_f64();
            log(&format!("✓ {} rendered in {secs:.1}s", reel.id));
        }
        Err(err) => {
            let secs = start.elapsed().as_secs_f64();
            log(&format!(
                "× {} render failed after {secs:.1}s: {err:#}",
                reel.id
            ));
        }
    }
    Ok(())
}

fn log(message: &str) {
    let now = time::OffsetDateTime::now_utc()
        .format(&time::format_description::well_known::Rfc3339)
        .unwrap_or_else(|_| "unknown".into());
    println!("[{now}] {message}");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn watch_config_clamps_interval_and_batch() {
        let cfg = WatchConfig {
            worker_url: None,
            interval_ms: 100,
            max_per_tick: 0,
            variant_count: 1,
            once: true,
            execute: false,
        };
        assert_eq!(cfg.interval_ms(), MIN_INTERVAL_MS);
        assert_eq!(cfg.max_per_tick(), 1);
    }
}
