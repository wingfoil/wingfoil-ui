#!/usr/bin/env python3
"""Stop-check of backlog-export: valid JSON against schema.json, no duplicate ids, no circular
dependencies, dependencies never later than their dependant, every MVP story and every SARD
requirement in exactly one release partition, output identical to a fresh build.

Usage: python3 docs/03_backlog/X_tools/check_backlog.py
Exit status 0 when every check passes.
"""
import collections, json, pathlib, re, subprocess, sys

ROOT = pathlib.Path(__file__).resolve().parents[3]
OUT = ROOT / "docs" / "03_backlog" / "04_backlog"
REQ = ROOT / "docs" / "02_requirements"
RANK = {r: i for i, r in enumerate(["v0.1", "v0.2", "v0.3", "v0.4", "v1.0"])}
errors = []

def load(p):
    try:
        return json.loads(p.read_text())
    except json.JSONDecodeError as e:
        errors.append(f"{p.name}: invalid JSON ({e})"); return None

schema = load(OUT / "schema.json")
try:
    import jsonschema
    validator = jsonschema.Draft202012Validator(schema)
except ImportError:
    validator = None; errors.append("python package jsonschema not installed: schema not checked")

files = [OUT / "backlog.json"] + sorted((OUT / "by-release").glob("*.json"))
docs = {p: load(p) for p in files}
for p, d in docs.items():
    if d is not None and validator:
        for e in validator.iter_errors(d):
            errors.append(f"{p.name}: schema: {'/'.join(map(str, e.path))}: {e.message[:120]}")

backlog = docs[OUT / "backlog.json"] or {"items": []}
items = backlog["items"]
ids = [i["id"] for i in items]
errors += [f"duplicate id {i}" for i, c in collections.Counter(ids).items() if c > 1]
byid = {i["id"]: i for i in items}

for i in items:
    for d in i["dependencies"]:
        if d not in byid: errors.append(f"{i['id']}: unknown dependency {d}")
        elif RANK[byid[d]["release"]] > RANK[i["release"]]:
            errors.append(f"{i['id']} ({i['release']}) depends on later {d} ({byid[d]['release']})")

state = {}
def visit(n, path):
    if state.get(n) == 1: errors.append("cycle: " + " → ".join(path + [n])); return
    if state.get(n) == 2 or n not in byid: return
    state[n] = 1
    for d in byid[n]["dependencies"]: visit(d, path + [n])
    state[n] = 2
for n in ids: visit(n, [])

stories = set(re.findall(r"^\| (US-[A-Z]-\d\d) \| .*\[MVP · ", (REQ / "01_user_story_map" / "02_story-map.md").read_text(), re.M))
reqs = set()
for f in (REQ / "03_sard").glob("0[1-9]_*.md"):
    reqs |= set(re.findall(r"^### (REQ-[A-Z]+-\d\d) — ", f.read_text(), re.M))
got_us = {i["id"] for i in items if i["kind"] == "user-story"}
got_req = {i["requirement"] for i in items if i["kind"] == "technical-task"}
if got_us != stories: errors.append(f"user stories differ from the map: {sorted(got_us ^ stories)}")
if got_req != reqs: errors.append(f"technical tasks differ from the SARD: {sorted(got_req ^ reqs)}")

seen = collections.Counter()
for p, d in docs.items():
    if p.parent.name == "by-release" and d:
        if p.stem != d.get("release"): errors.append(f"{p.name}: release field {d.get('release')}")
        for i in d["items"]:
            seen[i["id"]] += 1
            if i["release"] != p.stem: errors.append(f"{p.name}: {i['id']} has release {i['release']}")
            if i != byid.get(i["id"]): errors.append(f"{p.name}: {i['id']} differs from backlog.json")
missing = [i for i in ids if seen[i] != 1]
if missing: errors.append(f"not in exactly one partition: {missing[:10]}")

before = {p: p.read_bytes() for p in files}
subprocess.run([sys.executable, str(ROOT / "docs/03_backlog/X_tools/build_backlog.py")], check=True, capture_output=True)
if any(p.read_bytes() != b for p, b in before.items()):
    errors.append("backlog files are not up to date with a fresh build (run build_backlog.py)")

kinds = collections.Counter((i["release"], i["kind"]) for i in items)
for r in RANK:
    print(f"{r}: {kinds[(r, 'user-story')]} stories, {kinds[(r, 'technical-task')]} technical tasks")
print(f"{len(items)} items · {sum(len(i['dependencies']) for i in items)} dependency links")
print("\n".join(errors) if errors else "all checks passed")
sys.exit(1 if errors else 0)
