#!/usr/bin/env python3
"""Stop-check of initial-design/seed-releases: the release elements of rl-v1 against the sequencer.

Checks, for every docs/04_memory/planning/v1/minor-*.md:
- every required field of `release` in .wingfoil/memory.yaml is set (`kind` included);
- `pillar` and `wingfoil_min` match the release heading of 07_sequencer.md;
- `features` = the features the sequencer introduces in that release, and every MVP feature of
  06_features.md is in exactly one release;
- `requirements` points to the existing by-release partition of the same version;
- `release-line` = v1, status one of the `release` states of memory.yaml (`draft` at seeding; it
  advances through release-cycle — release-planning-rel-v0.1-plan, session 1).

Usage: python3 docs/03_backlog/X_tools/check_releases.py
Exit status 0 when every check passes.
"""
import pathlib, re, sys, collections

# release states of .wingfoil/memory.yaml (draft at seeding; advanced by release-cycle)
RELEASE_STATES = ("draft", "planning", "in-development", "releasing", "released")

ROOT = pathlib.Path(__file__).resolve().parents[3]
VISION = ROOT / "docs" / "01_vision"
seq = (VISION / "07_sequencer.md").read_text()
ft = (VISION / "06_features.md").read_text()
schema = (ROOT / ".wingfoil" / "memory.yaml").read_text()
errors = []

required = re.search(r"^  release:\n.*?required: \[([^\]]*)\]", schema, re.S | re.M).group(1)
required = [x.strip() for x in required.split(",")]
mvp = re.findall(r"^\| ([A-Z]\d+) \|", ft.split("## Later")[0], re.M)

expected = {}
for v, area, floor, blk in re.findall(
        r"### (v[\d.]+) — .*?area \*\*([A-Z])\*\* · WingFoil (?:≥ )?([\d.]+)\n(.*?)(?=\n### |\n---)", seq, re.S):
    row = next((l for l in blk.splitlines() if l.startswith("| ") and not l.startswith(("| Features", "| Scope", "|--"))), "")
    feats = re.findall(r"\b([A-Z]\d+) ", row.split("|")[1]) if v != "v1.0" else []
    if v == "v0.4":  # "upgrades on 0.3: T2 …" are capability upgrades, not new features
        feats = re.findall(r"\b([A-Z]\d+) ", row.split("|")[1].split("upgrades")[0])
    expected[v] = dict(pillar=area, wingfoil_min=floor, features=feats)

def fm(text):
    out = {}
    for line in text.split("---")[1].splitlines():
        m = re.match(r"^([\w-]+):\s*(.*?)\s*(?:#.*)?$", line)
        if m:
            out[m.group(1)] = m.group(2).strip('"')
    return out

seen = collections.Counter()
files = sorted((ROOT / "docs/04_memory/planning/v1").glob("minor-*.md"))
for p in files:
    f = fm(p.read_text())
    v = f.get("version")
    for k in required:
        if k == "features":
            continue  # an empty list is legitimate for v1.0 (no new features)
        if not f.get(k):
            errors.append(f"{p.name}: required field {k} empty")
    if v not in expected:
        errors.append(f"{p.name}: version {v} not in the sequencer"); continue
    e = expected[v]
    feats = re.findall(r"[A-Z]\d+", f.get("features", ""))
    seen.update(feats)
    if f.get("pillar") != e["pillar"]: errors.append(f"{p.name}: pillar {f.get('pillar')} != {e['pillar']}")
    if f.get("wingfoil_min") != e["wingfoil_min"]: errors.append(f"{p.name}: wingfoil_min {f.get('wingfoil_min')} != {e['wingfoil_min']}")
    if sorted(feats) != sorted(e["features"]): errors.append(f"{p.name}: features {feats} != {e['features']}")
    req = f.get("requirements", "")
    if req != f"docs/03_backlog/04_backlog/by-release/{v}.json" or not (ROOT / req).is_file():
        errors.append(f"{p.name}: requirements {req!r} is not the {v} partition")
    if f.get("kind") != "minor" or f.get("release-line") != "v1" or f.get("status") not in RELEASE_STATES:
        errors.append(f"{p.name}: kind/release-line/status = {f.get('kind')}/{f.get('release-line')}/{f.get('status')}")

if sorted(expected) != sorted(fm(p.read_text()).get("version") for p in files):
    errors.append(f"releases {[p.name for p in files]} != sequencer {sorted(expected)}")
errors += [f"feature {x} in {n} releases" for x, n in seen.items() if n > 1]
errors += [f"MVP feature {x} in no release" for x in mvp if x not in seen]
errors += [f"feature {x} not an MVP feature" for x in seen if x not in mvp]

print(f"releases: {len(files)} · features: {sum(seen.values())} / {len(mvp)} MVP")
for e in errors:
    print("FAIL", e)
print("OK" if not errors else f"{len(errors)} failure(s)")
sys.exit(1 if errors else 0)
