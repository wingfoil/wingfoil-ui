Feature: Snapshot, refresh and read errors
  The UI shows the project as the CLI reads it — the working tree — marks elements with
  uncommitted changes, refreshes by itself, and confines a failed read to the affected view
  (S8, S1).

  Background:
    Given the console is running with the kanban fixture open
    And I am Morgan

  # --- US-S-25 — working tree and local changes ---

  @US-S-25 @v0.1 @nominal @fx-kanban
  Scenario: S-25.1 — Mark an element with uncommitted changes
    Given the file of "task-001-login-form" has an uncommitted edit of its title to "Login form v2"
    When I open the Memory list
    Then "task-001-login-form" is listed with the title "Login form v2"
    And it carries the marker "local changes"

  @US-S-25 @v0.1 @edge @fx-kanban
  Scenario: S-25.2 — Remove the marker once the change is committed
    Given "task-001-login-form" carries the marker "local changes"
    When its edit is committed with git outside the UI
    Then within 5 seconds "task-001-login-form" no longer carries the marker "local changes"

  @US-S-25 @v0.1 @edge @fx-kanban
  Scenario: S-25.3 — Show an uncommitted new element
    Given an element file "docs/memory/task/task-009-draft-idea.md" exists in the working tree and is not committed
    When I open the Memory list
    Then "task-009-draft-idea" is listed with the marker "local changes"

  # --- US-S-26 — refresh by itself ---

  @US-S-26 @v0.1 @nominal @fx-kanban
  Scenario: S-26.1 — Refresh after a commit made outside the UI
    Given the Memory list shows "task-001-login-form" in the state "pending"
    When "task-001-login-form" is approved with the CLI in a terminal
    Then within 5 seconds the Memory list shows "task-001-login-form" in the state "approved" without a page reload

  @US-S-26 @v0.1 @edge @fx-kanban
  Scenario: S-26.2 — Refresh an open element panel
    Given the element panel of "task-001-login-form" is open
    When "task-001-login-form" is approved with the CLI in a terminal
    Then within 5 seconds the panel's history lists the approval and its commit

  @US-S-26 @v0.1 @edge @fx-kanban
  Scenario: S-26.3 — Read the CLI once per state of the repository
    Given the Memory list has been loaded
    When I open the Memory list again with no commit and no file change in between
    Then the server runs no new `wingfoil memory search` process

  # --- US-S-27 — failed read ---

  @US-S-27 @v0.1 @nominal @fx-kanban
  Scenario: S-27.1 — Confine a failed DNA read to the DNA view
    Given `.wingfoil/dna.yaml` of the fixture contains invalid YAML
    When I open the DNA view
    Then the DNA view shows the error message printed by the CLI
    And the Memory list opens and lists the fixture's elements

  @US-S-27 @v0.1 @edge @fx-kanban
  Scenario: S-27.2 — Recover when the file is fixed
    Given the DNA view shows the CLI's error for an invalid `.wingfoil/dna.yaml`
    When the file is restored to valid YAML
    Then within 5 seconds the DNA view shows the project's modules
