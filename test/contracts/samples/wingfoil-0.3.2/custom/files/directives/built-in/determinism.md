---
id: determinism
name: determinism
type: directive
kind: built-in
format: 1
title: "Determinism"
---

# Determinism

The same inputs give the same outputs, wherever and whenever the project is built or run.

- Do not depend on the clock, the locale, the time zone, random values, the host or the order a
  file system lists files in, unless the behaviour is about them; then make them inputs.
- Sort what is written out: keys, lists and files, in a stated order.
- Pin what the build reads: dependencies through a lockfile or exact versions, tools to stated
  versions.
- A test that passes or fails without a change is a defect: fix it or remove it, never retry it.
- A reviewer checks these rules on every change and reports a departure as a finding.
