#!/usr/bin/env python3
"""flow-worker: ledger, routing, and manifest helper for the Flow/Veo browser agent.

The browser driving is done by the agent (see SKILL.md); this script owns the
deterministic state: account balances, budgets, job manifest, profiles.

Stdlib-only.
"""

from __future__ import annotations

import argparse
import json
import os
import platform
import subprocess
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

SKILL_DIR = Path(__file__).resolve().parent.parent
STATE_DIR = SKILL_DIR / "state"
LEDGER = STATE_DIR / "ledger.json"
PROFILES_DIR = STATE_DIR / "profiles"

ACCOUNTS = ["A", "B", "C"]
ACCOUNT_STATES = {"READY", "EXHAUSTED", "NEEDS_USER", "UNKNOWN"}
FLOW_URL = "https://labs.google/flow"

# Reference credit costs — the live UI always wins; update via `model cost`.
MODEL_COSTS = {
    "veo-3.1-lite": 5,
    "veo-3.1-fast": 10,
    "veo-3.1-quality": 100,
    "nano-banana": None,  # image generations vary; read cost in the UI
}


def utcnow() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def media_root() -> Path:
    return Path(
        os.environ.get("FLOW_MEDIA_ROOT", Path.home() / "Google-AI-Experiments")
    ).expanduser()


def project_root(project: str) -> Path:
    """Resolve a project beneath the media root; reject traversal/absolute paths."""
    if not project or project in {".", ".."}:
        sys.exit("project must be a non-empty relative name")
    root = media_root().resolve()
    candidate = (root / project).resolve()
    try:
        candidate.relative_to(root)
    except ValueError:
        sys.exit("project must stay inside FLOW_MEDIA_ROOT")
    return candidate


def load() -> dict:
    if LEDGER.is_file():
        return json.loads(LEDGER.read_text())
    return {
        "accounts": {
            a: {
                "balance": None,
                "startingCredits": None,
                "state": "UNKNOWN",
                "refreshDate": None,
                "notes": "",
            }
            for a in ACCOUNTS
        },
        "batch": {"budget": None, "spent": 0},
        "updatedAt": None,
    }


def save(data: dict) -> None:
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    data["updatedAt"] = utcnow()
    LEDGER.write_text(json.dumps(data, indent=2) + "\n")


def manifest_path(project: str) -> Path:
    return project_root(project) / "manifest.jsonl"


def read_manifest(project: str) -> list:
    path = manifest_path(project)
    if not path.is_file():
        return []
    return [
        json.loads(line)
        for line in path.read_text().splitlines()
        if line.strip()
    ]


def write_manifest(project: str, jobs: list) -> None:
    path = manifest_path(project)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("".join(json.dumps(j) + "\n" for j in jobs))


def remaining_budget(data: dict) -> float | None:
    budget = data["batch"].get("budget")
    if budget is None:
        return None
    return budget - data["batch"].get("spent", 0)


def acct(data: dict, name: str) -> dict:
    if name not in ACCOUNTS:
        sys.exit(f"account must be one of {ACCOUNTS}")
    return data["accounts"][name]


# ---------------------------------------------------------------- commands


def cmd_init(args) -> None:
    root = project_root(args.project)
    (root / "images").mkdir(parents=True, exist_ok=True)
    (root / "videos").mkdir(parents=True, exist_ok=True)
    manifest = root / "manifest.jsonl"
    manifest.touch(exist_ok=True)
    print(f"project ready: {root}")
    print(f"  images/    videos/    manifest.jsonl")


def cmd_launch(args) -> None:
    account = args.account.upper()
    if account not in ACCOUNTS:
        sys.exit(f"account must be one of {ACCOUNTS}")
    profile = PROFILES_DIR / f"FLOW-{account}"
    profile.mkdir(parents=True, exist_ok=True)
    url = args.url or FLOW_URL
    if platform.system() == "Darwin":
        cmd = [
            "open", "-na", "Google Chrome", "--args",
            f"--user-data-dir={profile}",
            url,
        ]
    else:
        cmd = [
            "google-chrome",
            f"--user-data-dir={profile}",
            url,
        ]
    if args.print_cmd:
        print(" ".join(cmd))
        return
    subprocess.Popen(cmd)
    print(f"FLOW-{account} launched → {url}")
    print("sign-in/MFA/CAPTCHA is manual, one-time; the profile persists.")


def cmd_balance(args) -> None:
    data = load()
    if args.balance_cmd == "set":
        if args.credits < 0:
            sys.exit("credits must be non-negative")
        if args.starting is not None and args.starting < 0:
            sys.exit("starting credits must be non-negative")
        a = acct(data, args.account.upper())
        a["balance"] = args.credits
        if args.starting is not None:
            a["startingCredits"] = args.starting
        if args.refresh_date:
            a["refreshDate"] = args.refresh_date
        a["state"] = "READY"
        save(data)
        print(f"{args.account.upper()}: balance={args.credits} state=READY")
        return
    print(f"{'ACCT':<6}{'BALANCE':<10}{'STATE':<14}{'REFRESH':<12}NOTES")
    for name in ACCOUNTS:
        a = data["accounts"][name]
        bal = a["balance"] if a["balance"] is not None else "?"
        print(
            f"{name:<6}{bal:<10}{a['state']:<14}"
            f"{a.get('refreshDate') or '-':<12}{a.get('notes', '')}"
        )
    rem = remaining_budget(data)
    if rem is not None:
        print(f"\nbatch: spent {data['batch']['spent']} / "
              f"{data['batch']['budget']} (remaining {rem})")


def cmd_state(args) -> None:
    data = load()
    a = acct(data, args.account.upper())
    if args.new_state not in ACCOUNT_STATES:
        sys.exit(f"state must be one of {sorted(ACCOUNT_STATES)}")
    a["state"] = args.new_state
    if args.notes:
        a["notes"] = args.notes
    save(data)
    print(f"{args.account.upper()}: {args.new_state}"
          + (f" ({args.notes})" if args.notes else ""))


def cmd_route(args) -> None:
    data = load()
    cost = args.cost
    if cost < 0:
        sys.exit("cost must be non-negative")
    rem = remaining_budget(data)
    if rem is not None and cost > rem:
        sys.exit(
            f"no route: cost {cost} exceeds remaining batch budget {rem}"
        )
    eligible = []
    for name in ACCOUNTS:
        a = data["accounts"][name]
        if a["state"] != "READY":
            continue
        if a["balance"] is None:
            print(
                f"warning: {name} balance unknown — read the Flow UI first",
                file=sys.stderr,
            )
            continue
        if a["balance"] >= cost:
            eligible.append((a["balance"], name))
    if not eligible:
        sys.exit(f"no eligible account with ≥{cost} credits")
    if args.prefer:
        pref = args.prefer.upper()
        for bal, name in eligible:
            if name == pref:
                print(
                    f"route → {name} (preferred; balance {bal}, "
                    f"post-cost {bal - cost})"
                )
                return
        print(
            f"note: preferred account {pref} ineligible; "
            "falling back", file=sys.stderr,
        )
    eligible.sort(reverse=True)
    bal, name = eligible[0]
    print(f"route → {name} (balance {bal}, post-cost {bal - cost})")


def cmd_precheck(args) -> None:
    """The pre-Generate checklist — run before clicking Generate."""
    if args.cost < 0:
        sys.exit("cost must be non-negative")
    if args.outputs < 1:
        sys.exit("outputs must be at least 1")
    data = load()
    a = acct(data, args.account.upper())
    problems = []
    if a["state"] != "READY":
        problems.append(f"account state is {a['state']}, not READY")
    if a["balance"] is None:
        problems.append("balance unknown — read the Flow UI first")
    elif a["balance"] < args.cost:
        problems.append(f"balance {a['balance']} < cost {args.cost}")
    rem = remaining_budget(data)
    if rem is not None and args.cost > rem:
        problems.append(f"cost {args.cost} exceeds remaining batch budget {rem}")
    checks = [
        f"correct account:        FLOW-{args.account.upper()} signed in as the right Google account",
        f"correct project:        '{args.project}' open in Flow",
        f"correct model:          {args.model} selected",
        f"output count:           {args.outputs} (each output costs credits)",
        f"references attached:    {'yes' if args.refs else 'verify in UI'}",
        f"expected credit cost:   {args.cost} (balance {a['balance']})",
        f"within batch budget:    {rem if rem is not None else 'no cap set'} remaining",
    ]
    for c in checks:
        print(f"  ✓ {c}")
    if problems:
        print("\nBLOCKED:")
        for p in problems:
            print(f"  ✗ {p}")
        sys.exit(1)
    print("\nclear to Generate")


def cmd_debit(args) -> None:
    data = load()
    a = acct(data, args.account.upper())
    if args.credits < 0:
        sys.exit("credits must be non-negative")
    if a["balance"] is None:
        sys.exit("cannot debit while balance is unknown")
    if a["balance"] < args.credits:
        sys.exit(
            f"refusing debit: balance {a['balance']} < credits {args.credits}"
        )
    rem = remaining_budget(data)
    if rem is not None and args.credits > rem:
        sys.exit(
            f"refusing debit: {args.credits} exceeds remaining budget {rem}"
        )
    a["balance"] -= args.credits
    data["batch"]["spent"] = data["batch"].get("spent", 0) + args.credits
    save(data)
    print(
        f"{args.account.upper()}: -{args.credits} → balance {a['balance']}"
        f" (batch spent {data['batch']['spent']})"
    )


def cmd_budget(args) -> None:
    data = load()
    if args.budget_cmd == "set":
        if args.credits < 0:
            sys.exit("budget must be non-negative")
        data["batch"] = {"budget": args.credits, "spent": 0}
        save(data)
        print(f"batch budget set: {args.credits} credits (spent reset to 0)")
        return
    rem = remaining_budget(data)
    print(
        f"budget: {data['batch']['budget']}  "
        f"spent: {data['batch']['spent']}  remaining: {rem}"
    )


def cmd_model(args) -> None:
    if args.model_cmd == "cost" and args.name and args.credits is not None:
        if args.credits < 0:
            sys.exit("cost must be non-negative")
        MODEL_COSTS[args.name] = args.credits
        # Costs are reference-only; persist into ledger for visibility.
        data = load()
        data.setdefault("modelCosts", {})[args.name] = args.credits
        save(data)
        print(f"{args.name}: {args.credits} credits (recorded from live UI)")
        return
    data = load()
    known = data.get("modelCosts", {})
    merged = {**MODEL_COSTS, **known}
    for name, cost in merged.items():
        tag = " (from live UI)" if name in known else " (reference)"
        print(f"{name:<22}{cost if cost is not None else '?':>6}{tag}")
    print("\nlive UI always wins — record observed costs with "
          "`model cost <name> <n>`")


def cmd_job(args) -> None:
    project = args.project
    jobs = read_manifest(project)
    if args.job_cmd == "add":
        if args.credits < 0:
            sys.exit("credits must be non-negative")
        data = load()
        acct(data, args.account.upper())
        if any(j["jobId"] == args.job_id for j in jobs):
            sys.exit(f"job {args.job_id} already exists in {project} manifest")
        job = {
            "jobId": args.job_id,
            "account": args.account.upper(),
            "type": args.type,
            "model": args.model,
            "prompt": args.prompt,
            "references": args.refs.split(",") if args.refs else [],
            "credits": args.credits,
            "submittedAt": utcnow(),
            "completedAt": None,
            "file": None,
            "status": "SUBMITTED",
        }
        jobs.append(job)
        write_manifest(project, jobs)
        print(f"{args.job_id}: SUBMITTED ({args.model}, "
              f"{args.credits}cr, acct {args.account.upper()})")
        return
    job = next((j for j in jobs if j["jobId"] == args.job_id), None)
    if not job:
        sys.exit(f"no job {args.job_id} in {project} manifest")
    if args.job_cmd == "done":
        job["status"] = "DONE"
        job["completedAt"] = utcnow()
        job["file"] = args.file
    elif args.job_cmd == "fail":
        job["status"] = "FAILED"
        job["completedAt"] = utcnow()
        job["failure"] = args.reason
    elif args.job_cmd == "status":
        print(json.dumps(job, indent=2))
        return
    write_manifest(project, jobs)
    print(f"{args.job_id}: {job['status']}")


def cmd_jobs(args) -> None:
    jobs = read_manifest(args.project)
    if args.status:
        jobs = [j for j in jobs if j["status"] == args.status]
    for j in jobs:
        print(
            f"{j['jobId']:<16}{j.get('account','?'):<5}"
            f"{j.get('model','?'):<20}{j['status']:<10}"
            f"{j.get('file') or '-'}"
        )
    if not jobs:
        print("(no jobs)")


def cmd_report(args) -> None:
    data = load()
    print("== accounts ==")
    for name in ACCOUNTS:
        a = data["accounts"][name]
        print(
            f"  {name}: {a['state']:<12} balance={a['balance']} "
            f"start={a['startingCredits']} refresh={a.get('refreshDate')}"
        )
    rem = remaining_budget(data)
    print(
        f"\n== batch == spent {data['batch']['spent']} / "
        f"{data['batch']['budget']} (remaining {rem})"
    )
    root = media_root()
    if root.is_dir():
        print("\n== projects ==")
        for p in sorted(root.iterdir()):
            manifest = p / "manifest.jsonl"
            if not manifest.is_file():
                continue
            jobs = read_manifest(p.name)
            done = sum(1 for j in jobs if j["status"] == "DONE")
            print(f"  {p.name}: {done}/{len(jobs)} done")


# ---------------------------------------------------------------- main


def main() -> None:
    p = argparse.ArgumentParser(
        prog="flow-worker",
        description="Ledger/routing/manifest helper for the Flow+Veo "
                    "three-account browser agent.",
    )
    sub = p.add_subparsers(dest="cmd", required=True)

    sp = sub.add_parser("init", help="create project dirs + manifest")
    sp.add_argument("project")

    sp = sub.add_parser("launch", help="open persistent Chrome profile for an account")
    sp.add_argument("account", choices=ACCOUNTS + [a.lower() for a in ACCOUNTS])
    sp.add_argument("--url")
    sp.add_argument("--print", dest="print_cmd", action="store_true")

    sp = sub.add_parser("balance", help="record/show credit balances")
    bal_sub = sp.add_subparsers(dest="balance_cmd", required=True)
    bset = bal_sub.add_parser("set")
    bset.add_argument("account")
    bset.add_argument("credits", type=int)
    bset.add_argument("--starting", type=int)
    bset.add_argument("--refresh-date")
    bal_sub.add_parser("show")

    sp = sub.add_parser("state", help="mark account READY/EXHAUSTED/NEEDS_USER")
    sp.add_argument("account")
    sp.add_argument("new_state")
    sp.add_argument("--notes")

    sp = sub.add_parser("route", help="pick the account for a generation")
    sp.add_argument("--cost", type=int, required=True)
    sp.add_argument("--prefer", help="prefer this account (same-project variants)")

    sp = sub.add_parser("precheck", help="pre-Generate checklist")
    sp.add_argument("--account", required=True)
    sp.add_argument("--project", required=True)
    sp.add_argument("--model", required=True)
    sp.add_argument("--cost", type=int, required=True)
    sp.add_argument("--outputs", type=int, default=1)
    sp.add_argument("--refs", action="store_true")

    sp = sub.add_parser("debit", help="debit credits after Generate confirmed")
    sp.add_argument("account")
    sp.add_argument("credits", type=int)
    sp.add_argument("--job")

    sp = sub.add_parser("budget", help="batch budget set/show")
    bud_sub = sp.add_subparsers(dest="budget_cmd", required=True)
    bs = bud_sub.add_parser("set")
    bs.add_argument("credits", type=int)
    bud_sub.add_parser("show")

    sp = sub.add_parser("model", help="list/record model credit costs")
    model_sub = sp.add_subparsers(dest="model_cmd")
    mc = model_sub.add_parser("cost")
    mc.add_argument("name")
    mc.add_argument("credits", type=int)

    sp = sub.add_parser("job", help="manifest job lifecycle")
    job_sub = sp.add_subparsers(dest="job_cmd", required=True)
    ja = job_sub.add_parser("add")
    ja.add_argument("--project", required=True)
    ja.add_argument("--job-id", required=True)
    ja.add_argument("--account", required=True)
    ja.add_argument("--type", choices=["image", "video"], required=True)
    ja.add_argument("--model", required=True)
    ja.add_argument("--prompt", required=True)
    ja.add_argument("--refs")
    ja.add_argument("--credits", type=int, required=True)
    for name in ("done", "fail", "status"):
        js = job_sub.add_parser(name)
        js.add_argument("--project", required=True)
        js.add_argument("--job-id", required=True)
        if name == "done":
            js.add_argument("--file", required=True)
        if name == "fail":
            js.add_argument("--reason", required=True)

    sp = sub.add_parser("jobs", help="list manifest jobs")
    sp.add_argument("--project", required=True)
    sp.add_argument("--status")

    sub.add_parser("report", help="accounts + batch + projects summary")

    args = p.parse_args()
    {
        "init": cmd_init,
        "launch": cmd_launch,
        "balance": cmd_balance,
        "state": cmd_state,
        "route": cmd_route,
        "precheck": cmd_precheck,
        "debit": cmd_debit,
        "budget": cmd_budget,
        "model": cmd_model,
        "job": cmd_job,
        "jobs": cmd_jobs,
        "report": cmd_report,
    }[args.cmd](args)


if __name__ == "__main__":
    main()
