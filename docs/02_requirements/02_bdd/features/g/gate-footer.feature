Feature: Gate footer
  Every outcome of a gate side by side, with the reason field focused; the reason is required for
  approve too and pre-filled; gates on WingFoil 0.2.2 need the `approver` role (G2, S9, W-05,
  W-13).

  Background:
    Given the console is running

  # --- US-G-04 — two clicks from Today ---

  @US-G-04 @v0.2 @nominal @fx-kanban
  Scenario: G-04.1 — Approve a gate in two clicks from Today
    Given the kanban fixture is open and I am Morgan
    When I click "Approve" on the Requires you row of "task-001-login-form"
    And I click "Approve → approved" in the panel that opens
    Then the fixture's last commit is "wf(task): approve task-001-login-form [pending → approved]"
    And exactly 2 clicks were made since Today was shown

  @US-G-04 @v0.2 @nominal @fx-kanban
  Scenario: G-04.3 — Open the gate footer with the reason focused
    Given the kanban fixture is open and I am Morgan
    When I click "Approve" on the Requires you row of "task-001-login-form"
    Then the element panel of "task-001-login-form" opens with the gate footer
    And the reason field has the keyboard focus

  @US-G-04 @v0.2 @edge @fx-kanban
  Scenario: G-04.2 — Cancel without running the CLI
    Given the kanban fixture is open and I am Morgan
    And the gate footer of "task-001-login-form" is open from Today
    When I click "Cancel"
    Then the element panel closes
    And the fixture's last commit is unchanged

  # --- US-G-05 — all outcomes side by side ---

  @US-G-05 @v0.2 @nominal @fx-custom
  Scenario: G-05.1 — Show approve and the reject target of a bug gate
    Given the custom fixture is open and I am Morgan
    When I open the gate footer of "bug-001-toast-overlap"
    Then the footer shows the buttons "Approve → triaged" and "Reject → closed" side by side
    And "Approve → triaged" is the primary button

  @US-G-05 @v0.2 @edge @fx-custom
  Scenario: G-05.2 — Reject to the gate's target
    Given the custom fixture is open and I am Morgan
    And the gate footer of "bug-001-toast-overlap" is open with the reason "Cannot reproduce"
    When I click "Reject → closed"
    Then the fixture's last commit is "wf(bug): reject bug-001-toast-overlap [open → closed]"
    And the history of "bug-001-toast-overlap" lists the reason "Cannot reproduce"

  @US-G-05 @v0.2 @edge @fx-unknown
  Scenario: G-05.3 — Derive the outcomes of an unknown type's gate
    Given the unknown fixture is open and I am Morgan
    When I open the gate footer of "story-001-onboarding"
    Then the footer shows the buttons "Approve → ready-to-build" and "Reject → idea"

  # --- US-G-06 — reason required, pre-filled ---

  @US-G-06 @v0.2 @nominal @fx-kanban
  Scenario: G-06.1 — Pre-fill the reason for approve
    Given the kanban fixture is open and I am Morgan
    When I open the gate footer of "task-001-login-form"
    Then the reason field contains "Approved via WingFoil UI"
    And the text is selected so that typing replaces it

  @US-G-06 @v0.2 @edge @fx-kanban
  Scenario: G-06.2 — Use the reason I typed
    Given the kanban fixture is open and I am Morgan
    And the gate footer of "task-001-login-form" is open
    When I replace the reason with "Matches the mock-up" and click "Approve → approved"
    Then the history of "task-001-login-form" lists the reason "Matches the mock-up"

  @US-G-06 @v0.2 @edge @fx-kanban
  Scenario: G-06.3 — Clear an untouched default when a reject is chosen
    Given the kanban fixture is open and I am Morgan
    And the gate footer of "task-001-login-form" is open with the untouched default reason
    When I move the focus to "Reject → draft"
    Then the reason field is empty with the placeholder "Reason (required)"

  @US-G-06 @v0.2 @edge @fx-kanban
  Scenario: G-06.4 — Keep a reason I typed when a reject is chosen
    Given the kanban fixture is open and I am Morgan
    And the gate footer of "task-001-login-form" is open with the reason "Looks wrong"
    When I move the focus to "Reject → draft"
    Then the reason field contains "Looks wrong"

  # --- US-G-07 — empty reason ---

  @US-G-07 @v0.2 @nominal @fx-kanban
  Scenario: G-07.1 — Disable the outcomes while the reason is empty
    Given the kanban fixture is open and I am Morgan
    And the gate footer of "task-001-login-form" is open
    When I clear the reason field
    Then "Approve → approved" and "Reject → draft" are disabled
    And the footer shows "A reason is required"

  @US-G-07 @v0.2 @edge @fx-kanban
  Scenario: G-07.2 — Treat a reason of only spaces as empty
    Given the kanban fixture is open and I am Morgan
    And the gate footer of "task-001-login-form" is open
    When I replace the reason with 3 spaces
    Then "Approve → approved" and "Reject → draft" are disabled
    And the server has run no `wingfoil memory approve` or `memory reject` process

  # --- US-G-09 — informational footer without approver ---

  @US-G-09 @v0.2 @nominal @fx-custom
  Scenario: G-09.1 — Show an informational footer to a reviewer without approver
    Given the custom fixture is open
    And the DNA gives Sam the roles reviewer
    And I am Sam
    When I open the element panel of "task-001-cli-adapter"
    Then the footer shows "Reserved to approver — Morgan, Alex can act"
    And the footer shows no outcome button

  @US-G-09 @v0.2 @edge @fx-custom
  Scenario: G-09.2 — Show the outcomes to the same reviewer once they hold approver
    Given the custom fixture is open
    And the DNA gives Sam the roles reviewer, approver
    And I am Sam
    When I open the element panel of "task-001-cli-adapter"
    Then the footer shows the buttons "Approve → approved" and "Reject → in-progress"

  @US-G-09 @v0.2 @edge @fx-custom
  Scenario: G-09.3 — Show an informational footer to a product owner without approver
    Given the custom fixture is open
    And the DNA gives Casey the roles product-owner
    And I am Casey
    When I open the element panel of "dl-002-use-fastify"
    Then the footer shows "Reserved to approver — Morgan, Alex can act"
