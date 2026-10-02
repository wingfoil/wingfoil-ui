Feature: Recent activity
  The last Memory events on Today, with a link to the Timeline (T5).

  Background:
    Given the console is running with the kanban fixture open
    And I am Casey

  # --- US-T-08 ---

  @US-T-08 @v0.3 @nominal @fx-kanban
  Scenario: T-08.1 — Show the last 5 Memory events
    When I open Today
    Then the "Recent activity" card lists 5 events, newest first
    And each state-change event shows the time, the element, the transition "from → to" and the author, and each creation event shows "created" instead of a transition
    And the card ends with the link "Open the Timeline"

  @US-T-08 @v0.3 @edge @fx-kanban
  Scenario: T-08.2 — Add an event made outside the UI
    When Morgan approves "task-001-login-form" with the CLI in a terminal
    Then within 5 seconds the first event of "Recent activity" is "task-001-login-form pending → approved · Morgan"

  @US-T-08 @v0.3 @edge @fx-kanban
  Scenario: T-08.3 — Leave out commits that are not Memory events
    Given the last commit of the fixture is "docs: fix a typo in README"
    When I open Today
    Then "Recent activity" does not list "docs: fix a typo in README"
