Feature: Read and decide a decision-log
  A product owner reads a decision-log as a document and, holding `approver`, decides it from its
  panel (G1, G2, R4; J2 steps 3–4).

  Background:
    Given the console is running with the custom fixture open

  # --- US-G-03 — read as a document ---

  @US-G-03 @v0.3 @nominal @fx-custom
  Scenario: G-03.1 — Read a decision-log as a rendered document
    Given I am Casey
    And the body of "dl-002-use-fastify" has the sections "Context", "Options" and "Decision"
    When I open the element panel of "dl-002-use-fastify"
    Then the panel renders the body as Markdown with the headings "Context", "Options" and "Decision"
    And the history lists "submitted by Casey" with its commit

  @US-G-03 @v0.3 @edge @fx-custom
  Scenario: G-03.2 — Open the decision-log from Documentation links
    Given I am Casey
    And "docs/01_vision/00_index.md" links to the file of "dl-002-use-fastify"
    When I select that link
    Then the element panel of "dl-002-use-fastify" opens with its rendered body

  @US-G-03 @v0.3 @edge @fx-custom
  Scenario: G-03.3 — Read a decision-log with an empty body
    Given I am Casey
    And "dl-003-empty" is a `draft` decision-log whose body is empty
    When I open the element panel of "dl-003-empty"
    Then the body area reads "No content yet"

  # --- US-G-08 — decide it holding approver ---

  @US-G-08 @v0.3 @nominal @fx-custom
  Scenario: G-08.1 — Approve a decision-log as a product owner holding approver
    Given the DNA gives Casey the roles product-owner, approver
    And I am Casey
    When I approve "dl-002-use-fastify" from its panel with the reason "Agreed in the planning meeting"
    Then the fixture's last commit is "wf(decision-log): approve dl-002-use-fastify [in-discussion → ready]"

  @US-G-08 @v0.3 @edge @fx-custom
  Scenario: G-08.2 — Send a decision-log back to draft
    Given the DNA gives Casey the roles product-owner, approver
    And I am Casey
    When I reject "dl-002-use-fastify" from its panel with the reason "Needs a cost estimate"
    Then the fixture's last commit is "wf(decision-log): reject dl-002-use-fastify [in-discussion → draft]"
    And Requires you of Casey lists "dl-002-use-fastify" with "Rejected by Casey: Needs a cost estimate"

  @US-G-08 @v0.3 @edge @fx-custom
  Scenario: G-08.3 — Keep the decision informational for a product owner without approver
    Given the DNA gives Casey the roles product-owner
    And I am Casey
    When I open the element panel of "dl-002-use-fastify"
    Then the footer shows "Reserved to approver — Morgan, Alex can act"
