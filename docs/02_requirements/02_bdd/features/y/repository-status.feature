Feature: Repository status
  Branch, ahead/behind and local changes in the sidebar; sync controls hidden without a remote
  (Y1, S3).

  Background:
    Given the console is running with the kanban fixture open
    And I am Morgan

  # --- US-Y-01 ---

  @US-Y-01 @v0.2 @nominal @fx-kanban
  Scenario: Y-01.1 — Show branch, ahead/behind and local changes
    Given the fixture is on branch "main", 1 commit ahead and 2 commits behind its fetched remote
    And 3 files have uncommitted changes
    When I look at the sidebar
    Then the git status shows "main", "1 ahead", "2 behind" and "3 local changes"

  @US-Y-01 @v0.2 @edge @fx-kanban
  Scenario: Y-01.2 — Show an up-to-date copy
    Given the fixture is at the same commit as its fetched remote and has no uncommitted change
    When I look at the sidebar
    Then the git status shows "main" and "In sync with git"

  @US-Y-01 @v0.2 @edge @fx-kanban
  Scenario: Y-01.3 — Show a detached HEAD
    Given the fixture's HEAD is detached at a commit of "main"
    When I look at the sidebar
    Then the git status shows "Detached HEAD" with the short hash
    And governed actions are blocked with "Blocked: no branch checked out"

  # --- US-Y-04 ---

  @US-Y-04 @v0.2 @nominal @fx-kanban
  Scenario: Y-04.1 — Hide sync controls without a remote
    Given the fixture has no remote configured
    When I look at the sidebar
    Then the git status shows the branch and the local changes
    And no "Fetch", "Update" or "Push" control is shown

  @US-Y-04 @v0.2 @edge @fx-kanban
  Scenario: Y-04.2 — Show the controls once a remote is added
    Given the fixture has no remote configured
    When a remote "origin" is added with git in a terminal
    Then within 5 seconds the sidebar shows the "Fetch" control
