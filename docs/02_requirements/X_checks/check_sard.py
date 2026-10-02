#!/usr/bin/env python3
"""Stop-check of volere-requirements: Volere shell, fit-criterion class, traceability links.

Usage: python3 docs/02_requirements/X_checks/check_sard.py
Exit status 0 when every check passes.
"""
import pathlib, re, sys, collections

REQ = pathlib.Path(__file__).resolve().parents[1]
SARD = REQ / "03_sard"
FIELDS = ["Release", "Description", "Rationale", "Traceability", "Fit criterion", "Verified by"]
errors = []

stories = set(re.findall(r"^\| (US-[A-Z]-\d\d) \|", (REQ / "01_user_story_map" / "02_story-map.md").read_text(), re.M))
scenarios = set()
for f in (REQ / "02_bdd" / "features").rglob("*.feature"):
    scenarios |= set(re.findall(r"Scenario(?: Outline)?: ([A-Z]-\d\d\.\d+) — ", f.read_text()))

reqs, per_area = {}, collections.Counter()
for f in sorted(SARD.glob("0[1-9]_*.md")):
    text = f.read_text()
    for m in re.finditer(r"^### (REQ-([A-Z]+)-\d\d) — (.+?)\n(.*?)(?=^### |\Z)", text, re.M | re.S):
        rid, area, body = m.group(1), m.group(2), m.group(4)
        if rid in reqs: errors.append(f"{rid}: duplicate id")
        reqs[rid] = f.name; per_area[area] += 1
        rows = dict(re.findall(r"^\| ([A-Za-z ]+?) \| (.*) \|$", body, re.M))
        for fld in FIELDS:
            if not rows.get(fld, "").strip(): errors.append(f"{rid}: missing field '{fld}'")
        fit = rows.get("Fit criterion", "")
        cls = re.match(r"\[(boolean|numeric|percentage)\] ", fit)
        if not cls:
            errors.append(f"{rid}: fit criterion must start with [boolean], [numeric] or [percentage]")
        elif cls.group(1) in ("numeric", "percentage") and not re.search(r"\d", fit):
            errors.append(f"{rid}: {cls.group(1)} fit criterion has no number")
        elif cls.group(1) == "percentage" and "%" not in fit:
            errors.append(f"{rid}: percentage fit criterion has no %")
        trace = rows.get("Traceability", "")
        for s in re.findall(r"US-[A-Z]-\d\d", trace):
            if s not in stories: errors.append(f"{rid}: unknown story {s}")
        for s in re.findall(r"\b[A-Z]-\d\d\.\d+\b", trace):
            if s not in scenarios: errors.append(f"{rid}: unknown scenario {s}")

index = (SARD / "00_sard.md").read_text()
cov = index.split("## Coverage", 1)[1]
for ref in re.findall(r"REQ-[A-Z]+-\d\d", cov):
    if ref not in reqs: errors.append(f"00_sard.md coverage cites unknown {ref}")
for area, n in re.findall(r"\(`([A-Z]+)`\) \| \[[^\]]+\]\([^)]+\) \| (\d+) \|", index):
    if per_area[area] != int(n): errors.append(f"00_sard.md says {n} {area} requirements, found {per_area[area]}")
total = re.search(r"\*\*Total\*\* \| \| \*\*(\d+)\*\*", index)
if not total or int(total.group(1)) != len(reqs): errors.append(f"00_sard.md total differs from {len(reqs)}")

print(f"{len(reqs)} requirements · " + ", ".join(f"{a} {n}" for a, n in sorted(per_area.items())))
print("\n".join(errors) if errors else "all checks passed")
sys.exit(1 if errors else 0)
