Feature: Actions blocked on local changes and while behind
  A UI action never commits someone's uncommitted edits (the CLI would include them) and never
  acts on a stale copy (G2, G3, S8, Y4).

  Background:
    Given the console is running with the kanban fixture open
    And I am Morgan

  # --- US-G-11 — local changes ---

  @US-G-11 @v0.2 @nominal @fx-kanban
  Scenario: G-11.1 — Block a gate on an element with local changes
    Given the file of "task-001-login-form" has an uncommitted edit
    When I open the gate footer of "task-001-login-form"
    Then "Approve → approved" and "Reject → draft" are disabled
    And the footer shows "Blocked: this element has local changes — commit or discard them first"

  @US-G-11 @v0.2 @edge @fx-kanban
  Scenario: G-11.2 — Block a submit on an element with local changes
    Given I am Jordan
    And the file of "task-004-session-timeout" has an uncommitted edit
    When I open the element panel of "task-004-session-timeout"
    Then "Submit" is disabled with "Blocked: this element has local changes — commit or discard them first"

  @US-G-11 @v0.2 @edge @fx-kanban
  Scenario: G-11.3 — Do not block an element when only another file has local changes
    Given the file "README.md" has an uncommitted edit
    When I open the gate footer of "task-001-login-form"
    Then "Approve → approved" is enabled

  # --- US-G-12 — behind the remote ---

  @US-G-12 @v0.2 @nominal @fx-kanban
  Scenario: G-12.1 — Block governed actions while behind
    Given the remote has 1 commit that the fixture does not have, and it has been fetched
    When I open the gate footer of "task-001-login-form"
    Then "Approve → approved" and "Reject → draft" are disabled
    And the footer shows "Blocked: your copy is 1 commit behind the remote — Update"

  @US-G-12 @v0.2 @edge @fx-kanban
  Scenario: G-12.2 — Unblock after the update
    Given the footer of "task-001-login-form" shows "Blocked: your copy is 1 commit behind the remote — Update"
    When I click "Update" in that message
    Then the fixture is at the remote's commit
    And "Approve → approved" is enabled

  @US-G-12 @v0.2 @edge @fx-kanban
  Scenario: G-12.3 — Do not block when the copy is only ahead
    Given the fixture has 1 commit that the remote does not have, and none the other way
    When I open the gate footer of "task-001-login-form"
    Then "Approve → approved" is enabled
