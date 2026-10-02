Feature: Accessibility
  WCAG 2.1 AA on every MVP screen: keyboard operation with visible focus, outcomes announced to
  screen readers, 0 serious or critical axe violations (X1, directive `accessibility`). The
  screens in scope are those of the release under test.

  Background:
    Given the console is running with the kanban fixture open
    And I am Morgan

  # --- US-X-06 — keyboard ---

  @US-X-06 @v0.1 @nominal @fx-kanban
  Scenario: X-06.1 — Reach every v0.1 screen with the keyboard
    Given the page has the keyboard focus and no mouse is used
    When I move through the page with Tab, Shift+Tab, the arrow keys and Enter
    Then I can open the Memory list, an element panel, DNA, Directives, Team and Documentation
    And every focused control shows a focus indicator with a contrast ratio of at least 3:1

  @US-X-06 @v0.2 @edge @fx-kanban
  Scenario: X-06.2 — Decide a gate with the keyboard only
    Given Today is shown and no mouse is used
    When I press Tab until "Approve" of "task-001-login-form" has the focus, press Enter, then press Tab until "Approve → approved" has the focus and press Enter
    Then the fixture's last commit is "wf(task): approve task-001-login-form [pending → approved]"

  @US-X-06 @v0.1 @edge @fx-kanban
  Scenario: X-06.3 — Close the element panel with Escape
    Given the element panel of "task-001-login-form" is open and has the focus
    When I press Escape
    Then the panel closes and the focus returns to the row that opened it

  @US-X-06 @v0.1 @edge @fx-any
  Scenario: X-06.4 — Pass the axe scan
    When axe-core scans every screen of the release under test, in the light and the dark theme
    Then it reports 0 violations of impact "serious" or "critical"

  # --- US-X-07 — screen reader ---

  @US-X-07 @v0.2 @nominal @fx-kanban
  Scenario: X-07.1 — Announce a toast
    When I approve "task-001-login-form" from the UI
    Then the toast's text is in an ARIA live region with politeness "polite"

  @US-X-07 @v0.2 @edge @fx-custom
  Scenario: X-07.2 — Announce a refusal assertively
    Given I switch to the custom fixture and I am Alex
    When I submit "adr-001-local-server", which the CLI refuses for its empty "sard_ref"
    Then the red toast's text is in an ARIA live region with politeness "assertive"

  @US-X-07 @v0.2 @edge @fx-kanban
  Scenario: X-07.3 — Expose the reason of a blocked action
    Given "task-001-login-form" has local changes
    When the focus is on the disabled "Approve → approved" button
    Then the button's accessible description is "Blocked: this element has local changes — commit or discard them first"

  # --- US-X-10 — page title ---
  # Format: "<project> · <state> · <view or element> — WingFoil UI" (WCAG 2.1 SC 2.4.2). <project> is
  # `dna.project.name`; <state> is the current phase when WingFoil reports it (0.3), otherwise the
  # project completion of the progress card (v0.3), and is omitted while neither exists (v0.1–v0.2).

  @US-X-10 @v0.1 @nominal @fx-kanban
  Scenario: X-10.1 — Name the project and the view in the tab title
    When I open the Memory list
    Then the browser tab title is "kanban · Memory — WingFoil UI"

  @US-X-10 @v0.1 @edge @fx-kanban
  Scenario: X-10.2 — Name the open element in the tab title
    When I open the element panel of "task-001-login-form"
    Then the browser tab title is "kanban · task-001-login-form — WingFoil UI"

  @US-X-10 @v0.1 @edge @fx-kanban
  Scenario: X-10.3 — Title the project list when no project is open
    When I go back to the project list
    Then the browser tab title is "Projects — WingFoil UI"

  @US-X-10 @v0.3 @edge @fx-kanban
  Scenario: X-10.4 — Show the project completion in the tab title
    Given the progress card shows a project completion of 40 %
    When I open Today
    Then the browser tab title is "kanban · 40 % · Today — WingFoil UI"

  @US-X-10 @v0.4 @edge @fx-custom
  Scenario: X-10.5 — Show the current phase in the tab title
    Given the custom fixture with the sw-life-cycle preset is open on WingFoil 0.3
    And the workflow engine reports `release-cycle` of "minor-v0.1" at phase "implementation"
    When I open Today
    Then the browser tab title is "custom · implementation · Today — WingFoil UI"
