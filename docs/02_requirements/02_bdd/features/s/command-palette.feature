Feature: Command palette
  Switch project, open any element, navigate and start an ingestion from one shortcut (S6). The
  shortcut is Ctrl+K, and ⌘K on macOS.

  Background:
    Given the console is running with the kanban fixture and the custom fixture added
    And the kanban fixture is open
    And I am Alex

  # --- US-S-20 ---

  @US-S-20 @v0.3 @nominal @fx-kanban
  Scenario: S-20.1 — Open an element by its id
    When I press Ctrl+K, type "task-003" and press Enter
    Then the element panel of "task-003-logout" opens

  @US-S-20 @v0.3 @edge @fx-kanban
  Scenario: S-20.2 — Switch project from the palette
    When I press Ctrl+K, type "custom", select "Switch to custom" with the arrow keys and press Enter
    Then the custom fixture is open on the same screen

  @US-S-20 @v0.3 @edge @fx-kanban
  Scenario: S-20.3 — Navigate to a screen
    When I press Ctrl+K, type "timeline" and press Enter
    Then Timeline opens

  @US-S-20 @v0.3 @edge @fx-kanban
  Scenario: S-20.4 — Say when nothing matches
    When I press Ctrl+K and type "zzz-no-such-thing"
    Then the palette shows "No match"

  @US-S-20 @v0.3 @edge @fx-kanban
  Scenario: S-20.5 — Close the palette with Escape
    Given the palette is open
    When I press Escape
    Then the palette closes and the focus returns to where it was
