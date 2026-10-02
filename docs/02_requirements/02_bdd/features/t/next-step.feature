Feature: Next workflow step
  The next step for the role, with the context the agent will receive (T3). Needs WingFoil 0.3
  (`workflow next`).

  Background:
    Given the console is running
    And I am Jordan

  # --- US-T-09 — next step in Requires you ---

  @US-T-09 @v0.4 @nominal @fx-custom
  Scenario: T-09.1 — Show the next step for my role
    Given the custom fixture is open on WingFoil 0.3
    And the workflow engine reports the next step "dev-loop · red" for role "developer" on "task-003-element-panel"
    When I open Today
    Then the Next workflow step card shows "dev-loop · red — task-003-element-panel"

  @US-T-09 @v0.4 @edge @fx-custom
  Scenario: T-09.2 — List rejected work before the next step
    Given the custom fixture is open on WingFoil 0.3 with a next step for "developer"
    And "task-005-sidebar" is a `draft` of Jordan's rejected with the reason "Breaks the layout"
    When I open Today
    Then Requires you lists "task-005-sidebar" above the Next workflow step card

  @US-T-09 @v0.4 @edge @fx-custom
  Scenario: T-09.3 — Say that no step waits for my role
    Given the custom fixture is open on WingFoil 0.3
    And the workflow engine reports no next step for role "developer"
    When I open Today
    Then the Next workflow step card shows "No workflow step waits for developer"

  # --- US-T-10 — before WingFoil 0.3 ---

  @US-T-10 @v0.4 @nominal @fx-custom
  Scenario: T-10.1 — Show the next-step card read-only on WingFoil 0.2.2
    Given the custom fixture is open on WingFoil 0.2.2
    When I open Today
    Then the Next workflow step card shows "Needs WingFoil 0.3 (this project: 0.2.2)"
    And the card shows no "Launch agent" button

  @US-T-10 @v0.4 @edge @fx-kanban
  Scenario: T-10.2 — Show the same reason on a Kanban project
    Given the kanban fixture is open on WingFoil 0.2.2
    When I open Today
    Then the Next workflow step card shows "Needs WingFoil 0.3 (this project: 0.2.2)"

  # --- US-T-17 — the step's context ---

  @US-T-17 @v0.4 @nominal @fx-custom
  Scenario: T-17.1 — Show the context the agent will receive
    Given the custom fixture is open on WingFoil 0.3 with the next step "dev-loop · red" on "task-003-element-panel"
    When I expand the Next workflow step card
    Then it shows the role "developer", the directives bound to "developer", the DNA module of the task, the specs it references and the branch "task/task-003-element-panel"

  @US-T-17 @v0.4 @edge @fx-custom
  Scenario: T-17.2 — Name the context items that are missing
    Given the custom fixture is open on WingFoil 0.3 with the next step on "task-004-themes"
    And "task-004-themes" declares no `module`
    When I expand the Next workflow step card
    Then the DNA module line reads "No module declared on task-004-themes"
