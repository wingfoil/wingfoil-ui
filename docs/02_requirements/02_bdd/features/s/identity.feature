Feature: Identity and role views
  The user is recognised from `git config user.email` matched against `dna.team.members`; members
  with several roles switch role view; unknown, missing or ambiguous identities are read-only (S4).

  Background:
    Given the console is running with the kanban fixture added

  # --- US-S-12 — recognised from git ---

  @US-S-12 @v0.1 @nominal @fx-kanban
  Scenario: S-12.1 — Recognise a single-role member
    Given the fixture's `git config user.email` is "jordan@example.test"
    When I open the kanban fixture
    Then the shell shows the current user "Jordan" with the role "developer"
    And no role view selector is shown

  @US-S-12 @v0.1 @edge @fx-kanban
  Scenario: S-12.2 — Match the email regardless of letter case
    Given the fixture's `git config user.email` is "Jordan@Example.TEST"
    When I open the kanban fixture
    Then the shell shows the current user "Jordan"

  @US-S-12 @v0.1 @edge @fx-kanban
  Scenario: S-12.3 — Follow a change of git email
    Given I am Jordan and the kanban fixture is open
    When the fixture's `git config user.email` is changed to "morgan@example.test"
    Then within 5 seconds the shell shows the current user "Morgan"

  # --- US-S-13 — not in team ---

  @US-S-13 @v0.1 @nominal @fx-kanban
  Scenario: S-13.1 — Mark a user who is not in the team
    Given I am Riley
    When I open the kanban fixture
    Then the shell shows "riley@example.test" with the badge "not in team"
    And the Memory list, the DNA, Directives, Team and Documentation views open

  @US-S-13 @v0.1 @edge @fx-kanban
  Scenario: S-13.3 — Mark a member removed from the team
    Given I am Jordan and the kanban fixture is open
    When Jordan's entry is removed from `dna.team.members` with the CLI in a terminal
    Then within 5 seconds the shell shows "jordan@example.test" with the badge "not in team"

  @US-S-13 @v0.2 @edge @fx-kanban
  Scenario: S-13.2 — Offer no governed action to a user who is not in the team
    Given I am Riley
    When I open the element panel of "task-1-login-form"
    Then the panel shows no action footer
    And the panel shows "Read-only: riley@example.test is not in the team — How to join"

  # --- US-S-14 — no git email ---

  @US-S-14 @v0.1 @nominal @fx-kanban
  Scenario: S-14.1 — Open read-only when git has no email
    Given neither the fixture's nor the global git configuration sets `user.email`
    When I open the kanban fixture
    Then the shell shows "No identity"
    And the notice shows the command "git config user.email <your email>"

  @US-S-14 @v0.1 @edge @fx-kanban
  Scenario: S-14.2 — Use the global git email when the repository sets none
    Given the fixture's git configuration sets no `user.email`
    And the global git configuration sets `user.email` to "casey@example.test"
    When I open the kanban fixture
    Then the shell shows the current user "Casey"

  # --- US-S-15 — ambiguous identity ---

  @US-S-15 @v0.1 @nominal @fx-kanban
  Scenario: S-15.1 — Open read-only when the email matches two members
    Given the DNA lists "shared@example.test" for the members "Jordan" and "Sam"
    And the fixture's `git config user.email` is "shared@example.test"
    When I open the kanban fixture
    Then the shell shows "Ambiguous identity"
    And the warning reads "shared@example.test matches 2 members: Jordan, Sam"

  @US-S-15 @v0.1 @edge @fx-kanban
  Scenario: S-15.3 — Recognise the member once the DNA is fixed
    Given the shell shows "Ambiguous identity" for "shared@example.test"
    When Sam's email in the DNA is changed to "sam@example.test" with the CLI in a terminal
    Then within 5 seconds the shell shows the current user "Jordan"

  @US-S-15 @v0.2 @edge @fx-kanban
  Scenario: S-15.2 — Offer no governed action under an ambiguous identity
    Given the fixture's `git config user.email` matches the members "Jordan" and "Sam"
    When I open the element panel of "task-1-login-form"
    Then the panel shows no action footer

  # --- US-S-22 — switch role view ---

  @US-S-22 @v0.1 @nominal @fx-kanban
  Scenario: S-22.1 — Switch role view
    Given I am Alex with the role view "approver"
    When I select the role view "developer"
    Then the shell shows the role view "developer"
    And the Directives view filtered on "only mine" shows the directives bound to "developer"

  @US-S-22 @v0.1 @edge @fx-kanban
  Scenario: S-22.2 — Offer only the roles the member holds
    Given I am Morgan
    When I open the role view selector
    Then it lists exactly "tech-lead" and "approver"

  @US-S-22 @v0.1 @edge @fx-kanban
  Scenario: S-22.3 — Keep the role view per project
    Given I am Alex with the role view "developer" on the kanban fixture
    And the custom fixture is open with the role view "approver"
    When I switch back to the kanban fixture
    Then the shell shows the role view "developer"
