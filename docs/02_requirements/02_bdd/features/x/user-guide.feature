Feature: User guide
  A user guide with screenshots of every MVP screen (v1.0 scope, `user-docs` workflow).

  # --- US-X-01 ---

  @US-X-01 @v1.0 @nominal @fx-any
  Scenario: X-01.1 — Cover every MVP screen
    When I open the user guide of release 1.0.0
    Then it has one section per screen: Today, element panel, Workflow, Memory, DNA, Directives, Traceability, Documentation, Team, Configuration, Timeline, Files, project switcher, command palette
    And each section has at least 1 screenshot

  @US-X-01 @v1.0 @edge @fx-any
  Scenario: X-01.2 — Regenerate the screenshots for the release
    When the screenshots of the user guide are generated for release 1.0.0
    Then every screenshot is produced by the e2e suite from the fixtures at the release commit
    And no screenshot file is older than that commit

  @US-X-01 @v1.0 @edge @fx-any
  Scenario: X-01.3 — Pass the accessibility checks of the guide
    When axe-core scans every page of the user guide
    Then it reports 0 violations of impact "serious" or "critical"
    And every screenshot has a text alternative
