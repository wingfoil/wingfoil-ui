Feature: Progress card
  Scope, completion, iterated x/y, open bugs and pending gates in plain words, each figure
  clickable; phase X of Y with WingFoil 0.3 (T2, M1, R5). Completion and iterated figures cover the
  current element of the `progress.scope` type (`ui.yaml` declares the type only; the element is
  derived); open bugs and pending gates cover the whole project.

  Background:
    Given the console is running
    And I am Casey

  # --- US-T-12 — the card ---

  @US-T-12 @v0.3 @nominal @fx-custom
  Scenario: T-12.1 — Show the figures of the current scope
    Given the custom fixture with the sw-life-cycle preset is open
    When I open Today
    Then the progress card shows the scope "minor-v0.1" with its state "planning"
    And it shows "Project completion 25 %", "Tasks 1/4", "Open bugs 1" and "Pending gates 3"

  @US-T-12 @v0.3 @edge @fx-custom
  Scenario: T-12.4 — Move the scope to the most advanced release
    Given the custom fixture with the sw-life-cycle preset is open
    And "minor-v0.1" is `released` and "minor-v0.2" is `in-development`
    When I open Today
    Then the progress card shows the scope "minor-v0.2" with its state "in-development"

  @US-T-12 @v0.3 @edge @fx-custom
  Scenario: T-12.5 — Say that no release is under way
    Given the custom fixture with the sw-life-cycle preset is open
    And its only release "minor-v0.1" is `draft`
    When I open Today
    Then the progress card shows "No current release" and the figures of the whole project

  @US-T-12 @v0.3 @edge @fx-unknown
  Scenario: T-12.2 — Show whole-project figures without ui.yaml
    Given the unknown fixture is open
    When I open Today
    Then the progress card shows the scope "Whole project"
    And it shows "Pending gates 1"
    And it shows no completion figure, with "Completion needs references — see Configuration › Taxonomy"

  @US-T-12 @v0.3 @edge @fx-custom
  Scenario: T-12.3 — Update the figures after a decision
    Given the custom fixture with the sw-life-cycle preset is open and Today shows "Pending gates 3"
    When Morgan approves "bug-1-toast-overlap" with the CLI in a terminal
    Then within 5 seconds the progress card shows "Pending gates 2"

  # --- US-T-13 — figures open the Memory list ---

  @US-T-13 @v0.3 @nominal @fx-custom
  Scenario: T-13.1 — Open the items behind "Pending gates"
    Given the custom fixture with the sw-life-cycle preset is open
    When I select "Pending gates 3" on the progress card
    Then the Memory list shows exactly "task-1-cli-adapter", "dl-002-use-fastify" and "bug-1-toast-overlap"
    And the active filter reads "Pending gates"

  @US-T-13 @v0.3 @edge @fx-custom
  Scenario: T-13.2 — Open the items behind "Tasks 1/4"
    Given the custom fixture with the sw-life-cycle preset is open
    When I select "Tasks 1/4" on the progress card
    Then the Memory list shows the 4 tasks of release "v0.1", "task-2-memory-list" marked done

  # --- US-T-14 — completion definition ---

  @US-T-14 @v0.3 @nominal @fx-custom
  Scenario: T-14.1 — Explain the completion figure on hover
    Given the custom fixture with the sw-life-cycle preset is open
    When I hover "Project completion 25 %"
    Then a tooltip reads "Mean of reference completion over 2 references with at least 1 linked element: US-M-01 50 %, US-S-01 0 %"

  @US-T-14 @v0.3 @edge @fx-custom
  Scenario: T-14.2 — Reach the explanation with the keyboard
    Given the custom fixture with the sw-life-cycle preset is open
    When I move the keyboard focus to "Project completion 25 %"
    Then the same explanation is shown and is the figure's accessible description

  # --- US-T-15 — phase figure before WingFoil 0.3 ---

  @US-T-15 @v0.3 @nominal @fx-custom
  Scenario: T-15.1 — Show the phase figure read-only on WingFoil 0.2.2
    Given the custom fixture with the sw-life-cycle preset is open on WingFoil 0.2.2
    When I open Today
    Then the progress card shows "Phase — needs WingFoil 0.3 (this project: 0.2.2)" in place of the phase figure
    And it shows "Project completion 25 %"

  @US-T-15 @v0.3 @edge @fx-custom
  Scenario: T-15.2 — Show phase completion read-only too
    Given the custom fixture with the sw-life-cycle preset is open on WingFoil 0.2.2
    When I open Today
    Then the progress card shows "Phase completion — needs WingFoil 0.3"

  # --- US-T-16 — phase X of Y (WingFoil 0.3) ---

  @US-T-16 @v0.4 @nominal @fx-custom
  Scenario: T-16.1 — Show the current phase of the scope
    Given the custom fixture with the sw-life-cycle preset is open on WingFoil 0.3
    And the workflow engine reports `release-cycle` of "minor-v0.1" at phase "dev-loop"
    When I open Today
    Then the progress card shows "Phase 2 of 7 — dev-loop"
    And the phase strip shows 1 phase done, 1 current and 5 to do

  @US-T-16 @v0.4 @edge @fx-custom
  Scenario: T-16.2 — Show a scope whose workflow has not started
    Given the custom fixture with the sw-life-cycle preset is open on WingFoil 0.3
    And the workflow engine reports no run of `release-cycle` for "minor-v0.1"
    When I open Today
    Then the progress card shows "Not started — 0 of 7 phases"
