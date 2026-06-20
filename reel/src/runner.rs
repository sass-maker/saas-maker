//! Command runner abstraction.
//!
//! Every heavy operation in this pipeline is ultimately a child process
//! (`node scripts/render-pro.js`, `ffmpeg`, `npx wrangler r2 object put`, …).
//! The Node glue wraps these in `execFile`/`spawn`; we wrap them in a
//! [`CommandRunner`] trait so the orchestration is testable with a recording
//! fake and the real impl is a thin `std::process::Command` wrapper.

use std::collections::BTreeMap;
use std::path::PathBuf;
use std::process::Command;

use anyhow::{anyhow, Result};

/// One command invocation.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CommandSpec {
    pub program: String,
    pub args: Vec<String>,
    pub cwd: Option<PathBuf>,
    pub env: BTreeMap<String, String>,
}

impl CommandSpec {
    pub fn new(program: impl Into<String>, args: impl IntoIterator<Item = impl Into<String>>) -> Self {
        Self {
            program: program.into(),
            args: args.into_iter().map(Into::into).collect(),
            cwd: None,
            env: BTreeMap::new(),
        }
    }

    pub fn cwd(mut self, dir: impl Into<PathBuf>) -> Self {
        self.cwd = Some(dir.into());
        self
    }

    pub fn env(mut self, key: impl Into<String>, value: impl Into<String>) -> Self {
        self.env.insert(key.into(), value.into());
        self
    }

    /// Human-readable form for logs (no shell escaping — display only).
    pub fn display(&self) -> String {
        let mut parts = vec![self.program.clone()];
        parts.extend(self.args.iter().cloned());
        parts.join(" ")
    }
}

#[derive(Debug, Clone)]
pub struct CommandOutput {
    pub status: i32,
    pub stdout: String,
    pub stderr: String,
}

impl CommandOutput {
    pub fn ok(&self) -> bool {
        self.status == 0
    }
}

pub trait CommandRunner {
    fn run(&self, spec: &CommandSpec) -> Result<CommandOutput>;
}

/// Real implementation backed by `std::process::Command`.
pub struct ProcessRunner;

impl CommandRunner for ProcessRunner {
    fn run(&self, spec: &CommandSpec) -> Result<CommandOutput> {
        let mut cmd = Command::new(&spec.program);
        cmd.args(&spec.args);
        if let Some(cwd) = &spec.cwd {
            cmd.current_dir(cwd);
        }
        for (k, v) in &spec.env {
            cmd.env(k, v);
        }
        let output = cmd
            .output()
            .map_err(|e| anyhow!("failed to spawn `{}`: {e}", spec.program))?;
        Ok(CommandOutput {
            status: output.status.code().unwrap_or(-1),
            stdout: String::from_utf8_lossy(&output.stdout).into_owned(),
            stderr: String::from_utf8_lossy(&output.stderr).into_owned(),
        })
    }
}

/// Test helpers (a recording fake [`CommandRunner`]). Always compiled so both
/// the crate's own unit tests and external integration tests can use it; it has
/// no runtime cost unless instantiated.
#[doc(hidden)]
#[allow(dead_code)]
pub mod testing {
    use super::*;
    use std::cell::RefCell;

    /// Records every spec it is asked to run and returns scripted outputs.
    /// Used by orchestration tests to assert the exact commands the Rust glue
    /// would shell out, without executing anything.
    pub struct RecordingRunner {
        pub calls: RefCell<Vec<CommandSpec>>,
        pub responses: RefCell<Vec<Result<CommandOutput, String>>>,
    }

    impl RecordingRunner {
        pub fn new() -> Self {
            Self {
                calls: RefCell::new(Vec::new()),
                responses: RefCell::new(Vec::new()),
            }
        }

        pub fn with_response(self, status: i32, stdout: &str) -> Self {
            self.responses.borrow_mut().push(Ok(CommandOutput {
                status,
                stdout: stdout.to_string(),
                stderr: String::new(),
            }));
            self
        }

        pub fn calls(&self) -> Vec<CommandSpec> {
            self.calls.borrow().clone()
        }
    }

    impl Default for RecordingRunner {
        fn default() -> Self {
            Self::new()
        }
    }

    impl CommandRunner for RecordingRunner {
        fn run(&self, spec: &CommandSpec) -> Result<CommandOutput> {
            self.calls.borrow_mut().push(spec.clone());
            let mut responses = self.responses.borrow_mut();
            if responses.is_empty() {
                Ok(CommandOutput {
                    status: 0,
                    stdout: String::new(),
                    stderr: String::new(),
                })
            } else {
                responses
                    .remove(0)
                    .map_err(|e| anyhow::anyhow!(e))
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn display_joins_program_and_args() {
        let spec = CommandSpec::new("node", ["scripts/render-pro.js", "demo-1"]);
        assert_eq!(spec.display(), "node scripts/render-pro.js demo-1");
    }

    #[test]
    fn process_runner_runs_true() {
        let out = ProcessRunner.run(&CommandSpec::new("true", Vec::<String>::new()));
        // `true` may not exist on every platform but does on darwin/linux CI.
        if let Ok(out) = out {
            assert!(out.ok());
        }
    }
}
