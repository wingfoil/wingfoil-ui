Feature: How to join
  For users not in the team: the tech lead to contact and the exact command to add them (C2, Q5).

  Background:
    Given the console is running
    And I am Riley

  # --- US-C-08 ---

  @US-C-08 @v0.2 @nominal @fx-kanban
  Scenario: C-08.1 — Name the tech leads and give the command
    Given the kanban fixture is open
    When I open How to join from the "not in team" badge
    Then the panel names the tech leads "Morgan <morgan@example.test>" and "Alex <alex@example.test>"
    And it shows the command `wingfoil dna add team.members --value "<Your Name>" --entry-email riley@example.test --entry-roles <roles>`

  @US-C-08 @v0.2 @edge @fx-kanban
  Scenario: C-08.2 — Copy the command
    Given the How to join panel is open
    When I click "Copy command"
    Then the clipboard contains the command shown, with "riley@example.test"

  # --- US-C-09 ---

  @US-C-09 @v0.2 @nominal @fx-kanban
  Scenario: C-09.1 — Say that no tech lead is declared
    Given the kanban fixture is open
    And no member of its DNA holds the role "tech-lead"
    When I open How to join
    Then the panel shows "This project declares no tech lead — ask any member to run the command"
    And it shows the command with "riley@example.test"

  @US-C-09 @v0.2 @edge @fx-kanban
  Scenario: C-09.2 — Explain an empty team
    Given the kanban fixture is open
    And its DNA declares no team member
    When I open How to join
    Then the panel shows "This project declares no team member — anyone with write access to the repository can run the command"
