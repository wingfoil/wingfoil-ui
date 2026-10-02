#!/usr/bin/env python3
"""Stop-check of user-story-mapping: feature coverage, tags, ids, release order, MVP-cut lists.

Usage: python3 docs/02_requirements/X_checks/check_usm.py
Exit status 0 when every check passes.
"""
import pathlib, re, sys, collections

REQ = pathlib.Path(__file__).resolve().parents[1]
VISION = REQ.parent / "01_vision"
sm = (REQ / "01_user_story_map" / "02_story-map.md").read_text()
cut = (REQ / "01_user_story_map" / "03_mvp-cut.md").read_text()
ft = (VISION / "06_features.md").read_text()
seq = (VISION / "07_sequencer.md").read_text()

def rel_key(r): return tuple(int(x) for x in r.lstrip("v").split("."))
errors = []
mvp = re.findall(r"^\| ([A-Z]\d+) \|", ft.split("## Later")[0], re.M)
rows = re.findall(r"^\| (US-[A-Z]-\d\d) \| .*? \| ([^|]*) \| [^|]* \| \[MVP · (v[\d.]+)\] \| ([NE]) \|", sm, re.M)
future = re.findall(r"^\| (US-L-\d\d) \| .*? \| (L\d+) \| \[Future · (L\d+)\] \|", sm, re.M)
ids = [r[0] for r in rows] + [f[0] for f in future]
errors += [f"duplicate id {i}" for i, c in collections.Counter(ids).items() if c > 1]

feature_rel = {}
for v, blk in re.findall(r"### (v[\d.]+) — .*?\n(.*?)(?=\n### |\n---)", seq, re.S):
    first = next((l for l in blk.splitlines() if l.startswith("| ") and not l.startswith("| Features")
                  and not l.startswith("|--")), "")
    for x in re.findall(r"\b([A-Z]\d+) ", first.split("|")[1] if first else ""):
        feature_rel.setdefault(x, v)

cov = collections.defaultdict(set)
for sid, feats, rel, kind in rows:
    fids = re.findall(r"\b[A-Z]\d+\b", feats)
    for x in fids: cov[x].add(sid)
    area = sid.split("-")[1]
    expected = ({"W": "M"}.get(fids[0][0], fids[0][0])) if fids else "X"
    if area != expected: errors.append(f"{sid}: area {area} but main feature {fids[:1]}")
    if fids and fids[0] in feature_rel and rel_key(rel) < rel_key(feature_rel[fids[0]]):
        errors.append(f"{sid}: release {rel} earlier than {fids[0]} ({feature_rel[fids[0]]})")
errors += [f"MVP feature {f} has no story" for f in mvp if not cov[f]]

tbl = cut.split("## Feature coverage")[1].split("## Edge")[0]
for fid, _, st in re.findall(r"^\| ([A-Z]\d+) [^|]*\| (v[\d.]+) \| ([^|]*) \|", tbl, re.M):
    if set(re.findall(r"US-[A-Z]-\d\d", st)) != cov[fid]: errors.append(f"coverage table row {fid} differs from the map")
for v, blk in re.findall(r"### (v[\d.]+) — .*?\n(.*?)(?=\n### |\n---)", cut, re.S):
    got = set(re.findall(r"US-[A-Z]-\d\d", blk.split("Exit criteria")[0]))
    exp = {s for s, _, r, _ in rows if r == v}
    if got != exp: errors.append(f"slice {v} differs from the map: {sorted(got ^ exp)}")
edge = {s for s, _, _, k in rows if k == "E"}
missing = edge - set(re.findall(r"US-[A-Z]-\d\d", cut.split("## Edge cases")[1]))
if missing: errors.append(f"edge stories missing from the edge table: {sorted(missing)}")

by = collections.Counter((r, k) for _, _, r, k in rows)
for v in sorted({r for _, _, r, _ in rows}, key=rel_key):
    print(f"{v}: {by[(v,'N')] + by[(v,'E')]} stories ({by[(v,'N')]} N, {by[(v,'E')]} E)")
print(f"{len(rows)} MVP + {len(future)} future stories · {len(mvp)} MVP features")
print("\n".join(errors) if errors else "all checks passed")
sys.exit(1 if errors else 0)
