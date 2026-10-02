Feature: Action feedback
  A toast with the result and the `wf(…)` commit, "pushed" when it was pushed; a red toast with
  the CLI's own reason on refusal (G4).

  Background:
    Given the console is running

  # --- US-G-13 — success ---

  @US-G-13 @v0.2 @nominal @fx-kanban
  Scenario: G-13.1 — Show the commit and "pushed" after an approval
    Given the kanban fixture is open and I am Morgan
    And the UI setting "Auto-push" is on
    When I approve "task-1-login-form" with the reason "OK"
    Then a toast shows "Approved task-1-login-form", the commit line "wf(task): approve task-1-login-form [pending → approved]" with its short hash, and "pushed"
    And the remote's branch is at that commit

  @US-G-13 @v0.2 @edge @fx-kanban
  Scenario: G-13.2 — Show the commit without "pushed" when auto-push is off
    Given the kanban fixture is open and I am Morgan
    And the UI setting "Auto-push" is off
    When I approve "task-1-login-form" with the reason "OK"
    Then the toast shows the commit line without "pushed"
    And the sidebar shows "1 commit to push"

  # --- US-G-14 — refusal ---

  @US-G-14 @v0.2 @nominal @fx-custom
  Scenario: G-14.1 — Show the CLI's reason when a submit is refused
    Given the custom fixture is open and I am Alex with the role view "architect"
    And "adr-1-local-server" is a committed `draft` created by Alex with an empty required field "sard_ref"
    When I submit "adr-1-local-server" from its panel
    Then a red toast shows the error message printed by `wingfoil memory submit`, naming "sard_ref"
    And "adr-1-local-server" is still in the state "draft"
    And the fixture's last commit is unchanged

  @US-G-14 @v0.2 @edge @fx-kanban
  Scenario: G-14.2 — Show the CLI's reason when the element moved in the meantime
    Given the kanban fixture is open and I am Morgan
    And the gate footer of "task-1-login-form" is open
    And "task-1-login-form" has been approved with the CLI in a terminal before the panel refreshed
    When I click "Reject → draft" with the reason "Too late"
    Then a red toast shows the error message printed by `wingfoil memory reject`
    And the panel shows "task-1-login-form" in the state "approved"
