#!/usr/bin/env python3
"""Stop-check of release-planning/build-backlog: the Memory tasks of a release against its backlog.

Checks, for every docs/04_memory/<release>/task-*.md:
- `release` = <release> and `tags` contains it (release-cycle selects tasks by tag);
- `title`, `module` (a module of .wingfoil/dna.yaml), `priority` and `ref` are set;
- the line `**Backlog items:** …` lists backlog ids of by-release/<release>.json, `ref` is one of them;
- every `<release>` acceptance criterion of an item is cited in that item's Acceptance Criteria block;
- every `depends_on` id is a task of the same release, and `depends_on` has no cycle;
and that every item of by-release/<release>.json is listed by exactly one task.
A governance task of the release (`module: governance` together with `ref: GOV`, line
`**Backlog items:** GOV …`) has no backlog item and is exempt from the module and backlog checks;
`governance` without `GOV`, or `GOV` with another module, is an error.

Usage: python3 docs/03_backlog/X_tools/check_tasks.py [release]   (default: v0.1)
Exit status 0 when every check passes.
"""
import json, pathlib, re, sys, collections

ROOT = pathlib.Path(__file__).resolve().parents[3]
REL = sys.argv[1] if len(sys.argv) > 1 else "v0.1"
MODULES = set(re.findall(r"^\s*- name: (\S+)",
                         (ROOT / ".wingfoil/dna.yaml").read_text().split("modules:", 1)[1].split("\nstacks:", 1)[0],
                         re.M))
ITEMS = {i["id"]: i for i in json.loads(
    (ROOT / "docs/03_backlog/04_backlog/by-release" / f"{REL}.json").read_text())["items"]}
backlog = set(ITEMS)


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


errors, seen, deps = [], collections.Counter(), {}
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
    module, ref = f.get("module", "").strip('"'), f.get("ref", "").strip('"')
    if (module == "governance") != (ref == "GOV"):
        errors.append(f"{name}: governance task needs module governance with ref GOV")
    deps[p.stem] = lst(f.get("depends_on"))
    if module == "governance" and ref == "GOV":
        if not re.search(r"^\*\*Backlog items:\*\* GOV\b", s, re.M):
            errors.append(f"{name}: governance task without **Backlog items:** GOV line")
        for d in deps[p.stem]:
            if d not in ids:
                errors.append(f"{name}: depends_on {d} is not a {REL} task")
        continue
    if module not in MODULES:
        errors.append(f"{name}: module {f.get('module')}")
    m = re.search(r"^\*\*Backlog items:\*\* (.+)$", s, re.M)
    items = [x.strip() for x in m.group(1).split(",")] if m else []
    if not items:
        errors.append(f"{name}: no **Backlog items:** line")
    for x in items:
        if x not in backlog:
            errors.append(f"{name}: {x} not in by-release/{REL}.json")
        seen[x] += 1
        # the item's own block of Acceptance Criteria: from "- **<id>**" to the next "- **" bullet
        blk = re.search(rf"^- \*\*{re.escape(x)}\*\*.*?(?=^- \*\*|^\S|\Z)", s, re.M | re.S)
        for ac in ITEMS.get(x, {}).get("acceptance_criteria", []):
            if ac.get("release") == REL and not (blk and re.search(rf"\b{re.escape(ac['id'])}\b", blk.group(0))):
                errors.append(f"{name}: {x} scenario {ac['id']} not cited in its acceptance block")
    if f.get("ref", "").strip('"') not in items:
        errors.append(f"{name}: ref {f.get('ref')} not among its backlog items")
    deps[p.stem] = lst(f.get("depends_on"))
    for d in deps[p.stem]:
        if d not in ids:
            errors.append(f"{name}: depends_on {d} is not a {REL} task")
state = {}


def visit(t, path):
    if state.get(t) == "done" or t not in deps:
        return
    if state.get(t) == "open":
        errors.append("depends_on cycle: " + " -> ".join(path + [t]))
        return
    state[t] = "open"
    for d in deps[t]:
        visit(d, path + [t])
    state[t] = "done"


for t in deps:
    visit(t, [])
for x in sorted(backlog):
    if seen[x] != 1:
        errors.append(f"{x}: listed by {seen[x]} tasks (expected 1)")

print(f"{len(tasks)} tasks · {len(backlog)} backlog items · {sum(seen.values())} listed")
for e in errors:
    print("FAIL", e)
print("OK" if not errors else f"{len(errors)} failure(s)")
sys.exit(1 if errors else 0)
