Feature: Submit from the single-action footer
  A member moves their element to its next state with `memory submit` (G3).

  Background:
    Given the console is running with the kanban fixture open
    And I am Jordan

  # --- US-G-10 ---

  @US-G-10 @v0.2 @nominal @fx-kanban
  Scenario: G-10.1 — Submit a draft
    Given the element panel of "task-4-session-timeout" is open
    When I click "Submit"
    Then the fixture's last commit is "wf(task): submit task-4-session-timeout [draft → pending]"
    And the state machine shows "pending" as current

  @US-G-10 @v0.2 @edge @fx-kanban
  Scenario: G-10.2 — Submit rejected work again
    Given the element panel of "task-2-password-reset" shows the rejection banner
    When I click "Submit"
    Then the fixture's last commit is "wf(task): submit task-2-password-reset [draft → pending]"
    And the panel no longer shows the rejection banner

  @US-G-10 @v0.2 @edge @fx-kanban
  Scenario: G-10.3 — Offer no submit on an element waiting on a gate
    When I open the element panel of "task-1-login-form"
    Then the panel shows no "Submit" button
