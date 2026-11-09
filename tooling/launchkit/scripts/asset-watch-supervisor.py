#!/usr/bin/env python3
"""Hold an OS lock for the watcher and any worker it starts."""
import fcntl
import os
import pathlib
import stat
import sys


def main():
    if len(sys.argv) < 3:
        raise SystemExit('usage: asset-watch-supervisor.py STATE-DIR COMMAND [ARGS...]')
    state = pathlib.Path(sys.argv[1])
    state.mkdir(mode=0o700, parents=True, exist_ok=True)
    if state.is_symlink() or not state.is_dir():
        raise SystemExit('unsafe watcher state directory')
    os.chmod(state, 0o700)
    lock = os.open(state / 'watch.lock', os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
    if not stat.S_ISREG(os.fstat(lock).st_mode):
        raise SystemExit('unsafe watcher lock')
    try:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        raise SystemExit('asset watcher or its worker is already running')
    os.set_inheritable(lock, True)
    os.environ['FLEET_ASSET_LOCK_FD'] = str(lock)
    os.execvp(sys.argv[2], sys.argv[2:])


if __name__ == '__main__':
    main()
