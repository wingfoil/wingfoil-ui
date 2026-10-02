Feature: Start the console
  As Alex, I want to start the console with `npx wingfoil-ui` and have the browser open on it,
  so that I use it without installing anything beyond Node 22.

  @US-S-01 @v0.1 @nominal @fx-any
  Scenario: S-01.1 — Start the console with npx
    Given Node.js 22.12 is installed and no package "wingfoil-ui" is installed globally
    When I run "npx wingfoil-ui"
    Then the command prints a URL starting with "http://127.0.0.1:"
    And the default browser opens that URL
    And the page shows the project switcher with the action "Add project…"

  @US-S-01 @v0.1 @edge @fx-any
  Scenario: S-01.2 — Refuse to start on an unsupported Node.js version
    Given Node.js 20.11 is the active Node.js version
    When I run "npx wingfoil-ui"
    Then the command exits with a non-zero status
    And it prints "WingFoil UI needs Node.js 22.12 or later (found 20.11)"
    And no port is opened

  @US-S-01 @v0.1 @edge @fx-any
  Scenario: S-01.3 — Start without opening a browser when none is available
    Given no default browser is configured on the machine
    When I run "npx wingfoil-ui"
    Then the command prints the URL to open
    And the server keeps running
