Feature: Ingestion start
  Start an ingestion from Memory, Workflow or ⌘K, only for types whose required fields the CLI can
  all set; the UI never edits a draft file (G5, S6, `cli-only-writes`). On WingFoil 0.2.2 the
  steps run as `memory add` + `memory submit`.

  Background:
    Given the console is running
    And I am Jordan

  # --- US-G-15 — decision-log ingestion ---

  @US-G-15 @v0.3 @nominal @fx-custom
  Scenario: G-15.1 — Capture a decision-log from Memory
    Given the custom fixture is open on the Memory list
    When I click "+ Ingestion", choose "decision-log-ingest", type the title "Adopt Playwright" and click "Submit"
    Then the fixture's last 2 commits are "wf(decision-log): add dl-003-adopt-playwright" and "wf(decision-log): submit dl-003-adopt-playwright [draft → in-discussion]"
    And the element panel of "dl-003-adopt-playwright" opens in the state "in-discussion"

  @US-G-15 @v0.3 @edge @fx-custom
  Scenario: G-15.2 — Start the same ingestion from the command palette
    Given the custom fixture is open
    When I press Ctrl+K, type "decision" and press Enter on "Start decision-log-ingest"
    Then the ingestion modal opens on "decision-log-ingest" with the title field focused

  @US-G-15 @v0.3 @edge @fx-custom
  Scenario: G-15.3 — Refuse an empty title before running the CLI
    Given the ingestion modal of "decision-log-ingest" is open
    When I click "Submit" with an empty title
    Then the modal shows "A title is required"
    And the server has run no `wingfoil memory add` process

  @US-G-15 @v0.3 @edge @fx-custom
  Scenario: G-15.4 — Block the ingestion while the copy is behind
    Given the custom fixture is 1 commit behind its fetched remote
    When I open the ingestion modal of "decision-log-ingest"
    Then "Submit" is disabled with "Blocked: your copy is 1 commit behind the remote — Update"

  # --- US-G-16 — types the CLI cannot fill ---

  @US-G-16 @v0.3 @nominal @fx-custom
  Scenario: G-16.1 — Show the bug ingestion read-only on WingFoil 0.2.2
    Given the custom fixture is open on WingFoil 0.2.2
    When I click "+ Ingestion" on the Memory list
    Then "bug-ingest" is shown disabled with "Needs a WingFoil that sets the required field severity"
    And "adr-ingest" is shown disabled with "Needs a WingFoil that sets the required field sard_ref"
    And "decision-log-ingest" is enabled

  @US-G-16 @v0.3 @edge @fx-kanban
  Scenario: G-16.2 — Offer every ingestion whose type requires only CLI-set fields
    Given the kanban fixture is open on WingFoil 0.2.2
    When I click "+ Ingestion" on the Memory list
    Then "bug-ingest", "decision-log-ingest" and "adr-ingest" are enabled

  # --- US-G-17 — a refused step ---

  @US-G-17 @v0.3 @nominal @fx-custom
  Scenario: G-17.1 — Report a refused add with nothing created
    Given the ingestion modal of "decision-log-ingest" is open
    And `wingfoil memory add` refuses the title with an error
    When I type the title "Adopt Playwright" and click "Submit"
    Then a red toast shows the error message printed by `wingfoil memory add`
    And the fixture's last commit is unchanged

  @US-G-17 @v0.3 @edge @fx-custom
  Scenario: G-17.2 — Name the draft left by a refused submit
    Given the ingestion modal of "decision-log-ingest" is open
    And `wingfoil memory add` succeeds and `wingfoil memory submit` refuses with an error
    When I type the title "Adopt Playwright" and click "Submit"
    Then a red toast shows the error of `wingfoil memory submit` and "Draft dl-003-adopt-playwright was created — open it"
    And the fixture's last commit is "wf(decision-log): add dl-003-adopt-playwright"

  # --- US-G-18 — bug ingestion with WingFoil setting its fields ---

  @US-G-18 @v0.4 @nominal @fx-custom
  Scenario: G-18.1 — Report a bug with its severity set by the CLI
    Given the custom fixture is open on a WingFoil that sets the required fields of a bug
    And I start "bug-ingest"
    When I type the title "Toast hides the Push button", choose the severity "medium" and click "Submit"
    Then the fixture's commits for "bug-2-toast-hides-the-push-button" are made by the CLI only
    And the bug's frontmatter has `severity: medium` and the state "open"

  @US-G-18 @v0.4 @edge @fx-custom
  Scenario: G-18.2 — Keep the bug ingestion read-only on WingFoil 0.3 when it sets no fields
    Given the custom fixture is open on a WingFoil 0.3 whose `workflow start` does not set a bug's severity
    When I click "+ Ingestion" on the Memory list
    Then "bug-ingest" is shown disabled with "Needs a WingFoil that sets the required field severity"
