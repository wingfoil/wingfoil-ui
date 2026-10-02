#!/usr/bin/env python3
"""Stop-check of specification-by-examples: validates the .feature files against the story map.

Usage: python3 docs/02_requirements/X_checks/check_bdd.py v0.1 v0.2   (releases in scope)
Exit status 0 when every check passes.
"""
import pathlib, re, sys, collections

ROOT = pathlib.Path(__file__).resolve().parents[1]
MAP = ROOT / "01_user_story_map" / "02_story-map.md"
FEATURES = ROOT / "02_bdd" / "features"
AMBIGUOUS = """quickly slowly fast faster soon recent recently clearly easily simply intuitive
user-friendly appropriate appropriately properly correctly reasonable reasonably several some
many few nice good bad large small big usually normally often rarely sufficient adequate
qualified relevant""".split()

def rel_key(r): return tuple(int(x) for x in r.lstrip("v").split("."))

stories = {i: r for i, r in re.findall(
    r"^\| (US-[A-Z]-\d\d) \| .*? \| [^|]* \| [^|]* \| \[MVP · (v[\d.]+)\] \|", MAP.read_text(), re.M)}
scope = set(sys.argv[1:]) or set(stories.values())
errors, scen_ids = [], set()
seen = collections.defaultdict(lambda: {"nominal": 0, "edge": 0})
count = 0

for f in sorted(FEATURES.rglob("*.feature")):
    lines = f.read_text().splitlines()
    tags = []
    i = 0
    while i < len(lines):
        ln = lines[i].strip()
        if ln.startswith("@"):
            tags += ln.split()
        elif ln.startswith(("Scenario:", "Scenario Outline:")):
            count += 1
            title = ln.split(":", 1)[1].strip()
            where = f"{f.relative_to(ROOT)}:{i+1}"
            body = []
            j = i + 1
            while j < len(lines) and not lines[j].strip().startswith(("@", "Scenario", "#")):
                body.append(lines[j].strip()); j += 1
            us = [t[1:] for t in tags if t.startswith("@US-")]
            rel = [t[1:] for t in tags if re.fullmatch(r"@v\d+\.\d+", t)]
            kind = [t[1:] for t in tags if t in ("@nominal", "@edge")]
            fx = [t for t in tags if t.startswith("@fx-")]
            if len(us) != 1 or len(rel) != 1 or len(kind) != 1 or len(fx) != 1:
                errors.append(f"{where}: needs exactly one story, release, kind and fixture tag ({tags})")
            else:
                sid, r, k = us[0], rel[0], kind[0]
                m = re.match(r"([A-Z]-\d\d)\.(\d+) — ", title)
                if not m or "US-" + m.group(1) != sid:
                    errors.append(f"{where}: title must start with '{sid[3:]}.<k> — '")
                elif m.group(0) in scen_ids:
                    errors.append(f"{where}: duplicate scenario id {m.group(0)}")
                else:
                    scen_ids.add(m.group(0))
                if sid not in stories:
                    errors.append(f"{where}: unknown story {sid}")
                else:
                    if rel_key(r) < rel_key(stories[sid]):
                        errors.append(f"{where}: release {r} earlier than story release {stories[sid]}")
                    if r == stories[sid]:
                        seen[sid][k] += 1
            steps = [b.split()[0] for b in body if b and b.split()[0] in ("Given", "When", "Then", "And", "But")]
            if steps.count("When") != 1:
                errors.append(f"{where}: must have exactly one When (atomic)")
            if "Then" not in steps:
                errors.append(f"{where}: no Then")
            text = re.sub(r'"[^"]*"|`[^`]*`|<[^>]*>', "", " ".join([title] + body)).lower()
            for w in AMBIGUOUS:
                if re.search(rf"(?<![\w-]){re.escape(w)}(?![\w-])", text):
                    errors.append(f"{where}: ambiguous word '{w}'")
            tags = []
            i = j - 1
        i += 1

for sid, r in sorted(stories.items()):
    if r in scope:
        for k in ("nominal", "edge"):
            if seen[sid][k] == 0:
                errors.append(f"{sid} ({r}): no @{k} scenario tagged {r}")

in_scope = sum(1 for r in stories.values() if r in scope)
print(f"{count} scenarios · {in_scope} stories in scope {sorted(scope, key=rel_key)}")
print("\n".join(errors) if errors else "all checks passed")
sys.exit(1 if errors else 0)
