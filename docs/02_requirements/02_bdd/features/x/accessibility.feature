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
    When I press Tab until "Approve" of "task-1-login-form" has the focus, press Enter, then press Tab until "Approve → approved" has the focus and press Enter
    Then the fixture's last commit is "wf(task): approve task-1-login-form [pending → approved]"

  @US-X-06 @v0.1 @edge @fx-kanban
  Scenario: X-06.3 — Close the element panel with Escape
    Given the element panel of "task-1-login-form" is open and has the focus
    When I press Escape
    Then the panel closes and the focus returns to the row that opened it

  @US-X-06 @v0.1 @edge @fx-any
  Scenario: X-06.4 — Pass the axe scan
    When axe-core scans every screen of the release under test, in the light and the dark theme
    Then it reports 0 violations of impact "serious" or "critical"

  # --- US-X-07 — screen reader ---

  @US-X-07 @v0.2 @nominal @fx-kanban
  Scenario: X-07.1 — Announce a toast
    When I approve "task-1-login-form" from the UI
    Then the toast's text is in an ARIA live region with politeness "polite"

  @US-X-07 @v0.2 @edge @fx-kanban
  Scenario: X-07.2 — Announce a refusal assertively
    When an action of mine is refused by the CLI
    Then the red toast's text is in an ARIA live region with politeness "assertive"

  @US-X-07 @v0.2 @edge @fx-kanban
  Scenario: X-07.3 — Expose the reason of a blocked action
    Given "task-1-login-form" has local changes
    When the focus is on the disabled "Approve → approved" button
    Then the button's accessible description is "Blocked: this element has local changes — commit or discard them first"
