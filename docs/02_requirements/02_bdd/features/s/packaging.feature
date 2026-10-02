Feature: Stable 1.0 and support matrix
  A stable `wingfoil-ui` 1.0 with a published support matrix of WingFoil versions (S3, S1; v1.0
  scope: packaging stable, contract tests from the floor to WingFoil 1.0).

  # --- US-S-02 ---

  @US-S-02 @v1.0 @nominal @fx-any
  Scenario: S-02.1 — Install and run the stable release
    Given Node.js 22.12 is installed
    When I run "npx wingfoil-ui@1 --version"
    Then it prints "1.0.0"

  @US-S-02 @v1.0 @nominal @fx-any
  Scenario: S-02.2 — Publish the support matrix
    When I open the README of the npm package "wingfoil-ui" 1.0.0
    Then its section "Supported WingFoil versions" lists the range "0.2.2 to 1.x" and, per WingFoil version, the capabilities available

  @US-S-02 @v1.0 @edge @fx-any
  Scenario: S-02.3 — Pass the MVP journeys on WingFoil 1.0
    Given the three fixtures are built with WingFoil 1.0
    When the e2e suite of every MVP story runs
    Then every scenario tagged up to @v1.0 passes

  @US-S-02 @v1.0 @edge @fx-kanban
  Scenario: S-02.4 — Print the supported range on a version mismatch
    Given the kanban fixture pins `wingfoil` 2.0.0
    When I open the kanban fixture
    Then the project header shows "WingFoil 2.0.0 — read-only: supported 0.2.2 to 1.x"
