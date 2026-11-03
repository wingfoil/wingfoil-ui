Feature: Action descriptor and methodology independence
  The actions possible on each element are derived from the project's `memory.yaml`, workflows
  and CLI version (S9): any methodology renders without UI code change, and impossible moves are
  never offered.

  Background:
    Given the console is running

  # --- US-S-28 — three fixtures, no UI change ---

  @US-S-28 @v0.1 @nominal @fx-any
  Scenario Outline: S-28.1 — Render each fixture with the same UI build
    Given the same build of WingFoil UI
    And the <fixture> fixture is added and I am Alex
    When I open the Memory list
    Then the type filters are exactly <types>
    And every element of the fixture is listed with its own state name

    # custom: `sprint` from WingFoil 0.3.0, whose custom fixture is built on the packs' `.wingfoil/`.
    Examples:
      | fixture | types                                                                                  |
      | kanban  | adr, bug, decision-log, release, release-line, task, tech-spec                         |
      | custom  | release-line, release, task, adr, decision-log, tech-spec, bug, plan, sprint, service  |
      | unknown | story, note                                                                            |

  @US-S-28 @v0.1 @edge @fx-unknown
  Scenario: S-28.2 — Derive the state machine of an unknown type
    Given the unknown fixture is added and I am Alex
    When I open the element panel of "story-001-onboarding"
    Then the state machine shows the chips "idea", "shaping", "ready-to-build", "shipped"
    And "shaping" is marked as the current state

  # --- US-S-24 — terminal and engine-waiting states ---

  @US-S-24 @v0.2 @nominal @fx-custom
  Scenario: S-24.1 — Offer no action on a terminal state
    Given the custom fixture is added and I am Morgan
    When I open the element panel of "dl-001-initialise-wingfoil-before-inception"
    Then the panel shows no action footer
    And the state "ready" is marked as the final state

  @US-S-24 @v0.2 @edge @fx-custom
  Scenario: S-24.2 — Show an engine-waiting state as waiting
    Given the custom fixture with the pre-packs states is added and I am Alex
    When I open the element panel of "minor-v0.1"
    Then the panel shows "Waiting for the workflow engine (state: planning)"
    And the panel shows no action button

  @US-S-24 @v0.2 @edge @fx-unknown
  Scenario: S-24.3 — Treat a declared waiting state of an unknown type the same way
    Given the unknown fixture is added and I am Alex
    When I open the element panel of "story-002-billing"
    Then the panel shows "Waiting for the workflow engine (state: ready-to-build)"

  @US-S-24 @v0.2 @edge @fx-custom
  Scenario: S-24.4 — Offer only the reject of a state that is both a gate and a waiting state
    Given the custom fixture with the pre-packs states is added and I am Morgan
    And "bug-001-toast-overlap" has been approved to the state "triaged"
    When I open the element panel of "bug-001-toast-overlap"
    Then the gate footer shows only "Reject → closed" and "Waiting for the workflow engine to advance"
    And Requires you does not list "bug-001-toast-overlap"

  @US-S-24 @v0.3 @nominal @fx-custom
  Scenario: S-24.5 — Hold a gate whose approval is made outside the console
    Given the custom fixture with the sw-life-cycle preset is open on WingFoil 0.3 and I am Morgan with the role view "approver"
    And "minor-v0.1" has been submitted to the state "releasing"
    When I open Today
    Then Requires you does not list "minor-v0.1"
    And Waiting on others lists "minor-v0.1" with "Approved outside the console (ui.yaml)"
    And the gate footer of "minor-v0.1" shows "Approved outside the console (ui.yaml)" and "Reject → in-development", with no "Approve"

  @US-S-24 @v0.3 @edge @fx-custom
  Scenario: S-24.6 — Hold a gate until the elements that reference it are done
    Given the custom fixture with the sw-life-cycle preset is open on WingFoil 0.3 and I am Casey
    And the release line "rl-v1" with version "v1" is in the state "active"
    And "minor-v0.1", with release-line "v1", is in the state "planning"
    When I open Today
    Then Waiting on others lists "rl-v1" with "Waits for 1 referencing element to be done"
    And the gate footer of "rl-v1" shows "Waits for 1 referencing element to be done" and no outcome button

  @US-S-24 @v0.3 @edge @fx-custom
  Scenario: S-24.7 — Disable a move into a state at its limit
    Given the custom fixture is open on WingFoil 0.3 and I am Morgan
    And the Sprint "sprint-001" is in the state "active" and the Sprint "sprint-002" in the state "planned"
    When I open the element panel of "sprint-002"
    Then the action "Submit" is disabled with the reason "Blocked: only 1 active at a time"
