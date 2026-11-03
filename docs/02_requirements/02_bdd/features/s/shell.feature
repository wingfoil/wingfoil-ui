Feature: Notifications and all-roles summary
  The bell counts what requires the user (S7); members with several roles see, for each role,
  how many items require it, on one line, and switch to that role view from it (S5; from v0.3 the
  line holds no items — release-planning v0.3, RP3-7 N1).

  Background:
    Given the console is running with the kanban fixture open

  # --- US-S-21 — bell ---

  @US-S-21 @v0.2 @nominal @fx-kanban
  Scenario: S-21.1 — Count the items to unblock
    Given I am Morgan with the role view "approver"
    When I open Today
    Then the bell shows the count 2
    And the bell panel's "To unblock" lists "task-001-login-form" and "bug-001-crash-on-save"
    And the bell panel's "Updates" lists the last 10 Memory events, newest first

  @US-S-21 @v0.2 @edge @fx-kanban
  Scenario: S-21.2 — Show no count when nothing requires me
    Given I am Casey
    When I open Today
    Then the bell shows no count
    And the bell panel's "To unblock" shows "Nothing to unblock"

  @US-S-21 @v0.2 @edge @fx-kanban
  Scenario: S-21.3 — Update the count after an action
    Given I am Morgan and the bell shows the count 2
    When I approve "task-001-login-form" from Today
    Then the bell shows the count 1

  # --- US-S-23 — all-roles summary ---

  @US-S-23 @v0.3 @nominal @fx-kanban
  Scenario: S-23.1 — Summarise what requires each of my roles
    Given I am Alex
    When I open Today
    Then the all-roles summary shows, on one line, one tag for each of the 7 roles Alex holds
    And it shows the tags "approver · 2" and "developer · 0"
    And it lists no element

  @US-S-23 @v0.2 @edge @fx-kanban
  Scenario: S-23.2 — Switch role view from the summary
    Given I am Alex with the role view "developer"
    When I select "approver · 2" in the all-roles summary
    Then the shell shows the role view "approver"
    And Requires you lists "task-001-login-form" and "bug-001-crash-on-save"

  @US-S-23 @v0.2 @edge @fx-kanban
  Scenario: S-23.3 — Show no summary to a single-role member
    Given I am Jordan
    When I open Today
    Then no all-roles summary is shown

  @US-S-23 @v0.3 @edge @fx-kanban
  Scenario: S-23.4 — Show the count of a role, not its items
    Given 5 elements of the kanban fixture are in the state "pending"
    And I am Alex
    When I open Today
    Then the all-roles summary shows the tag "approver · 5"
    And it lists no element and no link "more"
