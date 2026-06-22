//! Autopilot daemon loop — mirrors `scripts/marketing-autopilot.js`.

use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread;
use std::time::Duration;

use anyhow::Result;
use time::{format_description::well_known::Rfc3339, OffsetDateTime};

use crate::marketing_posting::MarketingPoster;
use crate::saas_maker::MarketingClient;

use crate::autopilot::{run_autopilot_tick, AutopilotConfig, AutopilotTickReport};

pub struct AutopilotDaemonConfig {
    pub interval_ms: u64,
}

pub fn run_autopilot_daemon<C, P>(
    repo_root: &Path,
    poster: &P,
    client: &C,
    autopilot: &AutopilotConfig,
    daemon: &AutopilotDaemonConfig,
) -> Result<()>
where
    C: MarketingClient,
    P: MarketingPoster,
{
    let stop = Arc::new(AtomicBool::new(false));
    let stop_flag = stop.clone();
    ctrlc::set_handler(move || {
        eprintln!("\n▸ signal received — finishing current tick then exiting");
        stop_flag.store(true, Ordering::SeqCst);
    })?;

    let interval = Duration::from_millis(daemon.interval_ms.max(15_000));
    println!(
        "▸ autopilot daemon · interval={}ms (Ctrl+C to stop)",
        interval.as_millis()
    );

    loop {
        if stop.load(Ordering::SeqCst) {
            break;
        }

        let now = OffsetDateTime::now_utc();
        let mut log = |message: &str| {
            println!(
                "[{}] {message}",
                now.format(&Rfc3339).unwrap_or_default()
            );
        };

        match run_autopilot_tick(client, repo_root, poster, now, autopilot, &mut log) {
            Ok(report) => print_tick_summary(&report),
            Err(err) => eprintln!("! tick error: {err:#}"),
        }

        if stop.load(Ordering::SeqCst) {
            break;
        }

        thread::sleep(interval);
    }

    println!("▸ autopilot stopped");
    Ok(())
}

fn print_tick_summary(report: &AutopilotTickReport) {
    println!(
        "✓ tick: accepted={} rendered={} posted={}",
        report.accepted.len(),
        report.rendered.results.len(),
        report.posted.results.len()
    );
}
