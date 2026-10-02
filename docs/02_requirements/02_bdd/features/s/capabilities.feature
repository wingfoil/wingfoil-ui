Feature: WingFoil version and capabilities
  The UI runs the observed project's own `wingfoil`, detects its version against the supported
  range and states what the project cannot do (S3). In these scenarios the supported range of the
  UI release under test is 0.2.2 → 0.2.x unless a scenario says otherwise.

  Background:
    Given the console is running
    And I am Alex

  # --- US-S-08 — version and missing capabilities on add ---

  @US-S-08 @v0.1 @nominal @fx-kanban
  Scenario: S-08.1 — Show the version on add, nothing missing
    Given the kanban fixture pins `wingfoil` 0.2.2 in its `node_modules`
    When I add the local folder of the kanban fixture
    Then the project header shows "WingFoil 0.2.2"
    And the version notice shows "Every capability of this release is available"

  @US-S-08 @v0.4 @nominal @fx-kanban
  Scenario: S-08.3 — List the capabilities the project's version lacks
    Given the kanban fixture pins `wingfoil` 0.2.2 and the UI release supports 0.2.2 to 0.3.x
    When I add the local folder of the kanban fixture
    Then the version notice lists "Next workflow step — needs WingFoil 0.3"
    And the version notice lists "Agent launch — needs WingFoil 0.3"

  @US-S-08 @v0.1 @edge @fx-kanban
  Scenario: S-08.2 — Use the CLI on the PATH when the project pins none
    Given the kanban fixture has no `wingfoil` in its `node_modules`
    And `wingfoil` 0.2.2 is on the PATH
    When I add the local folder of the kanban fixture
    Then the project header shows "WingFoil 0.2.2 (from PATH)"

  # --- US-S-09 — version outside the supported range ---

  @US-S-09 @v0.1 @nominal @fx-kanban
  Scenario: S-09.1 — Open a project with a newer, untested CLI read-only
    Given the kanban fixture pins `wingfoil` 0.4.0
    When I open the kanban fixture
    Then the project header shows "WingFoil 0.4.0 — read-only: supported 0.2.2 to 0.2.x"
    And no action button is enabled on any screen

  @US-S-09 @v0.1 @edge @fx-kanban
  Scenario: S-09.2 — Open a project with an older CLI read-only
    Given the kanban fixture pins `wingfoil` 0.2.0
    When I open the kanban fixture
    Then the project header shows "WingFoil 0.2.0 — read-only: supported 0.2.2 to 0.2.x"

  # --- US-S-10 — no CLI found ---

  @US-S-10 @v0.1 @nominal @fx-kanban
  Scenario: S-10.1 — Do not open a project with no CLI
    Given the kanban fixture has no `wingfoil` in its `node_modules`
    And no `wingfoil` is on the PATH
    When I add the local folder of the kanban fixture
    Then the modal shows "WingFoil CLI not found for this project"
    And the modal shows the command "npm install --save-dev wingfoil"
    And the project switcher lists no project

  @US-S-10 @v0.1 @edge @fx-kanban
  Scenario: S-10.2 — Mark a listed project whose CLI disappeared
    Given the project switcher lists the kanban fixture
    And the `wingfoil` of the kanban fixture has been uninstalled and none is on the PATH
    When I select the kanban fixture
    Then the entry is marked "Unavailable — WingFoil CLI not found" with the install command

  # --- US-S-11 — read-only vs hidden (v0.2: the first release with actions) ---

  @US-S-11 @v0.2 @nominal @fx-custom
  Scenario: S-11.1 — Show a capability my role lacks as read-only with the reason
    Given the custom fixture is open and I am Jordan
    When I open the element panel of "dl-002-use-fastify"
    Then the gate footer is replaced by "Reserved to approver — Morgan, Alex can act"

  @US-S-11 @v0.2 @edge @fx-kanban
  Scenario: S-11.2 — Hide a capability that does not apply to the project
    Given the kanban fixture has no remote configured
    When I open Today
    Then no "Push", "Fetch" or "Update" control is shown on the page
