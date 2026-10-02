Feature: Agents
  Launch the agent on the next step or an element, with confirmation when the settings ask for it;
  follow its output live in the UI (A1, A2, C4). Needs WingFoil 0.3 (`agent execute`).

  Background:
    Given the console is running
    And I am Jordan

  # --- US-A-01 — launch ---

  @US-A-01 @v0.4 @nominal @fx-custom
  Scenario: A-01.1 — Launch the agent on the next step after confirming
    Given the custom fixture is open on WingFoil 0.3 with the next step "dev-loop · red" on "task-003-element-panel"
    And the UI setting "Confirm agent launch" is on
    When I click "Launch agent" and confirm the modal showing the step's context and the branch "task/task-003-element-panel"
    Then the server starts `wingfoil agent execute` for "task-003-element-panel" with role "developer"
    And the button reads "View agent's logs"

  @US-A-01 @v0.4 @edge @fx-custom
  Scenario: A-01.2 — Launch without the modal when confirmation is off
    Given the custom fixture is open on WingFoil 0.3 with a next step for "developer"
    And the UI setting "Confirm agent launch" is off
    When I click "Launch agent"
    Then no modal is shown and the agent starts

  @US-A-01 @v0.4 @edge @fx-custom
  Scenario: A-01.3 — Cancel the launch from the modal
    Given the custom fixture is open on WingFoil 0.3 with a next step for "developer"
    And the UI setting "Confirm agent launch" is on
    When I click "Launch agent" and then "Cancel" in the modal
    Then no agent process is started

  # --- US-A-02 — assisted review ---

  @US-A-02 @v0.4 @nominal @fx-custom
  Scenario: A-02.1 — Launch an assisted review on an element
    Given the custom fixture is open on WingFoil 0.3
    And the DNA gives Sam the roles reviewer
    And I am Sam
    When I click "Start assisted review" in the panel of "task-001-cli-adapter" and confirm
    Then the server starts `wingfoil agent execute` for "task-001-cli-adapter" with role "reviewer"
    And the button reads "View agent's logs"

  @US-A-02 @v0.4 @edge @fx-custom
  Scenario: A-02.2 — Offer no assisted review outside a gate state
    Given the custom fixture is open on WingFoil 0.3
    And I am Sam
    When I open the element panel of "task-002-memory-list"
    Then no "Start assisted review" button is shown

  # --- US-A-03 — WingFoil without agent execution ---

  @US-A-03 @v0.4 @nominal @fx-custom
  Scenario: A-03.1 — Show Launch agent read-only on WingFoil 0.2.2
    Given the custom fixture is open on WingFoil 0.2.2
    When I open the element panel of "task-003-element-panel"
    Then "Launch agent" is disabled with "Needs WingFoil 0.3 (this project: 0.2.2) — run the agent outside the UI"

  @US-A-03 @v0.4 @edge @fx-kanban
  Scenario: A-03.2 — Show the same reason on the Kanban fixture
    Given the kanban fixture is open on WingFoil 0.2.2
    When I open Today
    Then the Next workflow step card shows no enabled "Launch agent" button

  # --- US-A-04 — live logs ---

  @US-A-04 @v0.4 @nominal @fx-custom
  Scenario: A-04.1 — Follow the run's output live
    Given an agent run started from the UI on "task-003-element-panel" prints 1 line per second
    When I click "View agent's logs"
    Then the log view shows each new line within 2 seconds of the agent printing it
    And it shows "Running" with the elapsed time

  @US-A-04 @v0.4 @edge @fx-custom
  Scenario: A-04.2 — Show the end of a successful run
    Given the log view of a run is open
    When the agent exits with status 0
    Then the log view shows "Finished · exit 0"
    And the button on the step reads "Launch agent"

  # --- US-A-05 — failed run ---

  @US-A-05 @v0.4 @nominal @fx-custom
  Scenario: A-05.1 — Show a failed run with its exit status
    Given the log view of a run is open
    When the agent exits with status 2
    Then the log view shows "Failed · exit 2" and keeps the output
    And the button on the step reads "Launch agent"

  @US-A-05 @v0.4 @edge @fx-custom
  Scenario: A-05.2 — Report an agent that cannot start
    Given `wingfoil agent execute` exits with an error before printing any output
    When I launch the agent on the next step
    Then a red toast shows the error message printed by `wingfoil agent execute`
    And the button reads "Launch agent"
