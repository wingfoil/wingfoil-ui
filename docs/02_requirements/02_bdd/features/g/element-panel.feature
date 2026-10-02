Feature: Element panel
  Everything about an element in one place: state machine, rejection banner, summary, references,
  directives, history with commits (G1, R2). Read-only in v0.1.

  Background:
    Given the console is running

  # --- US-G-01 ---

  @US-G-01 @v0.1 @nominal @fx-kanban
  Scenario: G-01.1 — Show an element with its state machine and history
    Given the kanban fixture is open and I am Morgan
    When I open the element panel of "task-001-login-form"
    Then the panel shows the type "task", the id "task-001-login-form" and its title
    And the state machine shows "draft" as past, "pending" as current and "approved" as future
    And the history lists "submitted by Jordan" with its commit hash and date

  @US-G-01 @v0.1 @edge @fx-kanban
  Scenario: G-01.2 — Show the rejection banner after a reject
    Given the kanban fixture is open and I am Jordan
    When I open the element panel of "task-002-password-reset"
    Then the panel shows the banner "Rejected by Morgan: Missing acceptance criteria"

  @US-G-01 @v0.1 @edge @fx-custom
  Scenario: G-01.3 — Flag a missing required field
    Given the custom fixture is open
    And "adr-001-local-server" is a committed `draft` with an empty required field "sard_ref"
    When I open the element panel of "adr-001-local-server"
    Then the panel shows "sard_ref — required field, missing" next to the summary

  @US-G-01 @v0.1 @edge @fx-kanban
  Scenario: G-01.4 — Open an element panel from its URL
    Given the kanban fixture is open
    When I copy the URL of the element panel of "task-001-login-form" and open it in a new tab
    Then the new tab shows the element panel of "task-001-login-form"

  # --- US-G-02 ---

  @US-G-02 @v0.1 @nominal @fx-custom
  Scenario: G-02.1 — Show the directives that apply to the element's roles
    Given the custom fixture is open and I am Sam
    When I open the element panel of "task-001-cli-adapter"
    Then the Directives section lists the directives bound to "reviewer" in `.wingfoil/roles.yaml`, including "accessibility" and "ux-consistency"
    And it lists the global directives "claim-evidence" and "wingfoil-cli"

  @US-G-02 @v0.1 @edge @fx-kanban
  Scenario: G-02.2 — Open a directive from the panel
    Given the kanban fixture is open
    And the element panel of "task-001-login-form" lists a directive
    When I select that directive
    Then the Directives view opens on that directive with its body rendered
