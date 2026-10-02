Feature: Local server security
  Loopback only; a per-session token given at launch; Origin and Host checks on every request,
  writes included; opaque project ids (X4). These scenarios drive the server's HTTP interface
  directly, as e2e-smoke's `local-security` phase does.

  Background:
    Given the console has been started with "npx wingfoil-ui" and printed its URL with the session token
    And the kanban fixture is added

  # --- US-X-02 — session token ---

  @US-X-02 @v0.1 @nominal @fx-kanban
  Scenario: X-02.1 — Serve the browser session opened with the token
    When I open the printed URL in the browser
    Then the project switcher lists the kanban fixture
    And the address bar no longer shows the token

  @US-X-02 @v0.1 @edge @fx-kanban
  Scenario: X-02.2 — Issue a new token at every start
    Given the token printed at the previous start
    When I stop the console, start it again and send an API request with the previous token
    Then the response status is 401

  # --- US-X-03 — loopback only ---

  @US-X-03 @v0.1 @nominal @fx-kanban
  Scenario: X-03.1 — Listen on the loopback interface only
    When I list the server's listening sockets
    Then every listening address is 127.0.0.1 or ::1

  @US-X-03 @v0.1 @edge @fx-kanban
  Scenario: X-03.2 — Refuse a connection on the machine's network address
    Given the machine has the network address 192.0.2.10
    When I send a request with the session token to "http://192.0.2.10:<port>/"
    Then the connection is refused

  # --- US-X-04 — token, Origin, Host ---

  @US-X-04 @v0.1 @nominal @fx-kanban
  Scenario Outline: X-04.1 — Refuse requests without a valid session
    When I send a <method> request to the project API <condition>
    Then the response status is <status>
    And the server runs no `wingfoil` or `git` process for it

    Examples:
      | method | condition                                         | status |
      | GET    | without the session token                         | 401    |
      | POST   | without the session token                         | 401    |
      | GET    | with the token and the Origin "https://evil.test" | 403    |
      | POST   | with the token and the Origin "https://evil.test" | 403    |

  @US-X-04 @v0.1 @edge @fx-kanban
  Scenario: X-04.2 — Refuse a DNS-rebinding request
    When I send a GET request with the session token and the Host header "evil.test:<port>"
    Then the response status is 403

  @US-X-04 @v0.1 @edge @fx-kanban
  Scenario: X-04.3 — Accept a request with the token from the console's own origin
    When I send a GET request with the session token, the Origin "http://127.0.0.1:<port>" and the Host "127.0.0.1:<port>"
    Then the response status is 200

  # --- US-X-05 — opaque ids ---

  @US-X-05 @v0.1 @nominal @fx-kanban
  Scenario: X-05.1 — Use opaque project ids in URLs
    Given the kanban fixture lives at "/home/test/projects/kanban"
    When I open the kanban fixture and its Memory list
    Then no URL requested by the page contains "/home/test" or "projects/kanban"

  @US-X-05 @v0.1 @edge @fx-kanban
  Scenario: X-05.2 — Refuse a project id that is not in the list
    When I send a GET request with the session token for the project id "../../etc"
    Then the response status is 404
