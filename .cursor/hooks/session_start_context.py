#!/usr/bin/env python3
"""sessionStart：尽力注入 CURRENT.md 摘要。"""
from __future__ import annotations

import json
import pathlib

root = pathlib.Path(".")
current = root / "docs" / "product" / "CURRENT.md"
adr = root / "docs" / "architecture" / "decisions" / "README.md"

parts: list[str] = [
    "[Yiveno session boot] Agent 开机层已 alwaysApply：.cursor/rules/session-boot.mdc；详版 docs/product/CURRENT.md。",
]

if current.is_file():
    text = current.read_text(encoding="utf-8")
    if len(text) > 3500:
        text = text[:3500] + "\n\n…(truncated; read docs/product/CURRENT.md)"
    parts.append(text)
else:
    parts.append("WARNING: docs/product/CURRENT.md missing.")

if adr.is_file():
    parts.append("ADR index: docs/architecture/decisions/README.md")

print(json.dumps({"additional_context": "\n\n".join(parts)}))
