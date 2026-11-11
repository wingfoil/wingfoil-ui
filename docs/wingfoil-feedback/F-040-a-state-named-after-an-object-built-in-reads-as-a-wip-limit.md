---
id: F-040
title: "A state named after an Object built-in (`constructor`, `toString`, `__proto__`) reads as a WIP limit: every move into it is refused"
kind: defect
status: open
wingfoil_version: 0.3.1
answered_by: []
---

Reports W-51.

## Observed

WingFoil 0.3.1 from npm (`0.3.1 (870bd4406f3b9bba5ecde7a5f8198b80c2a98583)`), Linux, 2026-11-11, in
a scratch git repository holding this repository's `.wingfoil/` and one more type, committed:

```yaml
  probe:
    path: "docs/probe/{id}.md"
    id_pattern: "probe-{n}"
    template:
      file: "memory/templates/probe.md"
      frontmatter:
        required: [ title ]
    states:
      sequence: [ draft, "constructor", done ]
      limits: { done: 1 }
```

`limits` declares no limit on `constructor`, and no element is in it:

```
$ wingfoil memory add --type probe --title "Probe one" --format json
{"id":"probe-001","path":"docs/probe/probe-001.md"}
exit 0
$ wingfoil memory submit probe-001
error: WIP limit reached for 'constructor' on type 'probe' (limit function Object() { [native code] }): held by . Move one of them out of 'constructor', then retry. The holders are counted at HEAD and on every local and remote-tracking branch that changed them since it forked from HEAD, so the count depends on which refs were last fetched; a holder another branch records is moved out on that branch.
exit 1
```

The same happens with the state named `toString` (`limit function toString() { [native code] }`)
and with `__proto__` (`limit [object Object]`), each `held by` no one. `requireWipSlot`
(`dist/core/memory-transition.js`) reads `machine.limits?.[state]` on the object built from the
`limits` record, so a name that `Object.prototype` defines finds the prototype's member instead of
`undefined`. `memory.yaml` passes validation: the names are ordinary `sequence` states, and the
schema accepts them as `limits` keys too. The element can then never leave `draft` by `submit`.

## Expected

A state takes a WIP slot only when `limits` declares it as an own key: read the limit with
`Object.hasOwn(limits, state)`, or build the record on a null prototype. The same applies to every
other record keyed by a state or type name (`gates`, `returns`). The move above is then accepted:
`constructor` declares no limit.

Suggested kind in WingFoil: defect (a refused legal transition).
