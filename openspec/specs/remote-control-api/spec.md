# remote-control-api Specification

## Purpose

Who may call the HTTP Remote Control API (`/api/*`) and what it returns: loopback by default, network access only by operator choice, no requests on behalf of other web pages, no filesystem paths in responses.

## Requirements
### Requirement: API answers loopback clients by default
The Remote Control API (`/api/*`) SHALL answer only clients connecting from the same machine unless the operator has enabled "Allow remote control from network" in the current session. The setting SHALL default to off and SHALL NOT persist across app restarts.

#### Scenario: Call from another device with the toggle off
- **WHEN** a device on the LAN requests `/api/trigger/index/0` and the network toggle is off
- **THEN** the server SHALL refuse with 403 and no cue SHALL start

#### Scenario: Call from the same machine
- **WHEN** `curl http://localhost:8080/api/trigger/index/0` is run on the operator's machine
- **THEN** the first cue SHALL start

#### Scenario: Toggle on
- **WHEN** the operator enables "Allow remote control from network" and a LAN device calls a trigger URL
- **THEN** the cue SHALL start

### Requirement: Cross-site browser requests refused
The API SHALL refuse any request that a browser sends on behalf of another web page, identified by an `Origin` header or a `Sec-Fetch-Site` header other than `none` or `same-origin`, regardless of the network toggle.

#### Scenario: Web page fires a trigger URL
- **WHEN** a page open in the operator's browser loads an image whose URL is a trigger route
- **THEN** the server SHALL refuse with 403 and no cue SHALL start

### Requirement: API input validated and output minimal
Index paths SHALL be comma-separated non-negative base-10 integers; anything else SHALL be refused with 400. The project info route SHALL return the project name and item count and SHALL NOT return filesystem paths.

#### Scenario: Negative index
- **WHEN** a client requests `/api/trigger/index/-1`
- **THEN** the server SHALL respond 400

#### Scenario: Project info
- **WHEN** a client requests `/api/project/info`
- **THEN** the response SHALL contain no absolute or relative filesystem path

### Requirement: Host header checked
Every HTTP route of the app's server SHALL refuse requests whose `Host` header is not an IP address literal, `localhost`, or the machine's own host name (with or without `.local`).

#### Scenario: DNS-rebinding request
- **WHEN** a request arrives with `Host: attacker.example:8080`
- **THEN** the server SHALL refuse it without running the route

