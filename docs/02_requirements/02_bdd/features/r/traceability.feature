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
    Then it shows "Project completion 25 %" and "Reference coverage 3/5"
    And the row "US-M-01" shows 2 linked elements and "50 % · 1/2"
    And the row "US-S-01" shows 1 linked element and "0 % · 0/1"

  @US-R-01 @v0.3 @edge @fx-custom
  Scenario: R-01.2 — Show who must act on a reference's open elements
    Given the custom fixture with the pre-packs states and the sw-life-cycle preset is open on Traceability
    When I select the row "US-M-01"
    Then the detail lists "task-002 · Memory list · done" and "task-003 · Element panel · backlog · Waiting for the workflow engine"

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

  @US-R-01 @v0.3 @edge @fx-custom
  Scenario: R-01.5 — Show the rows outside the current release under the whole project
    Given `ref: US-S-09` is added to "dl-001-initialise-wingfoil-before-inception" and committed outside the UI
    And the custom fixture with the sw-life-cycle preset is open on Traceability, its scope "minor-v0.1 (current release)"
    When I select the scope "Whole project"
    Then the row "US-S-09" lists the linked element "dl-001"
    And before the selection the table had no row "US-S-09"

  @US-R-01 @v0.3 @edge @fx-custom
  Scenario: R-01.6 — Show a pattern reference by its id only
    Given the custom fixture with the sw-life-cycle preset is open
    When I open Traceability
    Then the reference cell of the row "US-M-01" shows the category "requirement" and the id "US-M-01" only, with no title and no hover card

  @US-R-01 @v0.3 @edge @fx-custom
  Scenario: R-01.7 — List references between Memory elements without ui.yaml
    Given `related: dl-001-initialise-wingfoil-before-inception` is added to "task-001-cli-adapter" and committed outside the UI
    And the custom fixture without `ui.yaml` is open
    When I open Traceability
    Then a note reads "No ui.yaml — only references to other Memory elements are recognised"
    And the row of "dl-001-initialise-wingfoil-before-inception" shows the category "decision" and the linked element "task-001"

  @US-R-01 @v0.3 @edge @fx-custom
  Scenario: R-01.8 — Open the elements missing required references in Memory
    Given the custom fixture with the sw-life-cycle preset is open on Traceability
    When I select "Show in Memory" in the section "Elements missing required references (2)"
    Then the Memory list shows exactly "task-004-themes" and "adr-001-local-server"
    And the active filter reads "Missing required references"

  @US-R-01 @v0.3 @edge @fx-custom
  Scenario: R-01.9 — Filter references by category
    Given the custom fixture with the sw-life-cycle preset is open on Traceability
    When I select the category filter "requirement"
    Then the table shows exactly the rows "US-M-01" and "US-S-01"
