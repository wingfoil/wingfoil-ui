Feature: Documentation
  Index of `paths.docs` without the Memory and plan files, Markdown rendered in the UI, links that
  stay in the UI, safe links (R4, G1).

  Background:
    Given the console is running with the custom fixture open
    And I am Riley

  # --- US-R-08 ---

  @US-R-08 @v0.1 @nominal @fx-custom
  Scenario: R-08.1 — Index the documents without Memory and plan files
    When I open Documentation
    Then the index lists "docs/01_vision/02_product-vision.md"
    And the index lists no file under "docs/04_memory/" or "docs/05_plans/"

  @US-R-08 @v0.1 @edge @fx-custom
  Scenario: R-08.2 — Render a document inside the UI
    When I open "docs/01_vision/06_features.md" from the index
    Then its headings, lists and tables are rendered
    And the browser URL stays on the console's origin

  @US-R-08 @v0.1 @edge @fx-custom
  Scenario: R-08.3 — Follow a link between indexed documents inside the UI
    Given "docs/01_vision/00_index.md" is open
    When I select its link to "02_product-vision.md"
    Then "docs/01_vision/02_product-vision.md" is rendered in the UI

  # --- US-R-09 ---

  @US-R-09 @v0.1 @nominal @fx-custom
  Scenario: R-09.1 — Open a linked Memory file in the element panel
    Given a document links to "../04_memory/design/dls/dl-001-initialise-wingfoil-before-inception.md"
    When I select that link
    Then the element panel of "dl-001-initialise-wingfoil-before-inception" opens

  @US-R-09 @v0.1 @edge @fx-custom
  Scenario: R-09.2 — Mark a link that points nowhere
    Given a document links to "missing-file.md", which does not exist
    When I open that document
    Then the link is marked "broken link" and selecting it opens nothing

  @US-R-09 @v0.1 @edge @fx-custom
  Scenario: R-09.3 — Mark a link that leaves the repository
    Given a document links to "../../../etc/hosts"
    When I open that document
    Then the link is marked "outside the repository" and selecting it opens nothing

  @US-R-09 @v0.1 @edge @fx-custom
  Scenario: R-09.4 — Open an external link in a new tab
    Given a document links to "https://example.test/guide"
    When I select that link
    Then "https://example.test/guide" opens in a new browser tab
