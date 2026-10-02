Feature: ui.yaml and presets
  Taxonomy and Progress tabs explaining each key (declared or inferred); a preset written as one
  `chore(ui)` commit touching only `.wingfoil/ui.yaml`, schema-validated before writing, applied by
  any team member (C1; write class (b)). The UI keeps no permissions: they are WingFoil's (L6).

  Background:
    Given the console is running

  # --- US-C-01 — Taxonomy and Progress tabs ---

  @US-C-01 @v0.3 @nominal @fx-kanban
  Scenario: C-01.1 — Show inferred values on a project without ui.yaml
    Given the kanban fixture is open and I am Alex
    When I open Configuration › Taxonomy
    Then the row "task" shows the category "work" marked "inferred"
    And the row "bug" shows the category "defect" marked "inferred"
    And the page explains the 8 UI categories "work, defect, decision, spec, requirement, feature, release, external"

  @US-C-01 @v0.3 @edge @fx-custom
  Scenario: C-01.2 — Show declared values from ui.yaml
    Given the custom fixture with the sw-life-cycle preset is open and I am Alex
    When I open Configuration › Progress
    Then the key "scope" shows the type "release" marked "declared" and the current element "minor-v0.1" marked "derived"
    And the key "mode" shows "sequence" with its allowed values "sequence | flow"

  @US-C-01 @v0.3 @edge @fx-unknown
  Scenario: C-01.3 — Mark a type with no inferable category
    Given the unknown fixture is open and I am Alex
    When I open Configuration › Taxonomy
    Then the row "story" shows "No category — not counted in progress figures"

  # --- US-C-02 — apply a preset ---

  @US-C-02 @v0.3 @nominal @fx-kanban
  Scenario: C-02.1 — Apply the Kanban preset as one chore(ui) commit
    Given the kanban fixture is open and I am Morgan
    When I click "Use preset", choose "Kanban" and confirm
    Then the fixture's last commit is "chore(ui): apply the Kanban preset"
    And that commit changes exactly 1 file: ".wingfoil/ui.yaml"
    And Configuration › Taxonomy marks every value "declared"

  @US-C-02 @v0.3 @edge @fx-kanban
  Scenario: C-02.2 — Leave other staged changes out of the commit
    Given the kanban fixture is open and I am Morgan
    And "README.md" has a staged change
    When I apply the "Kanban" preset
    Then the preset commit changes only ".wingfoil/ui.yaml"
    And "README.md" is still staged and uncommitted

  @US-C-02 @v0.3 @edge @fx-custom
  Scenario: C-02.3 — Offer no preset when ui.yaml exists
    Given the custom fixture with the sw-life-cycle preset is open and I am Alex
    When I open Configuration › Taxonomy
    Then no "Use preset" button is shown

  @US-C-02 @v0.3 @edge @fx-kanban
  Scenario: C-02.5 — Offer no preset to a user who is not in the team
    Given the kanban fixture is open and I am Riley
    When I open Configuration › Taxonomy
    Then "Use preset" is not shown

  @US-C-02 @v0.3 @edge @fx-kanban
  Scenario: C-02.4 — Block the preset while the copy is behind
    Given the kanban fixture is open and I am Morgan
    And the fixture is 1 commit behind its fetched remote
    When I open Configuration › Taxonomy
    Then "Use preset" is disabled with "Blocked: your copy is 1 commit behind the remote — Update"

  # --- US-C-03 — schema check before writing ---

  @US-C-03 @v0.3 @nominal @fx-kanban
  Scenario: C-03.1 — Refuse a preset that fails the schema
    Given a test build whose "Kanban" preset lacks the required key "version"
    And the kanban fixture is open and I am Morgan
    When I apply the "Kanban" preset
    Then a red toast shows "ui.yaml not written: missing required key version"
    And ".wingfoil/ui.yaml" does not exist
    And the fixture's last commit is unchanged

  @US-C-03 @v0.3 @edge @fx-kanban
  Scenario: C-03.2 — Refuse a preset that maps a type the project does not declare
    Given the kanban fixture is open and I am Morgan
    When I apply the "Scrum" preset, which maps the type "story"
    Then a red toast shows "ui.yaml not written: type story is not declared in memory.yaml"
    And ".wingfoil/ui.yaml" does not exist

  # --- US-C-04 — invalid existing ui.yaml ---

  @US-C-04 @v0.3 @nominal @fx-kanban
  Scenario: C-04.1 — Fall back to inferred values when ui.yaml is invalid
    Given the kanban fixture has a committed ".wingfoil/ui.yaml" whose `progress.mode` is "spiral"
    And I am Alex
    When I open Today
    Then a warning reads "ui.yaml ignored: progress.mode must be sequence or flow (found spiral)"
    And the progress card shows the scope "Whole project"

  @US-C-04 @v0.3 @edge @fx-kanban
  Scenario: C-04.2 — Treat unparsable ui.yaml the same way
    Given the kanban fixture has a committed ".wingfoil/ui.yaml" that is not valid YAML
    When I open Configuration › Taxonomy
    Then a warning names the YAML error and its line
    And every value is marked "inferred"
