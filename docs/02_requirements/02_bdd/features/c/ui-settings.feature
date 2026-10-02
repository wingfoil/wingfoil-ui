Feature: UI settings
  Local, per-user settings — auto-fetch, auto-update, auto-push, theme, agent launch confirmation —
  kept on the user's machine and never committed (C4).

  Background:
    Given the console is running with the kanban fixture open
    And I am Morgan

  # --- US-C-07 ---

  @US-C-07 @v0.2 @nominal @fx-kanban
  Scenario: C-07.1 — Show the settings with their defaults
    Given the UI settings have never been changed
    When I open Configuration › UI settings
    Then "Auto-fetch" is on, "Auto-update" is off, "Auto-push" is off, "Theme" is "System" and "Confirm agent launch" is on

  @US-C-07 @v0.2 @edge @fx-kanban
  Scenario: C-07.2 — Keep a setting across restarts without touching the project
    Given I set "Auto-push" to on
    When I stop the console and run "npx wingfoil-ui" again
    Then "Auto-push" is on
    And `git status --porcelain` of the kanban fixture prints nothing

  @US-C-07 @v0.2 @edge @fx-kanban
  Scenario: C-07.3 — Apply a setting change without a restart
    Given "Auto-fetch" is on
    When I set "Auto-fetch" to off
    Then within 120 seconds the server runs no `git fetch` process
