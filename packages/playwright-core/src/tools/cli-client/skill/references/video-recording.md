# Video Recording

Capture browser automation sessions as video for debugging, documentation, or verification. Produces WebM (VP8/VP9 codec).

## Basic Recording

```bash
# Open browser first
playwright-cli open

# Start recording
playwright-cli video-start

# Navigate and perform actions
playwright-cli goto https://example.com
playwright-cli snapshot
playwright-cli click e1
playwright-cli fill e2 "test input"

# Stop and save
playwright-cli video-stop --filename=demo.webm
```

## Best Practices

### 1. Use Descriptive Filenames

```bash
# Include context in filename
playwright-cli video-stop --filename=recordings/login-flow-2024-01-15.webm
playwright-cli video-stop --filename=recordings/checkout-test-run-42.webm
```

### 2. Record entire hero scripts.

When recording a video for the user or as a proof of work, it is best to create a code snippet and execute it.
It allows pulling appropriate pauses between the actions and annotating the video. There are new Playwright APIs for that.

1) Perform scenario using CLI and take note of all locators and actions
2) Create a file with the intended script for video (below)
3) Use playwright-cli run-code with it

```js
async page => {
  await page.video().start({ path: 'video.webm', size: { width: 1280, height: 800 } });
  await page.goto('https://demo.playwright.dev/todomvc');

  // Render big message, can be much prettier, this is just a basic version.
  await page.overlay.add(`
    <div style="position: absolute;
      top: 50%;
      left: 50%;
      transform: translateX(-50%);
      padding: 6px;
      background: #808080A0;
      border-radius: 10px;
      font-size: 24px;
      color: white;">1. Add the first item</div>
  `, { timeout: 2000 });

  // Perform action
  await page.getByRole('textbox', { name: 'What needs to be done?' }).pressSequentially('Walk the dog');
  await page.getByRole('textbox', { name: 'What needs to be done?' }).press('Enter');

  // Wait a bit for user to see what happened.
  await page.waitForTimeout(2000);

  // Now annotate what happened right on the screen.
  const bounds = await page.getByText('Walk the dog').boundingBox();
  await page.overlay.add(`
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
      background: #808080A0;
      border-radius: 10px;
      font-size: 14px;
      color: white;">Check it out, it is right above this text
    </div>
  `, { timeout: 2000 });


  // Alternatively, you can add sticky overlays and remove them explicitly:
  const o1 = await page.overlay.add('...');
  // Perform actions...
  await o1.dispose();
  await page.video().stop();
}
```

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
