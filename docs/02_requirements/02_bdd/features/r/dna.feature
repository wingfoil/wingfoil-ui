Feature: DNA view
  Modules, stacks, methodologies, team and roles, paths (R1).

  Background:
    Given the console is running

  # --- US-R-05 ---

  @US-R-05 @v0.1 @nominal @fx-custom
  Scenario: R-05.1 — Show the project's DNA
    Given the custom fixture is open and I am Riley
    When I open the DNA view
    Then it shows the modules "server", "web", "contracts" with their descriptions and paths
    And it shows the technologies, the methodologies with their phase, the team with each member's roles, and the paths

  @US-R-05 @v0.1 @edge @fx-kanban
  Scenario: R-05.2 — Show an empty DNA section as empty
    Given the kanban fixture is open
    And its DNA declares no module
    When I open the DNA view
    Then the Modules section shows "No module declared"
