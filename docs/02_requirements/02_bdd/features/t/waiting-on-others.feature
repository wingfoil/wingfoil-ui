Feature: Waiting on others
  Today lists the items blocked on another role, with the role and the members who hold it
  (T4, R3).

  Background:
    Given the console is running

  # --- US-T-11 ---

  @US-T-11 @v0.2 @nominal @fx-kanban
  Scenario: T-11.1 — List the items blocked on another member
    Given the kanban fixture is open and I am Morgan
    When I open Today
    Then Waiting on others lists "task-2-password-reset" with "Jordan (submitter) must act"
    And Waiting on others lists "task-4-session-timeout" with "Jordan (creator) must act"

  @US-T-11 @v0.2 @edge @fx-custom
  Scenario: T-11.2 — Name the workflow engine for an engine-waiting state
    Given the custom fixture is open and I am Morgan
    When I open Today
    Then Waiting on others lists "minor-v0.1" with "Waiting for the workflow engine"

  @US-T-11 @v0.2 @edge @fx-kanban
  Scenario: T-11.3 — Do not repeat an item that requires me
    Given the kanban fixture is open and I am Morgan with the role view "approver"
    When I open Today
    Then Waiting on others does not list "task-1-login-form"
