# Developing Dashboard

`packages/dashboard` contains the sourcecode behind `playwright cli show`,
a dashboard that allow supervising agents while they use playwright cli.

Important code paths:

- `packages/dashboard` has the UI
- `dashboardController.ts` has the backend
- `show` section in `cli-client/program.ts`

You can use Playwright CLI to look at the dashboard:

```bash
# start the dashboard server in the background
npx playwright cli show --port=0

# open it with Playwright CLI
npx playwright cli open --session=dashboard localhost:PORT
npx playwright cli snapshot

# take screenshots to look at UI stuff
npx playwright cli screenshot

# take videos to showcase you work!
npx playwright cli video-start video.webm

# chapters are not everything - look at video-recording.md to learn about overlays, much more powerful! embrace creativity.
npx playwright cli video-chapter "Chapter Title" --description="Details" --duration=2000
npx playwright cli video-stop

# afterwards, use ffmpeg to turn the video into mp4 for sharing.
```

Full CLI reference: `packages/playwright-core/src/tools/cli-client/skill/SKILL.md`. In this repo, invoke as `npx playwright cli` instead of `playwright-cli`.
