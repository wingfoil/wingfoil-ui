#!/usr/bin/env python3
"""Stop-check of release-planning/build-backlog: the Memory tasks of a release against its backlog.

Checks, for every docs/04_memory/<release>/task-*.md:
- `release` = <release> and `tags` contains it (release-cycle selects tasks by tag);
- `title`, `module` (a module of .wingfoil/dna.yaml), `priority` and `ref` are set;
- the line `**Backlog items:** …` lists backlog ids of by-release/<release>.json, `ref` is one of them;
- every `<release>` acceptance criterion of an item is cited in that item's Acceptance Criteria block;
- every `depends_on` id is a task of the same release, and `depends_on` has no cycle;
and that every item of by-release/<release>.json is listed by exactly one task.
A task may also list (in `**Backlog items:**`, and as its `ref`) a user story of an EARLIER
release that has scenarios tagged `@<release>` in docs/02_requirements/02_bdd/features/ (the
story whose behaviour those scenarios extend, release-planning v0.3, B2 (c)): its Acceptance
Criteria block for that story must cite every one of those `@<release>` scenarios, and each such
story is listed by exactly one task of the release (from v0.3, where the rule starts; at most
one for earlier releases, planned before it).
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
RANK = {r: i for i, r in enumerate(["v0.1", "v0.2", "v0.3", "v0.4", "v1.0"])}
STORY_RELEASE = {i["id"]: i["release"] for i in json.loads(
    (ROOT / "docs/03_backlog/04_backlog/backlog.json").read_text())["items"] if i["kind"] == "user-story"}


def release_scenarios():
    """Story id -> the ids of its scenarios tagged @<REL>, read from the .feature files."""
    out = collections.defaultdict(list)
    for f in sorted((ROOT / "docs/02_requirements/02_bdd/features").rglob("*.feature")):
        tags = []
        for line in f.read_text().splitlines():
            ln = line.strip()
            if ln.startswith("@"):
                tags += ln.split()
            elif ln.startswith(("Scenario:", "Scenario Outline:")):
                m = re.match(r"Scenario(?: Outline)?: ([A-Z]-\d\d\.\d+) — ", ln)
                story = next((t[1:] for t in tags if t.startswith("@US-")), None)
                if m and story and f"@{REL}" in tags:
                    out[story].append(m.group(1))
                tags = []
    return out


# earlier-release stories carrying @<REL> scenarios (B2 (c))
EARLIER = {sid: scs for sid, scs in release_scenarios().items()
           if sid in STORY_RELEASE and RANK[STORY_RELEASE[sid]] < RANK[REL]}


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


errors, seen, seen_earlier, deps = [], collections.Counter(), collections.Counter(), {}
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
        # the item's own block of Acceptance Criteria: from "- **<id>**" to the next "- **" bullet
        blk = re.search(rf"^- \*\*{re.escape(x)}\*\*.*?(?=^- \*\*|^\S|\Z)", s, re.M | re.S)
        if x not in backlog and x in EARLIER:
            seen_earlier[x] += 1
            for sc in EARLIER[x]:
                if not (blk and re.search(rf"\b{re.escape(sc)}\b", blk.group(0))):
                    errors.append(f"{name}: {x} ({STORY_RELEASE[x]}) scenario {sc} (@{REL}) not cited in its acceptance block")
            continue
        if x not in backlog:
            errors.append(f"{name}: {x} not in by-release/{REL}.json, nor an earlier story with @{REL} scenarios")
        seen[x] += 1
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
for x in sorted(EARLIER if RANK[REL] >= RANK["v0.3"] else seen_earlier):
    if seen_earlier[x] != 1 and (RANK[REL] >= RANK["v0.3"] or seen_earlier[x] > 1):
        errors.append(f"{x} ({STORY_RELEASE[x]}): earlier story with @{REL} scenarios listed by "
                      f"{seen_earlier[x]} tasks (expected 1)")

print(f"{len(tasks)} tasks · {len(backlog)} backlog items · {sum(seen.values())} listed")
for e in errors:
    print("FAIL", e)
print("OK" if not errors else f"{len(errors)} failure(s)")
sys.exit(1 if errors else 0)
