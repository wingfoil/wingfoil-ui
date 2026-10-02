Feature: Files (read-only)
  Tree and viewer of the working tree, files differing from HEAD marked, highlighting and Markdown
  preview; no path outside the repository (R8, X4).

  Background:
    Given the console is running with the custom fixture open
    And I am Jordan

  # --- US-R-10 ---

  @US-R-10 @v0.3 @nominal @fx-custom
  Scenario: R-10.1 — View a YAML file with line numbers and highlighting
    When I open Files and select ".wingfoil/memory.yaml"
    Then the viewer shows the full path ".wingfoil/memory.yaml", its size and line numbers
    And the YAML keys are highlighted

  @US-R-10 @v0.3 @edge @fx-custom
  Scenario: R-10.2 — Mark a file that differs from HEAD
    Given "README.md" has an uncommitted edit
    When I open Files
    Then "README.md" is marked "modified" in the tree
    And the viewer shows the working-tree content of "README.md"

  @US-R-10 @v0.3 @edge @fx-custom
  Scenario: R-10.3 — Toggle a Markdown file between preview and source
    Given "docs/01_vision/02_product-vision.md" is open in Files with "Preview" selected
    When I select "Source"
    Then the viewer shows the raw Markdown with line numbers

  @US-R-10 @v0.3 @edge @fx-custom
  Scenario: R-10.4 — Show the editing actions as coming
    When I open a file in Files
    Then "New", "Edit" and "Delete" are disabled with "Coming after v1.0"

  # --- US-R-11 ---

  @US-R-11 @v0.3 @nominal @fx-custom
  Scenario: R-11.1 — Refuse a path that climbs out of the repository
    When I request the file "../../etc/hosts" from the Files API with the session token
    Then the response status is 404
    And the response contains no content of "/etc/hosts"

  @US-R-11 @v0.3 @edge @fx-custom
  Scenario: R-11.2 — Refuse a symlink that escapes the repository
    Given the fixture contains a symlink "notes/hosts" pointing to "/etc/hosts"
    When I select "notes/hosts" in Files
    Then the viewer shows "Not shown: the link points outside the repository"
