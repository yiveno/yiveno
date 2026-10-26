#!/usr/bin/env python3
"""beforeShellExecution：拦截破坏性 git 命令。"""
from __future__ import annotations

import json
import re
import sys

data = json.load(sys.stdin)
command = data.get("command") or ""

patterns: list[tuple[str, str]] = [
    (r"\bgit\s+checkout\s+--", "git checkout -- <path>"),
    (r"\bgit\s+restore\b", "git restore"),
    (r"\bgit\s+reset\s+--hard\b", "git reset --hard"),
    (r"\bgit\s+clean\s+-fd\b", "git clean -fd"),
]

for pattern, label in patterns:
    if re.search(pattern, command):
        print(
            json.dumps(
                {
                    "permission": "deny",
                    "user_message": (
                        f"已拦截破坏性 git 命令（{label}）。"
                        "见 .cursor/rules/git-workdir-safety.mdc：先备份或 stash，勿静默丢弃 WIP。"
                    ),
                    "agent_message": (
                        "Use cp to /tmp, git stash push, or ask the user "
                        "before discarding worktree changes."
                    ),
                }
            )
        )
        raise SystemExit(0)

print(json.dumps({"permission": "allow"}))
