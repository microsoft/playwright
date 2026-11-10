# Playwright Extension: Design

The extension lets Playwright clients (the MCP server and the CLI) control tabs in the browser profile of the user. More than one client can be connected at the same time.

The design has one central rule: **each tab has zero owners or one owner, and one object, `TabRegistry`, is the only place that changes an owner.** Tab groups, the command checks and the events to the clients all follow from that table.

## Model

- **Client.** A Playwright process that connects through its relay (`CDPRelayServer`). In the extension, a connected client is a `ClientSession`.
- **Owned tab.** A tab that one session owns. Only the owner gets its events and can send it commands.
- **Free tab.** A tab with no owner. The user can give it to a client.
- **Reserved tab.** A connect page that waits for the user. It has no owner, and no client can claim it.
- **Client group.** The Chrome tab group of a session that has grouping. Its tabs are exactly the tabs that the session owns.
- **Free group.** Any tab group with no session, including the groups of the user. A client group becomes free, and gray, when its session closes.

Three rules are always true:

1. A tab has zero owners or one owner.
2. If a session has grouping, a tab is in its group if and only if the session owns it.
3. A session can send commands only to tabs that it owns, and no CDP command from the list of refused methods.

Clients are not isolated from each other for reading. A client can read browser-level data, for example the cookies of the full profile. A client cannot change browser-level state.

## Tab states

```mermaid
stateDiagram-v2
  direction LR
  Free --> Owned: claim
  Owned --> Attached: attach
  Attached --> Owned: detach
  Owned --> Free: release
  Attached --> Free: release
```

| Transition | Causes | Message to the client |
| --- | --- | --- |
| claim | Pick on the connect page. Drag into the group of the client. `chrome.tabs.create` from the client. Popup from an owned tab. Transfer from another client. | `chrome.tabs.onCreated`. For a tab with a URL that cannot be debugged (`chrome:`, `edge:`, `devtools:`), the message waits until the tab navigates. For `chrome.tabs.create`, the response is the announcement. |
| attach | The client sends `chrome.debugger.attach` for a tab that it owns | The response to the command |
| detach | Chrome detached the debugger: the user closed the debug bar, or a frame loaded that extensions cannot debug | `chrome.debugger.onDetach` with the reason from Chrome |
| release | Drag out of the group. Transfer to another client. The session closed. | `chrome.debugger.onDetach` with the reason `target_closed` |
| tab closed | The user or the client closed the tab | `chrome.tabs.onRemoved` |

Two details:

- **Second announcement.** Chrome reports `target_closed` for a tab that stays open, for example when a frame goes to an unknown scheme. The client forgets the tab on each detach. Thus, 150 ms after such a detach, `OwnedTab` announces the tab again, at most one time in 3 seconds for each tab.
- **Closed tab in a group.** When a grouped tab closes, Chrome first reports that the tab left its group. The client then gets a release, not `chrome.tabs.onRemoved`. The client drops the tab in both cases.

## Classes

Each Chrome API has one class that calls it: `chrome.debugger` belongs to `OwnedTab`, `chrome.tabGroups` belongs to `TabGroupManager`, and the WebSocket belongs to `Channel`.

| Class | File | How many | Responsibility |
| --- | --- | --- | --- |
| `Extension` | `background.ts` | 1 | Start point of the service worker. Makes the other objects. Answers the runtime messages of the two pages, after the start cleanup. |
| `ConnectionBroker` | `connectionBroker.ts` | 1 | The handshake. Records the relay URL of each connect page and reserves its tab. After approval, opens the `Channel`, makes the `ClientSession` and gives the selection to `TabPicker`. Holds the sessions. Keeps the service worker alive and the Chrome listeners on while it has work. |
| `TabPicker` | `tabPicker.ts` | 1 | What a new client can take: free groups and free tabs. Applies a selection: one group, or some tabs, or the blank tab. |
| `TabRegistry` | `tabRegistry.ts` | 1 | The owner table: tab id to `OwnedTab`. The only place that changes an owner (`claim`, `release`, `transfer`, `releaseAll`). Holds the reserved tabs (`reserve`, `unreserve`). Sends the Chrome events of a tab to its `OwnedTab`. Gives a popup to the owner of its opener. |
| `OwnedTab` | `ownedTab.ts` | 1 per owned tab | The debugger of one tab: attach, detach, CDP commands, the ✓ badge, the announcement to the client. |
| `ClientSession` | `clientSession.ts` | 1 per client | The protocol for one client. Checks each command, then calls `OwnedTab` or `chrome.tabs`. Sends events only for its own tabs. |
| `checkCdpMethod` | `cdpPolicy.ts` | | The list of CDP methods that a client cannot use |
| `Channel` | `channel.ts` | 1 per client | The WebSocket: JSON, message ids, responses, errors. Closes on a message that is not JSON. |
| `TabGroupManager` | `tabGroupManager.ts` | 1 | Keeps group membership and ownership the same. Makes a group gray when its session closes. Finds free groups. |
| `ClientTabGroup` | `tabGroupManager.ts` | 1 per client with grouping | One Chrome group: its id, title and color. Makes the Chrome group when the first tab comes. |
| `ChromeListeners` | `chromeListeners.ts` | 1 | The listeners of all Chrome tab, tab group and debugger events. Adds and removes them together. |

The extension has two pages. The connect page (`ui/connect.tsx`) is for one client that asks to connect: it checks the request and shows the pick list. The manage page (`ui/manage.tsx`) is the landing page of the extension, and the extension icon in the toolbar opens it. It shows the connected clients and their tabs, and it lets the user disconnect a client or rotate the token.

### How `TabGroupManager` keeps groups and owners the same

It reacts to two events, and each one has one direction:

1. **A tab changed its group in Chrome**, because the user dragged it. The manager finds the owner that the tab must have now, and calls the registry if the owner is different.
   - The tab is in the group of session B: the owner must be B. This is a `transfer`.
   - The tab left the group of its owner: no owner. This is a `release`.
   - The owner has no grouping, and the tab is not in a client group: no change.
   - The tab is reserved: the manager moves it out of the group again.
2. **The registry claimed a tab for a session** (pick, new tab, popup, transfer). If the session has grouping and the tab is not in its group, the manager moves the tab in.

Each action causes the other event one time, and that event finds the same owner for the tab and for its group, so it does nothing.

All group changes go through one queue (`changeGroups`), which runs them one at a time. Thus two first tabs of a client do not make two groups, and the handler of event 1 waits for the queue before it compares the owners. Chrome refuses a group change while the user drags a tab, so the queue tries each change again for 1.5 seconds.

Chrome does not put the tab of a popup window into a group. Such a tab stays owned and outside the group.

## Protocol

The relay and the extension use protocol version 2 on the WebSocket. The extension opens the WebSocket to the relay. A version 2 client assumes that it is the only client: it has no message for ownership, so the extension tells it about ownership with the Chrome events that it knows.

### Commands

| Command | Check in `ClientSession` |
| --- | --- |
| `chrome.debugger.attach` | The target must have `tabId` and no `targetId` or `extensionId`. The session must own the tab. |
| `chrome.debugger.detach` | Same |
| `chrome.debugger.sendCommand` | Same, and the CDP method must not be in the list of refused methods |
| `chrome.tabs.create` | Only `url` and `active` are used. The new tab belongs to the session. |
| `chrome.tabs.remove` | The session must own each tab id |

A refused command gets an error response, for example `Tab 999 is not owned by this client`. A tab that does not exist gets the same text, so a client cannot find the tab ids of other clients.

### Events

| Event | Meaning |
| --- | --- |
| `chrome.tabs.onCreated` | The session owns a new tab, or an owned tab can be attached again |
| `chrome.debugger.onDetach` | The session lost the tab, or Chrome detached the debugger |
| `chrome.tabs.onRemoved` | An owned tab closed |
| `chrome.debugger.onEvent` | A CDP event from an owned tab |
| `extension.initialized` | The first tabs were announced. Sent one time. |

### Refused CDP methods

`checkCdpMethod` refuses the methods below, because they change the state of the browser and not of one tab. All other methods pass, including read methods such as `Storage.getCookies`.

| Refused | Effect in Playwright |
| --- | --- |
| `Storage.setCookies`, `Storage.clearCookies`, `Network.clearBrowserCookies`, `Network.clearBrowserCache` | `context.addCookies()` and `context.clearCookies()` fail |
| `Browser.grantPermissions`, `Browser.resetPermissions`, `Browser.setPermission` | `context.grantPermissions()` and `context.clearPermissions()` fail |
| `Browser.setDownloadBehavior` | None. The relay answers this command itself. |
| `Target.createTarget`, `Target.closeTarget`, `Target.attachToTarget`, `Target.activateTarget` | None. The relay changes the first two into `chrome.tabs.*` commands, which have the owner check. |

### Connect page URL

The relay starts the browser with `connect.html` and these parameters:

| Parameter | Value |
| --- | --- |
| `mcpRelayUrl` | The WebSocket URL of the relay. The host must be loopback. |
| `protocolVersion` | The protocol version of the client |
| `client` | JSON with the name of the client |
| `token` | Optional. With the token of the extension, the connect page does not ask the user. |
| `tabGroup` | `false` for a client without grouping |
| `tabGroupTitle` | Optional title of the group. The default is `Playwright · <client name>`. |
| `tabGroupColor` | Optional color: `green`, `blue`, `purple`, `orange`, `pink`, `cyan`, `yellow` or `red`. The default is the first of these, in this order, that no other client group has. `grey` is refused, because it marks a group that its client left. |
| `background` | `true` if the tabs of the client must not become active |

The MCP server has the options `--session-name`, `--session-color`, `--no-tab-group` and `--background`. The session name is the title of the group, and the session color is its color. The CLI gives the name of its session as the title, and `attach` has the options `--session-color` and `--no-tab-group`.

### Runtime messages

The pages send these messages to the service worker. They are internal to the extension.

| Message | From | What it does |
| --- | --- | --- |
| `connectionRequested { mcpRelayUrl }` | Connect page | `ConnectionBroker` records the relay URL for this tab, and `TabRegistry` reserves the tab |
| `getCandidates` | Connect page | `TabPicker` gives the free groups and the free tabs |
| `connect { options, selection }` | Connect page | Opens the channel, makes the session, applies the selection. `selection` is `{ groupId }`, `{ tabIds }` or empty. |
| `keepalive` | Connect page | Keeps the service worker alive while the page waits for the user |
| `getStatus` | Manage page | Gives each session: id, client name, tab ids |
| `disconnect { sessionId }` | Manage page | Closes that session |

## Flows

### Connect

1. The relay starts the browser with the connect page URL. The page checks the relay host and the protocol version, then sends `connectionRequested`.
2. With a correct token, the page sends `connect` with an empty selection. With no token, the page shows the free groups and the free tabs. The user picks one group, or checks some tabs, or picks nothing, and clicks **Allow**. A pick in one list clears the other.
3. `ConnectionBroker` opens the `Channel` (5 second limit) and makes the `ClientSession`. `TabGroupManager` gives the session its color.
4. `TabPicker` applies the selection:
   - **One group.** A client with grouping takes the group: it gets the color of the client, and the title only if the client gave one. The registry claims the tabs of the group. For a client without grouping, the group does not change.
   - **Some tabs.** The registry claims each tab. For a client with grouping, the manager moves them into its group.
   - **Nothing.** The connect page goes to `about:blank`, and the registry claims it.
5. The session sends `chrome.tabs.onCreated` for each claimed tab, then `extension.initialized`.
6. The first tab becomes active, unless `background` is set. The connect page closes, unless it became the blank tab.
7. The client sends `chrome.debugger.attach` for each announced tab.

A group or a tab that another client took in the meantime gives an error on the connect page, and the session closes.

### Drag a tab from the group of client A to the group of client B

1. Chrome reports the new group of the tab.
2. `TabGroupManager` finds that the owner must be B and is A. It calls `TabRegistry.transfer(tab, B)`.
3. The registry releases the tab from A: the debugger detaches, and A gets `chrome.debugger.onDetach`. Thus B does not get the CDP state of A.
4. The registry claims the tab for B, and B gets `chrome.tabs.onCreated`.

Playwright in A sees a closed page, and Playwright in B sees a new page. Other drags are parts of this flow:

| Drag | Registry call | The client sees |
| --- | --- | --- |
| Out of the group of A, to no group or to a free group | `release` | A: `chrome.debugger.onDetach` |
| Free tab into the group of B | `transfer` | B: `chrome.tabs.onCreated` |
| Tab of a client without grouping into the group of B | `transfer` | Old owner: `chrome.debugger.onDetach`. B: `chrome.tabs.onCreated`. |

A tab that the user drags into a free group goes to the client that takes that group later.

### Disconnect and resume

1. The channel closes: the client stopped, or the user clicked Disconnect on the manage page.
2. The registry releases all tabs of the session. Each `OwnedTab` detaches and clears its badge. The tabs stay open and are free.
3. `TabGroupManager` makes the group gray. The title and the tabs do not change.
4. Later, a client connects, and the user picks the gray group. The group gets the color of the new client, and the client gets `chrome.tabs.onCreated` for each of its tabs.

Resume is a pick of the user. A free group has no link to the client that left it, and any client can take it. A client that connects with a token gets no pick, so it starts with a blank tab and a new group.

A session with no tabs stays open. The client opens a blank tab with `chrome.tabs.create` on its next tool call.

A client without grouping leaves no group. Its tabs become free and stay where they are.

## Service worker

The sessions, the owner table and the pending connect pages are in the memory of the service worker. Chrome stops an idle service worker after 30 seconds. Two timers prevent that:

- While one or more sessions are open, `ConnectionBroker` calls an extension API each 20 seconds.
- While a connect page waits for the user, the page sends `keepalive` each 20 seconds.

Chrome starts a stopped service worker for each event that has a listener. Thus the listeners for tab, tab group and debugger events are on only while a session is open or a connect page waits. With no client, the browsing of the user does not start the service worker. A runtime message from one of the two pages starts it.

If the service worker stops in spite of the timers, its sessions close, and the clients connect again on their next tool call. A new service worker has no sessions, so it cleans up what the previous one left, before it answers a message:

- `TabGroupManager` records the ids of the client groups in `chrome.storage.session`. The new worker makes each recorded group gray.
- The new worker detaches the debuggers that the previous worker left attached, and clears their badges. The debugger of another tool stays attached.

The cleanup runs when the new worker starts, which is at the next runtime message. Until then, the group keeps the color of its client.

Gray groups stay after a browser restart.

## Client side

The client classes are in `packages/playwright-core/src/tools/mcp`.

| Class | Responsibility |
| --- | --- |
| `CDPRelayServer` (`cdpRelay.ts`) | The WebSocket server for Playwright and for the extension. Starts the browser with the connect page URL. Waits for `extension.initialized`. |
| `BrowserModel` (`browserModel.ts`) | Changes CDP from Playwright into `chrome.*` commands, and `chrome.*` events into CDP. Forgets a tab on `chrome.debugger.onDetach`, because a tab that went to another client stays open. |
| `ExtensionConnection` (`cdpRelay.ts`) | Message ids and responses on the extension WebSocket |

A CDP command with no session goes to the first attached tab, and the extension decides if it passes.

## Tests

The tests are in `tests/extension`. `harness.ts` has two actors: `user`, the person at the browser, and the clients that `connect()` and `connectWithToken()` start. `connectRelay()` connects as a relay, to send protocol commands directly.

| File | Subject |
| --- | --- |
| `extension.spec.ts` | Connect page, token, protocol versions, browser profile, relay |
| `client-lifecycle.spec.ts` | Clients that connect, leave, and take the tabs and groups of other clients |
| `tab-grouping.spec.ts` | Group title and color, gray groups, clients without grouping |
| `tab-dragging.spec.ts` | Drags between clients, free groups, new groups and windows |
| `tab-management.spec.ts` | Tabs that the client opens, selects and closes; popups |
| `protocol.spec.ts` | Events, owner checks and refused CDP methods |
| `scheme-detach.spec.ts` | Debugger detach by Chrome |
| `cli.spec.ts` | `attach --extension` from the CLI |
