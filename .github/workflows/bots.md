# Triage and revision bots

Five repos run the same two bots: `microsoft/playwright`, `playwright-python`, `playwright-java`,
`playwright-dotnet` and `playwright-browsers`. The **Issue triage** workflow investigates one issue
on a large runner and proposes a fix as a draft PR. The **PR revision** workflow addresses the
maintainers' review comments on that PR. Both run the Copilot CLI unattended, through actions and
guides that live in this repo. Each repo keeps its own workflow files, with the parts that only it
knows: how it builds, which runners it uses, which extra outcome it has.

One rule shapes the design. The agent runs code that nobody reviewed: the repro from the issue,
sometimes a PR from a stranger. So the job that runs the agent has no credentials that can write.
The agent leaves files in an output directory, and lists what must happen on GitHub as calls in
`calls.json`. A fresh job checks the calls and makes them with the credentials of the app. It
never runs anything from the output directory.

This page is the reference for maintainers. The agent reads the guides instead.

## What this repo defines

Every repo calls these actions as `microsoft/playwright/.github/actions/<name>@main`. This repo
calls them as `./.github/actions/<name>`. A change to an action or a guide is live in every repo
the moment it lands on `main`.

| Action | What it does | Credentials it uses |
|---|---|---|
| [`ci-env`](../actions/ci-env/action.yml) | Exports `CI_ENV_EXEC`, a wrapper that runs a command under xvfb on Linux and at normal I/O priority on Windows, and `CI_ENV_WINDOWS_NORMAL_IO`, the PowerShell script behind it. The test workflows use it too. | none |
| [`run-agent`](../actions/run-agent/action.yml) | Copies the guides and `calls.d.ts` to `$AGENT_GUIDES_DIR`, runs the Copilot CLI with the prompt, puts the agent's `summary.md` into the run summary, uploads the output directory as an artifact and reports whether the result file exists. | the workflow token, for the Copilot requests and, when `github-tools` is `true`, for the GitHub tools |
| [`collect-review`](../actions/collect-review/action.yml) | Writes the context of the revision to `review.json` and uploads it: the issue that the PR closes, or that its branch names, with its comments; the PR, with its description and commits; and the comments, reviews and unresolved threads on the PR. Only the comments of people with write access and of the bot get through. Fails when the maintainers left nothing to address. | the workflow token, to read the PR, the issue and the collaborators |
| [`publish-calls`](../actions/publish-calls/action.yml) | Reads the agent's `calls.json`, checks every call against the schema and the Playwright repos, and makes none of them when one fails. Then opens the draft PR, pushes to the branch of a PR, files an issue, comments and replies in review threads, in that order, with the texts as the agent wrote them. See [The calls](#the-calls). | the app token |

`run-agent` runs the Copilot CLI with all tools and paths allowed and no questions to the user, with
a model and a credit budget that the workflow can override. `github-tools: true` gives the agent
the GitHub tools with the workflow token. `false` gives it no built-in tools and no URL access. The
PR CI triage workflow, [pr-ci-triage.yml](pr-ci-triage.yml), uses `run-agent` too.

### The guides

[`.github/actions/run-agent/guides/`](../actions/run-agent/guides/) has four guides. `run-agent`
copies them to `$RUNNER_TEMP/agent-guides` and names them at the end of the prompt.

- [`triage.md`](../actions/run-agent/guides/triage.md): how to triage an issue in any Playwright
  repo. The run, the runner, the outcomes, how to classify, reproduce, test and fix, how to review a
  third-party PR, and the proposal, the note and the summary to leave.
- [`revision.md`](../actions/run-agent/guides/revision.md): how to address the maintainers'
  comments and leave one commit.
- [`bot-voice.md`](../actions/run-agent/guides/bot-voice.md): how the bot writes.

The guides send the agent to two files in the repo. `AGENTS.md`, or `CLAUDE.md` where a repo has
that instead, says how to build, test and lint. The triage skill says what the repo adds. See
[What each repo adds](#what-each-repo-adds).

### The contract with the agent

The workflow sets these variables before the agent starts. The guides describe them to the agent.

| Variable | Meaning |
|---|---|
| `REPO_DIR` | The checkout of the repo. The working directory. |
| `OUTPUT_DIR` | Where the agent leaves its results. Uploaded as the artifact. |
| `SCRATCH_DIR` | Throwaway space. Not uploaded. |
| `AGENT_GUIDES_DIR` | The guides. |
| `ISSUE`, `TASK`, `TRIAGE_PLATFORM` | Triage: the issue number, the task from a manual run, and `linux`, `mac` or `windows`. |
| `PR`, `HEAD_SHA`, `BASE_SHA`, `REVIEW_DIR` | Revision: the PR number, its head, its merge base, and the directory with `review.json`. |
| `PLAYWRIGHT_DIR` | Repos other than this one: a checkout of `microsoft/playwright`. |

The agent leaves files in `$OUTPUT_DIR`. The workflow reads only these.

| File | Workflow | Read by |
|---|---|---|
| `summary.md` | both | `run-agent`, into the run summary |
| `copilot-session.md` | both | nobody. The Copilot CLI writes the transcript there; it is in the artifact. |
| `calls.json` | both | `publish-calls`, in the publish job or the push job |
| the files that the calls name, such as `comment.md`, `fix/fix.patch`, `fix/pr-body.md`, `commit/revision.patch`, `browser/report.md` | both | `publish-calls`, as the text of a call or as the patch to apply |

The agent writes the whole `calls.json` each time and renames it into place, so the file is never
half written. A call marks its result as complete: the triage agent writes the `comment` call as
soon as the note is ready and adds the `pull-request` call only when the proposal is done. A session
that runs out of budget after it wrote a call is still published. `run-agent` reports `has-result`
when `calls.json` exists.

### The calls

`calls.json` is an array of calls, each with its kind in `call`. The schema is
[`calls.d.ts`](../actions/publish-calls/calls.d.ts): TypeScript types, with comments that give the
checks, what the publish job does with the calls, and how to write the file. `run-agent` copies it
to `$AGENT_GUIDES_DIR`, and the guides send the agent to it.
[`publish-calls.ts`](../actions/publish-calls/publish-calls.ts) imports its types with
`import type`, which Node removes when it loads the file. Node checks no types at run time, so the
checks in `publish-calls.ts` are written by hand; keep them in line with `calls.d.ts`.

| Call | Keys | What `publish-calls` does |
|---|---|---|
| `pull-request` | `repo`, `branch`, `title`, `patch`, `body` or `bodyFile`, `commitBody`, `labels` | Applies the patch to the checkout with `git apply --index`, rejects a patch that touches `.github/`, commits as the app, pushes to the branch, which must not exist yet, and opens a draft PR on the default branch with the labels that the repo has. |
| `push` | `repo`, `pullRequest`, `title`, `patch`, `commitBody`, `onto` | Checks that the PR is open and comes from a branch of the repo, and pushes to that branch. With `onto`, the patch is the whole PR against that commit: the PR is replayed on it and the branch is replaced. The push fails when the branch moved since the checkout. |
| `issue` | `repo`, `title`, `body` or `bodyFile`, `labels`, `filedFor` | Uses an open issue whose text has the `filedFor` URL, or files one with the labels that the repo has. |
| `comment` | `repo`, `issue`, `body` or `bodyFile` | Posts the text, with `{{pull-request}}` and `{{issue}}` replaced by the URLs of what the calls before it opened, or by a note when they failed. |
| `reply` | `repo`, `pullRequest`, `comment`, `body` or `bodyFile` | Checks that the comment is in a review thread of that PR, and replies to the thread. One reply per thread. |

The agent writes every text that is posted, with the footer that names the bot and links the run,
and the branch, the commit body, the labels and `onto`. The guides and the skills say what to put
in them.

The checks, before any call runs:

- **The shape.** Only the keys above, with the right types. Titles are one line of at most 256
  characters. A file is a regular file inside the output directory, named by a relative path
  without `..`. At most one `pull-request`, one `push` and one `issue`, one comment per issue, one
  reply per comment.
- **The family.** `repo` is `microsoft/playwright` or `microsoft/playwright-<name>`, so that a
  mistake files nothing on someone else's repo. A pull request and a push go only to the repo of
  the run, which is the checkout.
- **The scope, when the workflow gives one.** `scope-kinds` lists the kinds that the run may make.
  `scope-issue` is the one issue that comments may target. `scope-pull-request` is the one PR that
  the push, the replies and the comments may target. The workflows give none today.

The checks are there to catch mistakes, not to stop an agent that wants to do harm: what the calls
do is visible and can be undone. When a check fails, no call runs, and the job fails. The calls run
in a fixed order, whatever the order in the file: `pull-request`, `push`, `issue`, `comment`,
`reply`. When a call fails at run time, the others still run, except that a failed push skips the
comments and replies on its PR, and the job fails at the end.

## The Issue triage workflow

A maintainer applies `needs-triage`, `needs-triage-mac` or `needs-triage-win` to an issue, or
starts the workflow by hand with an issue number, a platform and a task. The task directs the work;
without an issue it is the whole job, and the result is the run summary only. Applying the label
again starts another run. One run per issue runs at a time.

| Job | Runner | What it does |
|---|---|---|
| `start` | `ubuntu-latest` | Posts "I started to triage this issue" with the run link. Keeps the comment id. |
| `triage` | the platform's large runner | Checks out `main` without credentials. Records `REPO_DIR`, `OUTPUT_DIR` and `SCRATCH_DIR`. Runs the repo's `setup-triage-runner`. Writes the prompt. Runs `run-agent` with the GitHub tools. Outputs the base commit and the outcomes of setup and of the agent. |
| `publish` | `ubuntu-latest` | After every run, also a failed one. Gets an app token. In this repo, the token also has `microsoft/playwright-browsers`, for the browser bug. Checks out the base commit with it. Downloads the artifact if there is one. With an issue and no comment on it in `calls.json`, adds a comment that says that the bot could not finish, and why: setup failed, the session failed or ran out of budget, or it ended without a comment. Runs `publish-calls`. When a comment was posted, hides the comment with the run link. |

The calls are made by the app, not with the workflow token, because a PR opened with the workflow
token starts no workflows: CI would not run on it. The app's PR is a normal PR of this repo. CI runs
on it, and the revision workflow accepts it. The comment on the issue comes from the app too.

## The PR revision workflow

A maintainer applies `needs-revision`, `needs-revision-mac` or `needs-revision-win` to a PR that the
triage workflow opened. The event is `pull_request_target`, so the workflow file always comes from
`main`, whatever the PR changes. Applying the label again starts another run. One run per PR runs at
a time.

| Job | Runner | What it does |
|---|---|---|
| `prepare` | `ubuntu-latest` | Accepts the PR only when it is open, the app is its author and its branch is in this repo. Runs `collect-review`, which records the head, the merge base and the branch and uploads `review.json`. Posts the run link on the PR. |
| `revise` | the platform's large runner | Checks out the head commit without credentials. Fetches the base commit. Downloads the review. Runs `setup-triage-runner`. Runs `run-agent` without GitHub tools. The prompt names `revision.md`, the repo's instructions file, and the lines that are specific to the repo. Outputs `has_revision`. |
| `push` | `ubuntu-latest` | When `has_revision` is true. Gets an app token. Checks out the head commit with it. Downloads the artifact. Runs `publish-calls`. |

The commit on the PR is the change, and CI runs on it. The answer to the review is on the PR: a
`reply` to each review comment, and one `comment` that says what the agent did and answers the
comments outside the threads. The commit has only a title. The push applies the patch on the head
that `prepare` recorded. When the branch moved in the meantime, the push fails, nothing is
overwritten, and no reply is posted.

## What each repo adds

The part that is specific to a repo sits in four places: its workflow files, its
`setup-triage-runner` action, its triage skill, and its instructions file.

### The workflow files

Each repo has its own `triage.yml` and `revision.yml`. They have the same shape. The differences:

- The `github.repository` guard on each job.
- The runner map from label to platform to runner. This repo and the ports use
  `playwright-x64-ubuntu24-64-core` for Linux, `macos-15-xlarge` for macOS and
  `playwright-x64-server2025-64-core` for Windows. `playwright-browsers` resolves the runner from
  the labels of the issue; see below.
- The `exec` input of `run-agent`: the ports pass `CI_ENV_EXEC`, `playwright-browsers` passes its
  own `EXEC`, this repo passes none.
- The prompt: the skill to follow, `AGENTS.md` or `CLAUDE.md`, and in `revision.yml` the one or
  two lines that only the repo knows, such as what `PLAYWRIGHT_DIR` is.
- The footer of the comment that says that the bot could not finish. The footer of the agent's
  texts is in the guides, and the skill of `playwright-browsers` gives its own.

### setup-triage-runner

The action builds the repo the way CI builds it, installs the browsers and the Copilot CLI, calls
`ci-env`, and exports what the agent needs beyond the common variables. This repo has these steps
in the workflow itself.

| Repo | Build | `PLAYWRIGHT_DIR` |
|---|---|---|
| `playwright` | `npm ci`, `npm run build`, install the three browsers | not set |
| `playwright-python` | `pip install`, `scripts/upstream.py checkout`, build the wheel, install the three browsers | `.upstream/`, at the commit in `DRIVER_VERSION` |
| `playwright-java` | download the driver, `mvn install`, install the browsers through the CLI | a shallow clone of `main`, to read the client that the repo ports |
| `playwright-dotnet` | `build.sh --download-driver`, `dotnet build`, install the browsers through `playwright.ps1` | a shallow clone of `main` |
| `playwright-browsers` | takes `browser` and `platform`; checks out `microsoft/playwright` at the last nightly as the workspace root with this repo nested in it, builds it and installs that browser; on Linux everything runs in the build container of the flavor through `EXEC`, on macOS and Windows the build dependencies are installed on the runner | the workspace root |

### The triage skill and the instructions file

`.claude/skills/playwright-triage/SKILL.md` in each repo opens with a link to `triage.md`, the
shared guide, and to the instructions file. It has what neither has. That is the checkouts and
their variables, how to run a published version, the outcome that the repo adds, and what not to
run from a PR of a third party. `playwright-browsers` keeps a second file next to it with the browser
builds, the patches, how to export, and a Revision section. There is no revision skill: the prompt
of `revision.yml` carries the repo-specific lines.

`AGENTS.md`, or `CLAUDE.md`, has how to build, test and lint, where tests go, how much to test, and
the commit convention. The guide tells the agent to read it in full, and again before changing code.

### The extra outcome

- `playwright`: a browser bug. The agent writes `browser/report.md`. A Firefox or WebKit bug is an
  `issue` call to `microsoft/playwright-browsers`, with the browser label and an optional platform
  label, and the comment gets a `Blocked-by:` line. A Chromium bug goes to a maintainer: the agent
  puts the title and the body to file at crbug.com, where only a person can file, into its comment.
- The ports: an upstream bug. The agent puts the title and the body of the report into its comment,
  for a maintainer to file in `microsoft/playwright`. The bot never files there: the skills of the
  ports make no `issue` call.
- `playwright-browsers`: an upstream bug is fixed in the patch, and the note and the PR carry the
  upstream bug to file. The `pull-request` call labels the PR with the platform and the browser.

### Platforms in playwright-browsers

The browser builds have one flavor per distribution and architecture, so the labels of the issue
choose the flavor. `browser-firefox` or `browser-webkit` names the browser, and a `platform-*` label
such as `platform-debian-12-arm64` names the flavor. Without a platform label, `needs-triage` runs
on `ubuntu-24.04`, `needs-triage-mac` on `mac-26-arm64` and `needs-triage-win` on `win64`.
[`triage-platforms.json`](https://github.com/microsoft/playwright-browsers/blob/main/.github/workflows/triage-platforms.json)
maps each flavor to a display name and a runner. The `start` job resolves the flavor, the browser,
the runner and the commit of the last nightly, and the `triage` job runs on that runner. The PR gets
the `platform-*` and `browser-*` labels, and the revision workflow reads them to revise with the
same browser on the same flavor.

## Permissions

The workflow files declare `permissions: {}` at the top. Each job states what it needs. A job
without a `permissions` key has a workflow token that can do nothing. GitHub passes a secret only
to a job that names it. The job that runs the agent names none, so the private key of the app is
not available to it.

### Issue triage

| Job | Token | Permissions | Runs the agent's code |
|---|---|---|---|
| `start` | workflow | `issues: write`, and `contents: read` in `playwright-browsers` for the checkout of the platform map | no |
| `triage` | workflow | `copilot-requests: write`. `playwright-browsers` adds `contents`, `issues`, `pull-requests` and `actions` read, because the repo is private. | yes |
| `publish` | app, limited to the repo of the run (and `playwright-browsers` in this repo) and to `contents`, `issues` and `pull-requests` write | none for the workflow token | no |

What each measure protects:

- The agent runs the repro from the issue, and sometimes a PR from a stranger. Its job has the
  workflow token with `copilot-requests: write` only, which is what the Copilot CLI needs. On a
  public repo the GitHub tools read issues, PRs and code with it. They cannot comment, label or
  push. The checkout does not keep the token, so `git push` has nothing to push with.
- The artifact is the only path from the agent to GitHub. The job that reads it treats it as data:
  `calls.json` is parsed and checked, the patch goes through `git apply --index`, which runs no
  hooks and no scripts, and the markdown is posted. Nothing from the artifact is executed.
- `publish-calls` checks the calls for mistakes before it makes any: the shape, the Playwright
  repos, and a new branch for a PR, so that a wrong branch name cannot push to `main`. What the
  calls do is visible and can be undone. The app token limits the repos: in triage, the repo of the
  run and, in this repo, `microsoft/playwright-browsers`.
- `publish-calls` rejects a patch that touches `.github/`. A change there would run in the PR's CI
  with the secrets of this repo. Because of this guard, the PR's CI runs the workflows exactly as
  they are on `main`.
- The push is never forced, and the branch name is unique per run.
- The app token is minted in the job that uses it and expires after an hour. It is limited to the
  repos and the permissions that the calls need.
- Only people with triage access can apply a label, and only people with write access can start
  the workflow by hand. So a maintainer starts every run.
- The timeout of the job, the concurrency group per issue and the credit budget of the session
  bound the cost of a run.

### PR revision

| Job | Token | Permissions | Runs the agent's code |
|---|---|---|---|
| `prepare` | workflow | `pull-requests: write`, for the comment with the run link, and `contents: read` in this repo and `playwright-browsers` for the checkout | no |
| `revise` | workflow | `copilot-requests: write`, and `contents: read` in `playwright-browsers` | yes |
| `push` | app, limited to this repo and to `contents` and `pull-requests` write | none for the workflow token | no |

What each measure protects:

- `pull_request_target` runs the workflow file from `main`, with the base branch checked out. The
  PR cannot change what runs. The jobs accept only an open PR that the app authored from a branch
  of this repo. A PR from a fork or from a person is ignored.
- `collect-review` keeps only the comments of people whose permission on the repo is write or
  admin, and of the bot, drops resolved threads, and fails when the maintainers left nothing. The
  only instructions that reach the agent come from maintainers. The text of the issue is from its
  reporter, and the guide tells the agent to read it as data.
- The agent runs with no GitHub tools and no URL access. It reads the issue and the PR from
  `review.json` only.
  Its checkout is the head of the PR, without credentials.
- The `push` job applies the patch on the head that `prepare` recorded, commits as the app and
  pushes without force. When a maintainer pushed in the meantime, the push fails and nothing is
  overwritten. The `.github/` guard applies as in triage.
- A reply must name a comment that is in a review thread of its PR. When the push fails, no reply
  and no comment is posted on the PR.
- The commit is a normal push to the branch of the PR, so CI runs on it.

## Operating the bots

What a repo needs:

- The six labels: `needs-triage`, `needs-triage-mac`, `needs-triage-win`, `needs-revision`,
  `needs-revision-mac`, `needs-revision-win`. All five repos have them.
- The Playwright automation app installed on the repo, with write access to contents, issues and
  pull requests. The variable with the app id, `PLAYWRIGHT_APP_CLIENT_ID` in this repo and
  `PLAYWRIGHT_APP_ID` in the others, and the secret `PLAYWRIGHT_PRIVATE_KEY`. For the browser bug of
  this repo, the app also needs write access to issues in `playwright-browsers`.
- Access to the `playwright-x64-*` runner group, and to the macOS runners.
- Copilot: the `copilot-requests: write` permission, and the Copilot CLI, which
  `setup-triage-runner` installs.

Where to look after a run:

- The run summary has the agent's `summary.md` and whether the Copilot session succeeded.
- The `triage` or `revision` artifact has the output directory, with `copilot-session.md`, the
  transcript of the session.
- Every comment, reply, PR and issue from the bot links the run. The comment with the run link is
  hidden when the triage comment is posted. The summary of the publish or push job lists each call
  and what happened to it.

How to change the system:

- Behavior that is the same everywhere: change the action or the guide in this repo. It is live in
  every repo as soon as it lands on `main`. Try it with a manual run on this repo first.
- Behavior of one repo: change its workflow files, its `setup-triage-runner`, its skill or its
  instructions file.
- A new repo needs:
  - the workflow pair, copied from `playwright-python`;
  - a `setup-triage-runner` action;
  - a triage skill that links to the shared guide;
  - an instructions file with build, test and lint;
  - the six labels;
  - the app, with its variable and its secret;
  - access to the runner group.
