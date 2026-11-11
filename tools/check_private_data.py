#!/usr/bin/env python3
"""Detect private data in the repo's tracked files and git history.

The patterns live OUTSIDE the repo (they are the private data themselves), one
per line; blank lines and lines starting with '#' are ignored. Matching is
literal and case-insensitive.

Usage:
    python3 tools/check_private_data.py --patterns-file PATH [--history]

Exit 0 when nothing matches, 1 with one "path:line: pattern" per finding.
For history findings, path is the commit hash and line is 0.
"""

from __future__ import annotations

import argparse
import re
import subprocess
import sys
from pathlib import Path
from typing import List, NamedTuple


class Finding(NamedTuple):
    path: str
    line: int
    pattern: str


def load_patterns(path: Path) -> List[str]:
    patterns = []
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if line and not line.startswith("#"):
            patterns.append(line)
    return patterns


def _compile(patterns: List[str]) -> List[tuple]:
    return [(p, re.compile(re.escape(p), re.IGNORECASE)) for p in patterns]


def _git(root: Path, *args: str) -> str:
    result = subprocess.run(
        ["git", *args], cwd=root, check=True, capture_output=True
    )
    return result.stdout.decode("utf-8", errors="replace")


def scan_tree(root: Path, patterns: List[str]) -> List[Finding]:
    compiled = _compile(patterns)
    findings = []
    for rel in _git(root, "ls-files", "-z").split("\0"):
        if not rel:
            continue
        path = root / rel
        if not path.is_file():
            continue
        text = path.read_bytes().decode("utf-8", errors="replace")
        for number, line in enumerate(text.splitlines(), start=1):
            for pattern, regex in compiled:
                if regex.search(line):
                    findings.append(Finding(rel, number, pattern))
    return findings


def scan_history(root: Path, patterns: List[str]) -> List[Finding]:
    """Search every line ever added in any commit of any ref."""
    compiled = _compile(patterns)
    findings = []
    try:
        log = _git(root, "log", "-p", "--all", "--format=commit:%H")
    except subprocess.CalledProcessError:
        return findings  # no commits yet
    commit = ""
    for line in log.splitlines():
        if line.startswith("commit:"):
            commit = line[len("commit:"):]
            continue
        if not line.startswith("+") or line.startswith("+++"):
            continue
        for pattern, regex in compiled:
            if regex.search(line):
                findings.append(Finding(commit, 0, pattern))
    return findings


def main(argv: List[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--patterns-file", required=True, type=Path)
    parser.add_argument("--history", action="store_true")
    args = parser.parse_args(argv)

    root = Path(__file__).resolve().parent.parent
    patterns = load_patterns(args.patterns_file)
    findings = scan_tree(root, patterns)
    if args.history:
        findings += scan_history(root, patterns)
    for f in findings:
        print(f"{f.path}:{f.line}: {f.pattern}")
    if findings:
        print(f"check_private_data: {len(findings)} finding(s)", file=sys.stderr)
        return 1
    print(f"check_private_data: OK ({len(patterns)} patterns{', history included' if args.history else ''})")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
