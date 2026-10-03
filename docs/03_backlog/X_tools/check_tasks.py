#!/usr/bin/env python3
"""Stop-check of release-planning/build-backlog: the Memory tasks of a release against its backlog.

Checks, for every docs/04_memory/<release>/task-*.md:
- `release` = <release> and `tags` contains it (release-cycle selects tasks by tag);
- `title`, `module` (a dna.yaml module), `priority` and `ref` are set;
- the line `**Backlog items:** …` lists backlog ids of by-release/<release>.json, `ref` is one of them;
- every `depends_on` id is a task of the same release;
and that every item of by-release/<release>.json is listed by exactly one task.

Usage: python3 docs/03_backlog/X_tools/check_tasks.py [release]   (default: v0.1)
Exit status 0 when every check passes.
"""
import json, pathlib, re, sys, collections

ROOT = pathlib.Path(__file__).resolve().parents[3]
REL = sys.argv[1] if len(sys.argv) > 1 else "v0.1"
MODULES = {"server", "web", "contracts"}
backlog = {i["id"] for i in json.loads(
    (ROOT / "docs/03_backlog/04_backlog/by-release" / f"{REL}.json").read_text())["items"]}


def fm(text):
    head = text.split("\n---\n", 1)[0]
    out = {}
    for line in head.splitlines()[1:]:
        m = re.match(r"^([a-z_-]+):\s*(.*?)\s*(#.*)?$", line)
        if m:
            out[m.group(1)] = m.group(2)
    return out


def lst(v):
    return re.findall(r'"([^"]+)"', v or "")


errors, seen = [], collections.Counter()
tasks = sorted((ROOT / "docs/04_memory" / REL).glob("task-*.md"))
ids = {p.stem for p in tasks}
for p in tasks:
    s = p.read_text()
    f = fm(s)
    name = p.name
    if f.get("release") != f'"{REL}"':
        errors.append(f"{name}: release {f.get('release')}")
    if REL not in lst(f.get("tags")):
        errors.append(f"{name}: tags {f.get('tags')} lack {REL}")
    for k in ("title", "module", "priority", "ref"):
        if f.get(k, '""') in ('""', ""):
            errors.append(f"{name}: {k} empty")
    if f.get("module", "").strip('"') not in MODULES:
        errors.append(f"{name}: module {f.get('module')}")
    m = re.search(r"^\*\*Backlog items:\*\* (.+)$", s, re.M)
    items = [x.strip() for x in m.group(1).split(",")] if m else []
    if not items:
        errors.append(f"{name}: no **Backlog items:** line")
    for x in items:
        if x not in backlog:
            errors.append(f"{name}: {x} not in by-release/{REL}.json")
        seen[x] += 1
    if f.get("ref", "").strip('"') not in items:
        errors.append(f"{name}: ref {f.get('ref')} not among its backlog items")
    for d in lst(f.get("depends_on")):
        if d not in ids:
            errors.append(f"{name}: depends_on {d} is not a {REL} task")
for x in sorted(backlog):
    if seen[x] != 1:
        errors.append(f"{x}: listed by {seen[x]} tasks (expected 1)")

print(f"{len(tasks)} tasks · {len(backlog)} backlog items · {sum(seen.values())} listed")
for e in errors:
    print("FAIL", e)
print("OK" if not errors else f"{len(errors)} failure(s)")
sys.exit(1 if errors else 0)
