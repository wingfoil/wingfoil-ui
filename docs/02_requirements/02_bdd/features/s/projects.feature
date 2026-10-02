Feature: Project list
  Add a project from a local folder or a remote repository, switch between projects, keep the
  list across restarts, remove projects and survive missing folders (S2).

  Background:
    Given the console is running
    And I am Alex

  # --- US-S-03 — add a local folder ---

  @US-S-03 @v0.1 @nominal @fx-kanban
  Scenario: S-03.1 — Add a local WingFoil folder
    Given the project switcher lists no project
    When I add the local folder of the kanban fixture
    Then the project switcher lists the project with its name from `dna.project.name`
    And the project opens on the Memory list

  @US-S-03 @v0.1 @edge @fx-kanban
  Scenario: S-03.2 — Refuse a path that does not exist
    When I add the local folder "/tmp/does-not-exist"
    Then the modal shows "Folder not found: /tmp/does-not-exist"
    And the project switcher lists no project

  # --- US-S-04 — add from a remote ---

  @US-S-04 @v0.1 @nominal @fx-kanban
  Scenario: S-04.1 — Auto-fill the working directory of a remote
    Given the kanban fixture is reachable at the remote URL "file:///srv/remotes/kanban.git"
    When I choose "Remote git repository" and type that URL
    Then the working directory field is filled with "~/projects/kanban"

  @US-S-04 @v0.1 @nominal @fx-kanban
  Scenario: S-04.3 — Clone the remote on confirm
    Given I chose "Remote git repository" and typed "file:///srv/remotes/kanban.git"
    When I confirm the modal with the working directory "~/projects/kanban"
    Then "~/projects/kanban" is a clone of "file:///srv/remotes/kanban.git"
    And the project switcher lists the project

  @US-S-04 @v0.1 @edge @fx-kanban
  Scenario: S-04.2 — Use a working directory I typed instead of the auto-filled one
    Given I chose "Remote git repository" and typed "file:///srv/remotes/kanban.git"
    When I replace the working directory with "~/work/kanban-copy" and confirm
    Then "~/work/kanban-copy" is a clone of the remote
    And "~/projects/kanban" does not exist

  # --- US-S-05 — not a WingFoil project ---

  @US-S-05 @v0.1 @nominal @fx-any
  Scenario: S-05.1 — Refuse a folder without .wingfoil/
    Given a git repository "/tmp/plain-repo" without a `.wingfoil/` folder
    When I add the local folder "/tmp/plain-repo"
    Then the modal shows "Not a WingFoil project: no .wingfoil/ folder in /tmp/plain-repo"
    And the project switcher lists no project

  @US-S-05 @v0.1 @edge @fx-any
  Scenario: S-05.2 — Refuse a remote whose clone has no .wingfoil/
    Given a remote "file:///srv/remotes/plain.git" whose default branch has no `.wingfoil/` folder
    When I add that remote with the working directory "~/projects/plain"
    Then the modal shows "Not a WingFoil project: no .wingfoil/ folder in the cloned repository"
    And "~/projects/plain" does not exist
    And the project switcher lists no project

  # --- US-S-06 — same repository twice ---

  @US-S-06 @v0.1 @nominal @fx-kanban
  Scenario: S-06.1 — Refuse the same local folder twice
    Given the project switcher lists the kanban fixture
    When I add the local folder of the kanban fixture again
    Then the modal shows "Already in the list: kanban" with a link to that entry
    And the project switcher lists 1 project

  @US-S-06 @v0.1 @edge @fx-kanban
  Scenario: S-06.2 — Refuse a second working copy of a known remote
    Given the project switcher lists the kanban fixture, whose `origin` is "file:///srv/remotes/kanban.git"
    And "/tmp/kanban-second" is another clone of "file:///srv/remotes/kanban.git"
    When I add the local folder "/tmp/kanban-second"
    Then the modal shows "Already in the list: kanban (same remote)" with a link to that entry
    And the project switcher lists 1 project

  # --- US-S-07 — failed clone ---

  @US-S-07 @v0.1 @nominal @fx-any
  Scenario: S-07.1 — Report an unreachable remote
    When I add the remote "https://git.invalid/team/project.git" with the working directory "~/projects/project"
    Then the modal shows the error printed by git for the clone
    And "~/projects/project" does not exist
    And the project switcher lists no project

  @US-S-07 @v0.1 @edge @fx-any
  Scenario: S-07.2 — Refuse a working directory that is not empty
    Given the folder "~/projects/kanban" contains the file "notes.txt"
    When I add the remote "file:///srv/remotes/kanban.git" with the working directory "~/projects/kanban"
    Then the modal shows "The working directory is not empty: ~/projects/kanban"
    And "~/projects/kanban" contains only "notes.txt"

  @US-S-07 @v0.1 @edge @fx-any
  Scenario: S-07.3 — Report a refused authentication
    Given the remote "https://git.example.test/private.git" refuses the credentials available to git
    When I add that remote with the working directory "~/projects/private"
    Then the modal shows the authentication error printed by git
    And the project switcher lists no project

  # --- US-S-16 — switch project ---

  @US-S-16 @v0.1 @nominal @fx-any
  Scenario: S-16.1 — Switch to another project
    Given the project switcher lists the kanban fixture and the custom fixture
    And the kanban fixture is open on the Memory list
    When I select the custom fixture in the project switcher
    Then the Memory list shows the types of the custom fixture, including "decision-log" and "plan"
    And no element id of the kanban fixture is shown on the page

  @US-S-16 @v0.1 @edge @fx-any
  Scenario: S-16.2 — Close the element panel of the previous project on switch
    Given the kanban fixture is open with the element panel of "task-1-login-form"
    When I select the custom fixture in the project switcher
    Then no element panel is open

  # --- US-S-17 — list kept across restarts ---

  @US-S-17 @v0.1 @nominal @fx-any
  Scenario: S-17.1 — Keep the project list after a restart
    Given the project switcher lists the kanban fixture and the custom fixture
    When I stop the console and run "npx wingfoil-ui" again
    Then the project switcher lists the kanban fixture and the custom fixture, in the same order

  @US-S-17 @v0.1 @edge @fx-any
  Scenario: S-17.2 — Keep the list out of every project repository
    Given the project switcher lists the kanban fixture
    When I stop the console
    Then `git status --porcelain` of the kanban fixture prints nothing

  # --- US-S-18 — remove a project ---

  @US-S-18 @v0.1 @nominal @fx-kanban
  Scenario: S-18.1 — Remove a project from the list
    Given the project switcher lists the kanban fixture
    When I remove the kanban fixture from the project switcher and confirm
    Then the project switcher lists no project
    And the kanban fixture folder and its git history are unchanged

  @US-S-18 @v0.1 @edge @fx-kanban
  Scenario: S-18.2 — Cancel the removal
    Given the project switcher lists the kanban fixture
    When I remove the kanban fixture from the project switcher and cancel
    Then the project switcher lists the kanban fixture

  # --- US-S-19 — missing folder ---

  @US-S-19 @v0.1 @nominal @fx-kanban
  Scenario: S-19.1 — Show a moved project as unavailable
    Given the project switcher lists the kanban fixture and the custom fixture
    And the kanban fixture folder has been moved elsewhere
    When I open the project switcher
    Then the kanban entry is marked "Unavailable — folder not found" with the action "Remove"
    And the custom fixture opens on the Memory list

  @US-S-19 @v0.1 @edge @fx-kanban
  Scenario: S-19.2 — Recover when the folder comes back
    Given the kanban entry is marked "Unavailable — folder not found"
    When the kanban fixture folder is moved back to its path and I open the project switcher
    Then the kanban entry is no longer marked unavailable
