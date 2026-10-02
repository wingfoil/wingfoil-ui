Feature: Memory list
  Type filters from `memory.yaml` with counts, state filters (buckets for all types, real states
  per type), each item opening its element panel (M1, S9). Buckets with *All types*: **To approve**
  (gate states that are not `waiting:` states) · **In progress** (other intermediate states, and
  states not declared for the type) · **Waiting/drafts/closed** (first state, `waiting:` states —
  including those that are also gates, e.g. custom `bug` `triaged` — reject targets with no way
  out) · **Done** (last state of `sequence`).

  Background:
    Given the console is running

  # --- US-M-01 ---

  @US-M-01 @v0.1 @nominal @fx-kanban
  Scenario: M-01.1 — Filter by type with counts
    Given the kanban fixture is open
    When I open the Memory list
    Then the type filter "task" shows the count 4 and "bug" shows the count 1

  @US-M-01 @v0.1 @nominal @fx-kanban
  Scenario: M-01.5 — List one type with its real states
    Given the kanban fixture is open on the Memory list
    When I select the type filter "task"
    Then the list shows exactly "task-001-login-form", "task-002-password-reset", "task-003-logout", "task-004-session-timeout"
    And the state filters are exactly "draft", "pending", "approved"

  @US-M-01 @v0.1 @edge @fx-kanban
  Scenario: M-01.2 — Filter all types by bucket
    Given the kanban fixture is open
    When I select the type filter "All types" and the bucket "To approve"
    Then the list shows exactly "task-001-login-form" and "bug-001-crash-on-save"

  @US-M-01 @v0.1 @edge @fx-kanban
  Scenario: M-01.3 — Open the element panel from the list
    Given the kanban fixture is open on the Memory list
    When I select the row of "task-003-logout"
    Then the element panel of "task-003-logout" opens

  @US-M-01 @v0.1 @edge @fx-kanban
  Scenario: M-01.4 — Show a type with no element
    Given the kanban fixture is open
    When I select the type filter "adr"
    Then the type filter "adr" shows the count 0
    And the list shows "No adr yet"

  # --- US-M-02 ---

  @US-M-02 @v0.1 @nominal @fx-unknown
  Scenario: M-02.1 — List unknown types under their own names
    Given the unknown fixture is open
    When I open the Memory list
    Then the type filters are exactly "story" (2) and "note" (2)

  @US-M-02 @v0.1 @nominal @fx-unknown
  Scenario: M-02.3 — Show the declared states of an unknown type
    Given the unknown fixture is open on the Memory list
    When I select the type filter "story"
    Then the state filters are exactly "idea", "shaping", "ready-to-build", "shipped"

  @US-M-02 @v0.1 @edge @fx-unknown
  Scenario Outline: M-02.2 — Group unknown states in generic buckets
    Given the unknown fixture is open
    When I select the type filter "All types" and the bucket "<bucket>"
    Then the list shows exactly <elements>

    Examples:
      | bucket                | elements                                  |
      | To approve            | "story-001-onboarding"                      |
      | In progress           | "note-002-retro"                            |
      | Waiting/drafts/closed | "story-002-billing", "note-001-kickoff"       |
      | Done                  | no element                                |
