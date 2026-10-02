Feature: Traceability
  From each reference to its linked elements, with completion, coverage and missing references
  (R5; completion as in `ux-reference.md` §7, unweighted mean, Q8).

  Background:
    Given the console is running
    And I am Casey

  # --- US-R-01 ---

  @US-R-01 @v0.3 @nominal @fx-custom
  Scenario: R-01.1 — List references with their completion
    Given the custom fixture with the sw-life-cycle preset is open
    When I open Traceability
    Then it shows "Project completion 25 %" and "Reference coverage 3/4"
    And the row "US-M-01" shows 2 linked elements and "50 % · 1/2"
    And the row "US-S-01" shows 1 linked element and "0 % · 0/1"

  @US-R-01 @v0.3 @edge @fx-custom
  Scenario: R-01.2 — Show who must act on a reference's open elements
    Given the custom fixture with the sw-life-cycle preset is open on Traceability
    When I select the row "US-M-01"
    Then the detail lists "task-2-memory-list · done" and "task-3-element-panel · backlog · waiting for the workflow engine"

  @US-R-01 @v0.3 @edge @fx-custom
  Scenario: R-01.3 — Filter references by status
    Given the custom fixture with the sw-life-cycle preset is open on Traceability
    When I select the status filter "Completed"
    Then the table shows "No reference matches"

  @US-R-01 @v0.3 @edge @fx-unknown
  Scenario: R-01.4 — Explain an empty traceability
    Given the unknown fixture is open
    When I open Traceability
    Then the page shows "No references found — declare taxonomy patterns in ui.yaml"
