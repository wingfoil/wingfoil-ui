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

    Examples:
      | fixture | types                                                                                  |
      | kanban  | adr, bug, decision-log, release, release-line, task, tech-spec                         |
      | custom  | release-line, release, task, adr, decision-log, tech-spec, bug, plan, service          |
      | unknown | story, note                                                                            |

  @US-S-28 @v0.1 @edge @fx-unknown
  Scenario: S-28.2 — Derive the state machine of an unknown type
    Given the unknown fixture is added and I am Alex
    When I open the element panel of "story-1-onboarding"
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
    Given the custom fixture is added and I am Alex
    When I open the element panel of "minor-v0.1"
    Then the panel shows "Waiting for the workflow engine (state: planning)"
    And the panel shows no action button

  @US-S-24 @v0.2 @edge @fx-unknown
  Scenario: S-24.3 — Treat a declared waiting state of an unknown type the same way
    Given the unknown fixture is added and I am Alex
    When I open the element panel of "story-2-billing"
    Then the panel shows "Waiting for the workflow engine (state: ready-to-build)"
