Feature: Workflow tree and ingestion cards
  The main workflow tree from the project's definitions, with its position from WingFoil 0.3; one
  card per ingestion workflow (W1, W2).

  Background:
    Given the console is running

  # --- US-M-05 — main workflow tree ---

  @US-M-05 @v0.3 @nominal @fx-custom
  Scenario: M-05.1 — Draw the main workflow from its definitions
    Given the custom fixture is open
    When I open Workflow
    Then the tree's top level lists "init", "inception", "specification", "seed-first-release-line", "release-line-cycle", "sunset" in this order
    And "release-line-cycle" is marked "iterates release-line"

  @US-M-05 @v0.3 @edge @fx-custom
  Scenario: M-05.2 — Expand an iterated phase with its elements
    Given the custom fixture is open and its Memory holds the release-line "rl-v1" in the state "planning"
    When I expand "release-line-cycle" in the Workflow tree
    Then it lists "rl-v1" with the state "planning"

  @US-M-05 @v0.3 @edge @fx-unknown
  Scenario: M-05.3 — Say that a project declares no main workflow
    Given the unknown fixture is open and its `workflows.yaml` includes no workflow
    When I open Workflow
    Then the page shows "This project declares no workflow"

  # --- US-M-06 — position (WingFoil 0.3) ---

  @US-M-06 @v0.4 @nominal @fx-custom
  Scenario: M-06.1 — Mark the current position and who must act
    Given the custom fixture is open on WingFoil 0.3
    And the workflow engine reports `sw-life-cycle` at "release-line-cycle" › "rl-v1" › "delivery" › "minor-v0.1" › "implementation" with role "developer"
    When I open Workflow
    Then "init", "inception" and "specification" are marked done
    And "implementation" under "minor-v0.1" is marked current with "developer must act"

  @US-M-06 @v0.4 @edge @fx-custom
  Scenario: M-06.2 — Show no position on WingFoil 0.2.2
    Given the custom fixture is open on WingFoil 0.2.2
    When I open Workflow
    Then the tree shows no done/current marker and the note "Position needs WingFoil 0.3 (this project: 0.2.2)"

  # --- US-M-07 — ingestion cards ---

  @US-M-07 @v0.3 @nominal @fx-custom
  Scenario: M-07.1 — Show one card per ingestion workflow
    Given the custom fixture is open
    When I open Workflow
    Then the Ingestion section shows exactly the cards "bug-ingest", "decision-log-ingest", "adr-ingest" and "service-ingest"
    And the card "decision-log-ingest" shows the steps "capture · product-owner → approve · approver" and the button "Start"

  @US-M-07 @v0.3 @edge @fx-custom
  Scenario: M-07.2 — Count the open runs of an ingestion
    Given the custom fixture is open
    When I open Workflow
    Then the card "decision-log-ingest" shows "1 open" for "dl-002-use-fastify"

  @US-M-07 @v0.3 @edge @fx-custom
  Scenario: M-07.3 — Open the ingestion modal from a card
    Given the custom fixture is open on Workflow
    When I click "Start" on the card "decision-log-ingest"
    Then the ingestion modal opens on "decision-log-ingest"
