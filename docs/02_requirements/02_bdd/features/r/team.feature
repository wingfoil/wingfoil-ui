Feature: Team view
  Member cards with roles and pending gates; agents never approve (R3).

  Background:
    Given the console is running with the kanban fixture open

  # --- US-R-07 ---

  @US-R-07 @v0.1 @nominal @fx-kanban
  Scenario: R-07.1 — Show members with their roles and pending gates
    Given I am Morgan
    When I open the Team view
    Then it shows 5 member cards
    And Morgan's card shows the roles "approver", "tech-lead", the badge "you" and "2 pending gates"
    And Jordan's card shows the role "developer" and no pending gate

  @US-R-07 @v0.1 @edge @fx-kanban
  Scenario: R-07.2 — Mark agents as never approving
    When I open the Team view
    Then it lists "Build agent" as "executes as developer · never approves"

  @US-R-07 @v0.1 @edge @fx-kanban
  Scenario: R-07.3 — Filter members with pending gates
    When I open the Team view with the filter "with pending gates"
    Then it shows exactly the cards of Morgan and Alex
