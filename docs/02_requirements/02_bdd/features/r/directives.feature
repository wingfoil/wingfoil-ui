Feature: Directives view
  Directives with their bound roles, "only mine / all", body rendered (R2).

  Background:
    Given the console is running with the custom fixture open

  # --- US-R-06 ---

  @US-R-06 @v0.1 @nominal @fx-custom
  Scenario: R-06.1 — Filter the directives bound to my role
    Given I am Jordan
    When I open the Directives view with the filter "only mine"
    Then it lists exactly the directives bound to "developer" in `.wingfoil/roles.yaml` and the global ones
    And each directive shows the roles it is bound to

  @US-R-06 @v0.1 @edge @fx-custom
  Scenario: R-06.2 — Show every directive with "all"
    Given I am Jordan
    When I open the Directives view with the filter "all"
    Then it lists every directive file under `.wingfoil/directives/`

  @US-R-06 @v0.1 @edge @fx-custom
  Scenario: R-06.3 — Render a directive body
    When I open the directive "wingfoil-cli"
    Then its body is rendered as Markdown, with the table of known behaviours shown as a table

  @US-R-06 @v0.1 @edge @fx-custom
  Scenario: R-06.4 — Show "only mine" empty for a user who is not in the team
    Given I am Riley
    When I open the Directives view
    Then the filter "only mine" is disabled with "You hold no role in this project"
    And the filter "all" is selected
