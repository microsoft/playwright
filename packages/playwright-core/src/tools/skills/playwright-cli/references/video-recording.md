# Video Recording

Capture browser automation sessions as video for debugging, documentation, or verification. Produces WebM (VP8/VP9 codec).

## Basic Recording

```bash
# Open browser first
playwright-cli open

# Start recording, --cursor renders an animated mouse cursor that travels to each action point
# and paces actions by 800ms so that it has time to travel
playwright-cli video-start demo.webm --cursor --fps=60

# Add a chapter marker for section transitions
playwright-cli video-chapter "Getting Started" --description="Opening the homepage" --duration=2000

# Navigate and perform actions
playwright-cli goto https://example.com
playwright-cli snapshot
playwright-cli click e1

# Add another chapter
playwright-cli video-chapter "Filling Form" --description="Entering test data" --duration=2000
playwright-cli fill e2 "test input"

# Stop and save
playwright-cli video-stop
```

## Cursor, Target Highlight and Click Point

Three decorations can be drawn for each action: the mouse **cursor**, a **highlight** box around the
target element and a **point** marker at the click point. A **title** callout naming the action comes
with `video-show-actions`. The cursor is the only one `video-start --cursor` turns on; the rest are
opt-in and styled with plain CSS declarations, so they look exactly the way you want.

```bash
# Cursor only, nothing else on screen
playwright-cli video-start demo.webm --cursor

# Action callout, plus a red click point and a dark frame around the target
playwright-cli video-show-actions --duration=800 --position=top-right \
  --point-style="width: 20px; height: 20px; border-radius: 50%; background: rgba(255,0,0,.7)" \
  --highlight-style="outline: 2px solid #333; background: rgba(0,128,255,.15)" \
  --title-style="font-size: 16px"

# Stop annotating actions
playwright-cli video-hide-actions
```

The same options are available programmatically, which is the better choice for hero scripts:

```js
await page.screencast.showActions({
  // 'pointer' (default) animates the cursor from the previous action point, 'none' hides it.
  cursor: 'pointer',
  // How long decorations stay on screen. Actions are paced by this delay, 500ms by default.
  duration: 800,
  // Where the action title goes: top-left, top, top-right, bottom-left, bottom, bottom-right.
  position: 'top-right',
  style: {
    // Marker at the click point. The element is zero-sized and centered on the point,
    // so give it a size, or draw around the point with box-shadow. Hidden when omitted.
    point: 'width: 20px; height: 20px; border-radius: 50%; background: rgba(255, 0, 0, .7)',
    // Box that covers the target element. Hidden when omitted.
    // Prefer `outline` over `border`, it does not shrink the box.
    highlight: 'outline: 2px solid #333; background: rgba(0, 128, 255, .15)',
    // The action title. Use 'display: none' to keep the cursor but drop the callout.
    title: 'font-size: 16px',
  },
});
```

Notes:
- All decorations fade out over `duration`. Override `animation` in a style to do something else.
- The cursor stays on screen at the last action point between actions and across navigations,
  and travels along a slightly curved path, so it reads as a hand moving a mouse.
- Call `page.screencast.hideActions()` to stop annotating and hide the cursor.

## Best Practices

### 1. Use Descriptive Filenames

```bash
# Include context in filename
playwright-cli video-start recordings/login-flow-2024-01-15.webm
playwright-cli video-start recordings/checkout-test-run-42.webm
```

### 2. Record entire hero scripts.

When recording a video for the user or as a proof of work, it is best to create a code snippet and execute it with run-code.
It allows inserting appropriate pauses between the actions and annotating the video. There are new Playwright APIs for that.

1) Perform scenario using CLI and take note of all locators and actions. You'll need those locators to request their bounding boxes for highlight.
2) Create a file with the intended script for video (below). Use pressSequentially w/ delay for nice typing, make reasonable pauses.
3) Use playwright-cli run-code --filename your-script.js

**Important**: Overlays are `pointer-events: none` — they do not interfere with page interactions. You can safely keep sticky overlays visible while clicking, filling, or performing any actions on the page.

```js
async page => {
  await page.screencast.start({ path: 'video.webm', size: { width: 1280, height: 800 }, fps: 60 });
  // Show the cursor and mark the click point, and pace actions by 800ms.
  await page.screencast.showActions({
    duration: 800,
    style: {
      point: 'width: 20px; height: 20px; border-radius: 50%; background: rgba(255, 0, 0, .7)',
      title: 'display: none',
    },
  });
  await page.goto('https://demo.playwright.dev/todomvc');

  // Show a chapter card — blurs the page and shows a dialog.
  // Blocks until duration expires, then auto-removes.
  // Use this for simple use cases, but always feel free to hand-craft your own beautiful
  // overlay via await page.screencast.showOverlay().
  await page.screencast.showChapter('Adding Todo Items', {
    description: 'We will add several items to the todo list.',
    duration: 2000,
  });

  // Perform action
  await page.getByRole('textbox', { name: 'What needs to be done?' }).pressSequentially('Walk the dog', { delay: 60 });
  await page.getByRole('textbox', { name: 'What needs to be done?' }).press('Enter');
  await page.waitForTimeout(1000);

  // Show next chapter
  await page.screencast.showChapter('Verifying Results', {
    description: 'Checking the item appeared in the list.',
    duration: 2000,
  });

  // Add a sticky annotation that stays while you perform actions.
  // Overlays are pointer-events: none, so they won't block clicks.
  const annotation = await page.screencast.showOverlay(`
    <div style="position: absolute; top: 8px; right: 8px;
      padding: 6px 12px; background: rgba(0,0,0,0.7);
      border-radius: 8px; font-size: 13px; color: white;">
      ✓ Item added successfully
    </div>
  `);

  // Perform more actions while the annotation is visible
  await page.getByRole('textbox', { name: 'What needs to be done?' }).pressSequentially('Buy groceries', { delay: 60 });
  await page.getByRole('textbox', { name: 'What needs to be done?' }).press('Enter');
  await page.waitForTimeout(1500);

  // Remove the annotation when done
  await annotation.dispose();

  // You can also highlight relevant locators and provide contextual annotations.
  const bounds = await page.getByText('Walk the dog').boundingBox();
  await page.screencast.showOverlay(`
    <div style="position: absolute;
      top: ${bounds.y}px;
      left: ${bounds.x}px;
      width: ${bounds.width}px;
      height: ${bounds.height}px;
      border: 1px solid red;">
    </div>
    <div style="position: absolute;
      top: ${bounds.y + bounds.height + 5}px;
      left: ${bounds.x + bounds.width / 2}px;
      transform: translateX(-50%);
      padding: 6px;
      background: #808080;
      border-radius: 10px;
      font-size: 14px;
      color: white;">Check it out, it is right above this text
    </div>
  `, { duration: 2000 });

  await page.screencast.stop();
}
```

Embrace creativity, overlays are powerful.

### Overlay API Summary

| Method | Use Case |
|--------|----------|
| `page.screencast.showChapter(title, { description?, duration?, styleSheet? })` | Full-screen chapter card with blurred backdrop — ideal for section transitions |
| `page.screencast.showOverlay(html, { duration? })` | Custom HTML overlay — use for callouts, labels, highlights |
| `disposable.dispose()` | Remove a sticky overlay added without duration |
| `page.screencast.hideOverlays()` / `page.screencast.showOverlays()` | Temporarily hide/show all overlays |
| `page.screencast.showActions({ cursor, duration, position, style })` | Cursor, click point, target highlight and action title |
| `page.screencast.hideActions()` | Stop annotating actions and hide the cursor |

### 3. Attach the recording to the pull request

A hero script recording is the best proof of work for a user-facing change. GitHub accepts WebM as is, so once the recording looks right, attach it with `gh` 2.99+ instead of describing the flow in words:

```bash
gh pr create --title "feat(todo): add items inline" --body-file body.md --attach ./demo.webm
gh pr comment 123 --body "Walkthrough of the new flow." --attach ./demo.webm
gh issue comment 456 --body "Recording of the repro steps." --attach ./repro.webm
```

`gh` appends unreferenced attachments to the end of the body, which is the right place for a walkthrough. Videos are limited to 10 MB on free plans and 100 MB on paid plans, so keep the script focused, record at a modest size such as 1280x800 and drop chapters that do not add to the story. See [pr-attachments.md](pr-attachments.md) for the full set of commands, including attaching test artifacts from CI.

## Tracing vs Video

| Feature | Video | Tracing |
|---------|-------|---------|
| Output | WebM file | Trace file (viewable in Trace Viewer) |
| Shows | Visual recording | DOM snapshots, network, console, actions |
| Use case | Demos, documentation | Debugging, analysis |
| Size | Larger | Smaller |

## Limitations

- Recording adds slight overhead to automation
- Large recordings can consume significant disk space
