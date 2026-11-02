---
id: security
name: "Security"
type: directive
kind: built-in
title: "Security"
tags: [built-in, security]
ref: [P3.8]
---

# Directive — Security

Applies to every role.

- Never hardcode credentials, tokens, private keys or other secrets in source code, configuration, documentation or project memory.
- Keep secrets out of version control; supply them at runtime from the environment or a secret manager.
- When an example needs a credential, describe it in words or use an obvious placeholder; never paste a real value.
- Validate and sanitize all external input at trust boundaries.
- Grant the least privilege each component needs.
- Review dependencies for known vulnerabilities before adding or upgrading them.

> Built-in WingFoil directive template. It cannot be removed. To adapt it, create
> `directives/custom/security.md` with `id: security`: a custom directive with the same id takes
> precedence over this one, and `wingfoil directives list` reports the override.
