Feature: Themes and externalised strings
  Light and dark themes with AA contrast, following the system by default (X3); every UI string
  externalised, English only in the MVP (X2).

  Background:
    Given the console is running with the kanban fixture open

  # --- US-X-08 — themes ---

  @US-X-08 @v0.1 @nominal @fx-kanban
  Scenario: X-08.1 — Follow the system's dark preference
    Given the browser reports `prefers-color-scheme: dark`
    When I open the Memory list
    Then the page uses the dark theme
    And every text has a contrast ratio of at least 4.5:1 against its background (3:1 for text of 18.66 px bold or 24 px and larger)

  @US-X-08 @v0.1 @edge @fx-kanban
  Scenario: X-08.2 — Follow a change of the system preference
    Given the page uses the light theme
    When the browser's `prefers-color-scheme` changes to "dark"
    Then the page uses the dark theme without a reload

  @US-X-08 @v0.2 @edge @fx-kanban
  Scenario: X-08.3 — Override the system with the theme setting
    Given the browser reports `prefers-color-scheme: dark`
    When I set the UI setting "Theme" to "Light"
    Then the page uses the light theme

  # --- US-X-09 — externalised strings ---

  @US-X-09 @v0.1 @nominal @fx-kanban
  Scenario: X-09.1 — Render every string from the message catalogue
    Given the build replaces every message of the English catalogue with its key
    When I open every screen of the release under test
    Then no visible text other than project data is outside the catalogue's keys

  @US-X-09 @v0.1 @edge @fx-kanban
  Scenario: X-09.2 — Keep project data untranslated
    Given the build replaces every message of the English catalogue with its key
    When I open the element panel of "task-001-login-form"
    Then the element's title, id and state names are shown as written in the project
