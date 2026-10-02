Feature: Update (fast-forward)
  *Update* runs `git pull --ff-only`, automatically when the setting says so; when it cannot
  fast-forward the UI stays blocked and says what to run in the terminal (Y4, C4).

  Background:
    Given the console is running with the kanban fixture open
    And I am Morgan

  # --- US-Y-05 ---

  @US-Y-05 @v0.2 @nominal @fx-kanban
  Scenario: Y-05.1 — Update a copy that is behind
    Given the fixture is 2 commits behind its fetched remote and has no commit of its own
    When I click "Update" in the sidebar
    Then the fixture's HEAD is the remote's commit
    And the sidebar shows "In sync with git"

  @US-Y-05 @v0.2 @edge @fx-kanban
  Scenario: Y-05.2 — Update automatically after a fetch
    Given the UI settings "Auto-fetch" and "Auto-update" are on
    When a commit is pushed to the remote by someone else
    Then within 65 seconds the fixture's HEAD is the remote's commit

  @US-Y-05 @v0.2 @edge @fx-kanban
  Scenario: Y-05.3 — Update with local changes that do not touch the incoming files
    Given the fixture is 1 commit behind, and that commit changes only "docs/memory/task/task-003-logout.md"
    And "README.md" has an uncommitted edit
    When I click "Update" in the sidebar
    Then the fixture's HEAD is the remote's commit
    And "README.md" keeps its uncommitted edit

  # --- US-Y-06 ---

  @US-Y-06 @v0.2 @nominal @fx-kanban
  Scenario: Y-06.1 — Refuse to merge diverged histories
    Given the fixture has 1 commit of its own and is 1 commit behind its fetched remote
    When I click "Update" in the sidebar
    Then the fixture's HEAD is unchanged
    And the sidebar shows "Cannot fast-forward: your copy and the remote have diverged — run git pull --rebase or git merge in a terminal"
    And governed actions stay blocked

  @US-Y-06 @v0.2 @edge @fx-kanban
  Scenario: Y-06.2 — Refuse an update that local changes are in the way of
    Given the fixture is 1 commit behind, and that commit changes "docs/memory/task/task-001-login-form.md"
    And "docs/memory/task/task-001-login-form.md" has an uncommitted edit
    When I click "Update" in the sidebar
    Then the fixture's HEAD is unchanged and the uncommitted edit is kept
    And the sidebar shows "Cannot fast-forward: local changes to task-001-login-form.md are in the way — commit or stash them in a terminal"
