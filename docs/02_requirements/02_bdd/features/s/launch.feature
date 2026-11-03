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

  @US-S-01 @v0.3 @edge @fx-any
  Scenario: S-01.4 — Write the console's address file for agents
    Given the state directory has no file under "consoles/"
    When I run "npx wingfoil-ui --no-open --port 4870"
    Then when the URL line is printed the file "consoles/4870.json" of the state directory exists with mode 0600, in a folder "consoles/" with mode 0700
    And it holds the URL "http://127.0.0.1:4870/", "portFixed": true and the console's process id
    And it holds no part of the session token printed in the URL line

  @US-S-01 @v0.3 @edge @fx-any
  Scenario: S-01.5 — Remove the address file on stop
    Given the console was started with "npx wingfoil-ui --no-open --port 4870" and wrote "consoles/4870.json"
    When I press Ctrl-C in its terminal
    Then when "WingFoil UI stopped" is printed the file "consoles/4870.json" no longer exists

  @US-S-01 @v0.3 @edge @fx-any
  Scenario: S-01.6 — Remove a stale address file at start
    Given the state directory holds "consoles/4871.json" naming this machine and a process id that is not running
    When I run "npx wingfoil-ui --no-open --port 4870"
    Then when the URL line is printed "consoles/4871.json" no longer exists and "consoles/4870.json" does
