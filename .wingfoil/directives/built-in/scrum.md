---
id: scrum
name: scrum
type: directive
kind: built-in
format: 1
title: "Scrum"
---

# Scrum

The project runs Scrum as the Scrum Guide (November 2020) defines it: empiricism (transparency,
inspection, adaptation) and the values commitment, focus, openness, respect and courage.

- **Accountabilities.** The Product Owner is `product-owner`, the Scrum Master is `facilitator`,
  the Developers are `developer` with `architect`, `reviewer`, `qa` and `tech-lead`. An agent works
  for the Developers, as their tool, and holds no Scrum accountability; it never approves.
- **The Sprint** lasts 2 weeks, never more than one month, and the next starts only when
  the previous one is done: one Sprint is active at a time. Its events are Sprint Planning (at most
  eight hours for a one-month Sprint), the Daily Scrum (fifteen minutes), the Sprint Review (at
  most four hours) and the Sprint Retrospective (at most three hours), which concludes it; a
  shorter Sprint has shorter events.
- **The Sprint Retrospective** plans ways to increase quality and effectiveness: it runs `base`'s
  `retrospective` for the Sprint, before the Sprint closes.
- **Sprint Planning** answers why the Sprint is valuable (the Sprint Goal, in the sprint's `goal`),
  what can be done (the Sprint Backlog: the tasks whose `sprint` names the Sprint) and how.
- **The Daily Scrum** is fifteen minutes for the Developers to inspect progress toward the Sprint
  Goal and adapt their plan; it leaves no record.
- **Refinement** is continuous: the Product Owner orders the Product Backlog (the tasks in
  `backlog`, `sprint: n/a` with a reason until planned) and the Developers size and split its items.
- **Artefacts and commitments:** the Product Backlog and the Product Goal, the Sprint Backlog and
  the Sprint Goal, the Increment and the Definition of Done.
- **Releases** are the Product Owner's decision, never gated by the Sprint Review: a release
  belongs to the Sprint that carries it (its `sprint`), and none is approved or published before
  that Sprint's Backlog is done or moved.
- **At the end of a Sprint** an unfinished item goes to the next Sprint or back to the Product
  Backlog, by rewriting its `sprint`; a release still open goes to the next Sprint the same way
  before the Sprint Review completes.
- The project chooses how it estimates and plans; nothing here requires user stories, story points
  or burn-down charts.
