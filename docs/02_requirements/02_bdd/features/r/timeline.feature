Feature: Timeline
  Time axis of Memory creations and state changes per day, parsed from `wf(…)` commits; git tree
  with lanes, filters and Memory commits marked (R6, R7).

  Background:
    Given the console is running with the kanban fixture open
    And I am Casey
    And after the commits of `wingfoil init`, the fixture's history is exactly: 2026-09-28 "wf(task): add task-1-login-form", 2026-09-28 "wf(task): submit task-1-login-form [draft → pending]", 2026-09-29 "docs: fix a typo in README", 2026-09-30 "wf(task): approve task-1-login-form [pending → approved]"

  # --- US-R-02 — time axis ---

  @US-R-02 @v0.3 @nominal @fx-kanban
  Scenario: R-02.1 — Show creations above and state changes below the axis
    When I open Timeline
    Then the Time axis tab is selected
    And the column 2026-09-28 shows 1 creation above the axis and 1 state change below
    And the column 2026-09-30 shows 1 state change below the axis

  @US-R-02 @v0.3 @edge @fx-kanban
  Scenario: R-02.2 — List the events of a day
    Given Timeline is open on the Time axis
    When I select the column 2026-09-28
    Then it lists "task-1-login-form · created" and "task-1-login-form · draft → pending", each with the time and the author

  # --- US-R-03 — non-governed commits ---

  @US-R-03 @v0.3 @nominal @fx-kanban
  Scenario: R-03.1 — Leave non-wf commits out of the time axis
    When I open Timeline
    Then the column 2026-09-29 shows no event

  @US-R-03 @v0.3 @edge @fx-kanban
  Scenario: R-03.2 — Keep non-wf commits in the git tree
    When I open the Git tree tab of Timeline
    Then it lists "docs: fix a typo in README" with a filled dot

  # --- US-R-04 — git tree ---

  @US-R-04 @v0.3 @nominal @fx-kanban
  Scenario: R-04.1 — Mark Memory commits and open a commit
    Given the Git tree tab of Timeline is open
    When I select "wf(task): approve task-1-login-form [pending → approved]"
    Then the commit shows its full message, its changed files and the link "task-1-login-form"
    And the commit's dot is hollow, marking a Memory commit

  @US-R-04 @v0.3 @edge @fx-kanban
  Scenario: R-04.2 — Filter Memory changes only
    Given the Git tree tab of Timeline is open
    When I turn on the filter "Memory changes only"
    Then the list shows the 3 `wf(task)` commits and not "docs: fix a typo in README"

  @US-R-04 @v0.3 @edge @fx-kanban
  Scenario: R-04.3 — Show a second branch in its own lane
    Given the fixture has a branch "feature/x" with 1 commit not on "main"
    When I open the Git tree tab of Timeline
    Then "feature/x" is drawn in a second lane with its label on the tip
