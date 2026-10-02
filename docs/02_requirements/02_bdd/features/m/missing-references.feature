Feature: Missing references
  A filter and a badge for elements missing a reference their type requires (`ui.yaml`
  `taxonomy.requires`); hidden when nothing is required (M2, S3).

  Background:
    Given the console is running
    And I am Morgan

  # --- US-M-03 ---

  @US-M-03 @v0.3 @nominal @fx-custom
  Scenario: M-03.1 — Filter the elements missing a required reference
    Given the custom fixture with the sw-life-cycle preset is open on the Memory list
    When I select the filter "Missing required references"
    Then the list shows exactly "task-4-themes"
    And its row carries the badge "missing refs"

  @US-M-03 @v0.3 @edge @fx-custom
  Scenario: M-03.2 — Drop the badge when the reference is added
    Given the custom fixture with the sw-life-cycle preset is open
    When `ref: US-X-08` is added to "task-4-themes" and committed outside the UI
    Then within 5 seconds "task-4-themes" no longer carries the badge "missing refs"

  # --- US-M-04 ---

  @US-M-04 @v0.3 @nominal @fx-unknown
  Scenario: M-04.1 — Hide the filter when no type requires references
    Given the unknown fixture is open on the Memory list
    When I look at the state filters
    Then no filter "Missing required references" is shown

  @US-M-04 @v0.3 @edge @fx-custom
  Scenario: M-04.2 — Hide the filter on the custom fixture without ui.yaml
    Given the custom fixture without `ui.yaml` is open on the Memory list
    When I look at the state filters
    Then no filter "Missing required references" is shown
