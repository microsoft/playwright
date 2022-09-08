---
id: traces
title: "Trace Viewer"
---

Playwright Trace Viewer is a GUI tool that helps you explore recorded Playwright traces after the script has ran. You can open traces [locally](#viewing-the-trace) or in your browser on [`trace.playwright.dev`](https://trace.playwright.dev).

<img width="1355" alt="Playwright Trace Viewer" src="https://user-images.githubusercontent.com/13063165/189141619-9bcc0e1e-b081-475d-89a4-e501a120dbbd.png" />


To learn more on how to record a trace, see [Postmortem Debugging](./postmortem-debugging).
## Viewing the trace

You can open the saved trace using Playwright CLI or in your browser on [`trace.playwright.dev`](https://trace.playwright.dev).

```bash js
npx playwright show-trace trace.zip
```

```bash java
mvn exec:java -e -Dexec.mainClass=com.microsoft.playwright.CLI -Dexec.args="show-trace trace.zip"
```

```bash python
playwright show-trace trace.zip
```

```bash csharp
pwsh bin/Debug/netX/playwright.ps1 show-trace trace.zip
```

## Actions

Once trace is opened, you will see the list of actions Playwright performed on the left hand side:

<img width="300" alt="Trace Viewer Actions Tab" src="https://user-images.githubusercontent.com/13063165/189152329-23e965de-581e-4a20-aed7-12cbf0583c92.png" />

Selecting each action reveals:
- action snapshots,
- action log,
- source code location,
- network log for this action

In the properties pane you will also see rendered DOM snapshots associated with each action.

## Metadata

See metadata such as the time the action was performed, what browser engine was used, what the viewport was and if it was mobile and how many pages, actions and events were recorded.

<img width="296" alt="Trace Viewer Metadata Tab" src="https://user-images.githubusercontent.com/13063165/189155450-3865a993-cb45-439c-a02f-1ddfe60a1719.png" />

## Screenshots

When tracing with the [`option: screenshots`] option turned on, each trace records a screencast and renders it as a film strip:

<img width="1078" alt="Playwright Trace viewer > Film strip" src="https://user-images.githubusercontent.com/13063165/189174647-3e647d3d-6500-4be2-a237-9191f418eb12.png" />

You can hover over the film strip to see a magnified image:

<img width="819" alt="Playwright Trace viewer magnify" src="https://user-images.githubusercontent.com/13063165/189174658-ba218339-2abc-4336-812e-526dbc4d2907.png" />

This helps you quickly locate the action of interest.

## Snapshots

When tracing with the [`option: snapshots`] option turned on, Playwright captures a set of complete DOM snapshots for each action. Depending on the type of the action, it will capture:

| Type | Description |
|------|-------------|
|Before|A snapshot at the time action is called.|
|Action|A snapshot at the moment of the performed input. This type of snapshot is especially useful when exploring where exactly Playwright clicked.|
|After|A snapshot after the action.|

<br/>

Here is what the typical Action snapshot looks like:

<img width="634" alt="Playwright Trace Viewer > Snapshots" src="https://user-images.githubusercontent.com/13063165/189153245-0bdcad4d-16a3-4a71-90d8-71a8038c0720.png" />

Notice how it highlights both, the DOM Node as well as the exact click position.

## Call 

See what action was called, the time and duration as well as parameters, return value and log.

<img width="321" alt="Trace Viewer Call Tab" src="https://user-images.githubusercontent.com/13063165/189155306-3c9275bc-d4cd-4e91-8b63-225832a66f51.png" />

## Console

See the console output for the action.

<img width="299" alt="Trace Viewer Console Tab" src="https://user-images.githubusercontent.com/13063165/189173154-41d438dd-9334-4664-8c77-ee85f5040061.png" />


## Network

See any network requests that were made during the action.

<img width="321" alt="Trace Viewer Network Tab" src="https://user-images.githubusercontent.com/13063165/189155367-e19f1c89-4e62-4258-970d-6a740e891711.png" />

## Source

See the source code location.

<img width="476" alt="Trace Viewer Source Tab" src="https://user-images.githubusercontent.com/13063165/189155239-c0f6045c-ab67-404a-8140-e98f78c58ae1.png" />

To learn more on how to record a trace, see [Postmortem Debugging](./postmortem-debugging).
