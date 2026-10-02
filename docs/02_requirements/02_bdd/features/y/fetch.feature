Feature: Fetch
  The remote is fetched automatically (on by default) and on demand; a failed fetch never blocks
  reading (Y2, C4).

  Background:
    Given the console is running with the kanban fixture open
    And I am Morgan

  # --- US-Y-02 ---

  @US-Y-02 @v0.2 @nominal @fx-kanban
  Scenario: Y-02.1 — Fetch automatically
    Given the UI setting "Auto-fetch" is on, with its default interval of 60 seconds
    When a commit is pushed to the remote by someone else
    Then within 65 seconds the sidebar shows "1 behind"

  @US-Y-02 @v0.2 @edge @fx-kanban
  Scenario: Y-02.2 — Fetch on demand
    Given the UI setting "Auto-fetch" is off
    And a commit has been pushed to the remote by someone else
    When I click "Fetch" in the sidebar
    Then the sidebar shows "1 behind"

  @US-Y-02 @v0.2 @edge @fx-kanban
  Scenario: Y-02.3 — Do not fetch when auto-fetch is off
    Given the UI setting "Auto-fetch" is off
    When 120 seconds pass
    Then the server has run no `git fetch` process

  # --- US-Y-03 ---

  @US-Y-03 @v0.2 @nominal @fx-kanban
  Scenario: Y-03.1 — Report a failed fetch with the last successful time
    Given the last successful fetch was at 10:02
    And the remote is unreachable
    When I click "Fetch" in the sidebar
    Then the sidebar shows "Fetch failed — last fetched at 10:02" with git's error on hover
    And the Memory list still opens and lists the fixture's elements

  @US-Y-03 @v0.2 @edge @fx-kanban
  Scenario: Y-03.2 — Report a fetch refused for authentication
    Given the remote refuses the credentials available to git
    When I click "Fetch" in the sidebar
    Then the sidebar shows "Fetch failed" with the authentication error printed by git
