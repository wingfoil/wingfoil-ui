Feature: Requires you
  Today lists the items whose next move needs one of the role view's roles, computed by the
  action descriptor (T1, S9); a project opens on Today from v0.2.

  Background:
    Given the console is running

  # --- US-T-01 — open on Today ---

  @US-T-01 @v0.2 @nominal @fx-kanban
  Scenario: T-01.1 — Open a newly added project on Today
    Given I am Morgan
    When I add the local folder of the kanban fixture
    Then Today opens with the greeting "Morgan, 2 things require you"
    And the greeting shows the role view "approver"

  @US-T-01 @v0.2 @edge @fx-kanban
  Scenario: T-01.2 — Open on Today read-only for a user who is not in the team
    Given I am Riley
    When I add the local folder of the kanban fixture
    Then Today opens without the Requires you card
    And Today shows "You are not in this project's team — How to join"

  # --- US-T-02 — the list ---

  @US-T-02 @v0.2 @nominal @fx-kanban
  Scenario: T-02.1 — List the items requiring the approver
    Given the kanban fixture is open and I am Morgan with the role view "approver"
    When I open Today
    Then Requires you lists exactly 2 rows: "task-001-login-form" and "bug-001-crash-on-save"
    And the row of "task-001-login-form" shows the type "task", its title, the reason "pending for 3 days" and the action "Approve"

  @US-T-02 @v0.2 @edge @fx-kanban
  Scenario: T-02.2 — Show one primary action per row
    Given the kanban fixture is open and I am Morgan with the role view "approver"
    When I open Today
    Then every Requires you row shows exactly 1 action button

  @US-T-02 @v0.2 @edge @fx-kanban
  Scenario: T-02.3 — Follow the role view
    Given the kanban fixture is open and I am Alex with the role view "approver"
    When I select the role view "product-owner"
    Then Requires you lists no row

  # --- US-T-03 — rejected work first ---

  @US-T-03 @v0.2 @nominal @fx-kanban
  Scenario: T-03.1 — List my rejected work first, with the reason
    Given the kanban fixture is open and I am Jordan
    When I open Today
    Then the first Requires you row is "task-002-password-reset" with the reason "Rejected by Morgan: Missing acceptance criteria" shown as a rejection
    And the second row is "task-004-session-timeout" with the action "Submit"

  @US-T-03 @v0.2 @edge @fx-kanban
  Scenario: T-03.2 — Drop the rejection once the work is submitted again
    Given the kanban fixture is open and I am Jordan
    When "task-002-password-reset" is submitted again with the CLI in a terminal
    Then within 5 seconds Requires you lists only "task-004-session-timeout"

  # --- US-T-04 — reviewer queue ---

  @US-T-04 @v0.2 @nominal @fx-custom
  Scenario: T-04.1 — List the items in a review state for a reviewer holding approver
    Given the custom fixture is open
    And the DNA gives Sam the roles reviewer, approver
    And I am Sam with the role view "reviewer"
    When I open Today
    Then Requires you lists "task-001-cli-adapter" with the reason "in-review for 3 days" and the action "Review"

  @US-T-04 @v0.2 @edge @fx-custom
  Scenario: T-04.2 — Drop an item that leaves the review state
    Given the custom fixture is open and Sam, holding reviewer and approver, sees "task-001-cli-adapter" in Requires you
    When "task-001-cli-adapter" is approved with the CLI in a terminal
    Then within 5 seconds Requires you no longer lists "task-001-cli-adapter"

  # --- US-T-05 — unknown state ---

  @US-T-05 @v0.2 @nominal @fx-unknown
  Scenario: T-05.1 — List an undeclared state as "Action required"
    Given the unknown fixture is open and I am Morgan with the role view "tech-lead"
    When I open Today
    Then Requires you lists "note-002-retro" with the reason "Action required — state on-hold is not declared for note"
    And its action is "Open"

  @US-T-05 @v0.2 @edge @fx-unknown
  Scenario: T-05.2 — Derive the actions of a declared but unfamiliar gate
    Given the unknown fixture is open and I am Morgan with the role view "approver"
    When I open Today
    Then Requires you lists "story-001-onboarding" with the reason "shaping for 3 days" and the action "Approve"

  # --- US-T-06 — informational gate without approver ---

  @US-T-06 @v0.2 @nominal @fx-custom
  Scenario: T-06.1 — Show a gate as informational to a reviewer without approver
    Given the custom fixture is open
    And the DNA gives Sam the roles reviewer
    And I am Sam
    When I open Today
    Then Requires you does not list "task-001-cli-adapter"
    And Waiting on others lists "task-001-cli-adapter" with "Reserved to approver — Morgan, Alex"

  @US-T-06 @v0.2 @edge @fx-custom
  Scenario: T-06.2 — Show the same gate as informational to a product owner without approver
    Given the custom fixture is open
    And the DNA gives Casey the roles product-owner
    And I am Casey
    When I open Today
    Then Waiting on others lists "dl-002-use-fastify" with "Reserved to approver — Morgan, Alex"

  # --- US-T-07 — empty state ---

  @US-T-07 @v0.2 @nominal @fx-kanban
  Scenario: T-07.1 — Say that nothing requires me
    Given the kanban fixture is open and I am Casey
    When I open Today
    Then the Requires you card shows "Nothing requires you"
    And the greeting reads "Casey, nothing requires you"

  @US-T-07 @v0.2 @edge @fx-kanban
  Scenario: T-07.2 — Reach the empty state after the last action
    Given the kanban fixture is open and I am Morgan
    And "bug-001-crash-on-save" has been approved
    When I approve "task-001-login-form" from Today
    Then the Requires you card shows "Nothing requires you"
