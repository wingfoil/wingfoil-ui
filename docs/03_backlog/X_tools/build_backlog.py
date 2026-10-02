#!/usr/bin/env python3
"""backlog-export: build docs/03_backlog/04_backlog/backlog.json and by-release/*.json from the
story map, the BDD scenarios and the SARD. Deterministic: same inputs, same bytes.

Usage: python3 docs/03_backlog/X_tools/build_backlog.py
"""
import json, pathlib, re

ROOT = pathlib.Path(__file__).resolve().parents[3]
REQ = ROOT / "docs" / "02_requirements"
OUT = ROOT / "docs" / "03_backlog" / "04_backlog"
WINGFOIL_MIN = {"v0.1": "0.2.2", "v0.2": "0.2.2", "v0.3": "0.2.2", "v0.4": "0.3", "v1.0": "1.0"}
RELEASES = list(WINGFOIL_MIN)

# Technical-task order (map-dependencies): a task depends on the tasks it builds on.
TT_DEPS = {
    "ARC-01": [], "ARC-02": ["ARC-01"], "ARC-03": ["ARC-02"], "ARC-04": ["ARC-02"],
    "ARC-05": ["ARC-06"], "ARC-06": ["ARC-04"], "ARC-07": ["ARC-04"], "ARC-08": ["ARC-01"],
    "ARC-09": ["ARC-01"], "ARC-10": ["ARC-01"], "ARC-11": ["ARC-01"],
    "PERF-01": ["PERF-05", "ARC-06"], "PERF-02": ["ARC-03"], "PERF-03": ["INT-09"],
    "PERF-04": ["PERF-05"], "PERF-05": ["STATE-02"], "PERF-06": ["ARC-01"],
    "PERF-07": ["INT-06", "STATE-09"], "PERF-08": ["INT-07", "INT-09"], "PERF-09": ["ARC-06"],
    "PERF-10": ["ARC-06"], "PERF-11": ["ARC-06"],
    "STATE-01": ["STATE-02"], "STATE-02": ["ARC-04"], "STATE-03": ["STATE-01", "ARC-03"],
    "STATE-04": ["INT-06", "ARC-03"], "STATE-05": ["ARC-04"], "STATE-06": ["STATE-05"],
    "STATE-07": ["INT-06", "ARC-08"], "STATE-08": ["ARC-07"], "STATE-09": ["ARC-08"],
    "INT-01": ["ARC-02"], "INT-02": ["INT-01"], "INT-03": ["INT-02"], "INT-04": ["ARC-02"],
    "INT-05": ["INT-03", "ARC-03"], "INT-06": ["ARC-01"], "INT-07": ["INT-01"],
    "INT-08": ["ARC-01"], "INT-09": ["STATE-02", "SEC-02"],
    "SEC-01": ["ARC-01"], "SEC-02": ["ARC-01"], "SEC-03": ["ARC-01"], "SEC-04": ["ARC-01"],
    "SEC-05": ["ARC-02"], "SEC-06": ["ARC-01"], "SEC-07": ["ARC-06"], "SEC-08": ["STATE-05"],
    "SEC-09": ["ARC-08"], "SEC-10": ["ARC-03"],
}

def version_of(path):
    m = re.search(r"^\*\*Version:\*\* ([\d.]+)", path.read_text(), re.M)
    return f"{path.relative_to(ROOT)} v{m.group(1)}"

def scenarios():
    out = {}
    for f in sorted((REQ / "02_bdd" / "features").rglob("*.feature")):
        lines = f.read_text().splitlines()
        background, tags, cur = [], [], None
        in_bg = False
        for ln in lines:
            s = ln.strip()
            if s.startswith("Background:"):
                in_bg, cur = True, None; continue
            if s.startswith("@"):
                tags = s.split(); in_bg = False; continue
            m = re.match(r"Scenario(?: Outline)?: ([A-Z]-\d\d\.\d+) — (.*)", s)
            if m:
                in_bg = False
                t = {x[1:] for x in tags}
                cur = {"id": m.group(1), "title": m.group(2),
                       "file": str(f.relative_to(ROOT)),
                       "release": next(x for x in t if re.fullmatch(r"v\d+\.\d+", x)),
                       "kind": "nominal" if "nominal" in t else "edge",
                       "fixture": next(x for x in t if x.startswith("fx-"))[3:],
                       "story": next(x for x in t if x.startswith("US-")),
                       "steps": list(background)}
                out[cur["id"]] = cur; tags = []
                continue
            if re.match(r"(Given|When|Then|And|But) ", s):
                (background if in_bg else cur["steps"] if cur else background).append(s)
            elif s.startswith("|") and cur:
                cur["steps"].append("| " + s.strip("| ").strip())
            elif s.startswith("Examples:") and cur:
                pass
    return out

def main():
    sc = scenarios()
    sm_path = REQ / "01_user_story_map" / "02_story-map.md"
    rows = re.findall(r"^\| (US-[A-Z]-\d\d) \| (.*?) \| ([^|]*) \| ([^|]*) \| \[MVP · (v[\d.]+)\] \| ([NE]) \|",
                      sm_path.read_text(), re.M)
    reqs = []
    for f in sorted((REQ / "03_sard").glob("0[1-9]_*.md")):
        for m in re.finditer(r"^### (REQ-([A-Z]+)-(\d\d)) — (.+?)\n(.*?)(?=^### |\Z)", f.read_text(), re.M | re.S):
            fields = dict(re.findall(r"^\| ([A-Za-z ]+?) \| (.*) \|$", m.group(5), re.M))
            reqs.append((m.group(1), m.group(2), m.group(3), m.group(4), fields))

    tts = []
    for rid, area, n, title, fl in reqs:
        key = f"{area}-{n}"
        rel = re.search(r"v\d+\.\d+", fl["Release"]).group(0)
        trace = fl["Traceability"]
        tts.append({
            "id": f"TT-{key}", "kind": "technical-task", "title": title.replace("*", ""),
            "release": rel, "area": area, "wingfoil_min": WINGFOIL_MIN[rel],
            "requirement": rid, "description": fl["Description"],
            "fit_criterion": fl["Fit criterion"], "verified_by": fl["Verified by"],
            "stories": sorted(set(re.findall(r"US-[A-Z]-\d\d", trace))),
            "acceptance_criteria": [strip(sc[s]) for s in dict.fromkeys(re.findall(r"\b[A-Z]-\d\d\.\d+\b", trace))],
            "dependencies": [f"TT-{d}" for d in TT_DEPS[key]],
        })
    rank = {r: i for i, r in enumerate(RELEASES)}
    stories = []
    for sid, text, feats, journeys, rel, kind in rows:
        persona = re.match(r"As (.+?),", text).group(1)
        persona = re.sub(r"^(a member)( .*)?$", r"\1", persona)
        crit = [strip(s) for s in sc.values() if s["story"] == sid]
        deps = sorted(t["id"] for t in tts if sid in t["stories"] and rank[t["release"]] <= rank[rel])
        stories.append({
            "id": sid, "kind": "user-story",
            "title": title_of(text),
            "release": rel, "area": sid.split("-")[1], "wingfoil_min": WINGFOIL_MIN[rel],
            "story": text.replace("*", ""), "persona": persona, "story_kind": "nominal" if kind == "N" else "edge",
            "features": re.findall(r"\b[A-Z]\d+\b", feats), "journeys": journeys.strip(),
            "acceptance_criteria": crit, "dependencies": deps,
        })
    gen = {"story_map": version_of(sm_path),
           "bdd": version_of(REQ / "02_bdd" / "00_conventions.md"),
           "sard": version_of(REQ / "03_sard" / "00_sard.md")}
    items = stories + tts
    write(OUT / "backlog.json", {"version": 1, "generated_from": gen, "items": items})
    for r in RELEASES:
        write(OUT / "by-release" / f"{r}.json",
              {"version": 1, "release": r, "generated_from": gen, "items": [i for i in items if i["release"] == r]})
    print(f"{len(stories)} user stories + {len(tts)} technical tasks → {OUT.relative_to(ROOT)}")

def title_of(text):
    t = re.split(r",? I want (?:to )?", text, maxsplit=1)[1]
    t = re.split(r"(?:,| —) so that ", t)[0]
    t = t.replace("`", "").replace("*", "").strip(" ,—")
    return (t[:1].upper() + t[1:])[:120]

def strip(s):
    return {k: v for k, v in s.items() if k != "story"}

def write(path, data):
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")

if __name__ == "__main__":
    main()
