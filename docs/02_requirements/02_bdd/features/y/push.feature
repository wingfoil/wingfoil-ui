Feature: Push
  UI commits are pushed automatically when the setting says so (off by default), or with *Push*;
  a rejected push keeps the commit local (Y3, C4, G4).

  Background:
    Given the console is running with the kanban fixture open
    And I am Morgan

  # --- US-Y-07 ---

  @US-Y-07 @v0.2 @nominal @fx-kanban
  Scenario: Y-07.1 — Push with the button
    Given the UI setting "Auto-push" is off
    And I approved "task-1-login-form" from the UI
    When I click "Push" in the sidebar
    Then the remote's branch is at the fixture's HEAD
    And the sidebar shows "In sync with git"

  @US-Y-07 @v0.2 @edge @fx-kanban
  Scenario: Y-07.2 — Keep auto-push off by default
    Given the UI settings have never been changed
    When I approve "task-1-login-form" from the UI
    Then the remote's branch does not contain the approval commit
    And the sidebar shows "1 commit to push" with the "Push" button

  @US-Y-07 @v0.2 @edge @fx-kanban
  Scenario: Y-07.3 — Push automatically after a UI action
    Given the UI setting "Auto-push" is on
    When I approve "task-1-login-form" from the UI
    Then the remote's branch is at the approval commit

  # --- US-Y-08 ---

  @US-Y-08 @v0.2 @nominal @fx-kanban
  Scenario: Y-08.1 — Report a push rejected because the remote moved
    Given the UI setting "Auto-push" is on
    And a commit has been pushed to the remote by someone else and not yet fetched
    When I approve "task-1-login-form" from the UI
    Then a red toast shows "Not pushed" with the rejection printed by git
    And the approval commit stays in the fixture
    And the sidebar shows "1 ahead"

  @US-Y-08 @v0.2 @edge @fx-kanban
  Scenario: Y-08.2 — Report a push refused for permission
    Given the remote refuses pushes from the credentials available to git
    And the fixture has 1 commit to push
    When I click "Push" in the sidebar
    Then a red toast shows "Not pushed" with the error printed by git
    And the sidebar shows "1 commit to push"
