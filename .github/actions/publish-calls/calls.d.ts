// The calls that the workflow makes on GitHub for the agent.
//
// The job that runs you has no write credentials. You ask for everything that must happen on
// GitHub in one file, $OUTPUT_DIR/calls.json: a JSON array of `Call`, as typed below. After your
// session, a fresh job reads the file and makes the calls as the Playwright automation app,
// microsoft-playwright-automation. That job never runs anything from $OUTPUT_DIR. It posts your
// texts as they are, and adds nothing to them. It checks every call before it makes any of them,
// to catch mistakes. When one call fails a check, it makes none of them.
//
// An example from a triage run that proposes a fix:
//
//   [
//     {
//       "call": "pull-request",
//       "repo": "microsoft/playwright",
//       "branch": "triage/12345/9876543210-1",
//       "title": "fix(route): keep the charset of the fulfilled response",
//       "patch": "fix/fix.patch",
//       "bodyFile": "fix/pr-body.md",
//       "commitBody": "Fixes: https://github.com/microsoft/playwright/issues/12345"
//     },
//     { "call": "comment", "repo": "microsoft/playwright", "issue": 12345, "bodyFile": "comment.md" }
//   ]
//
// The checks:
// - Only the keys in the types below, with their types. Numbers are JSON numbers, not strings.
// - `repo` is `owner/name` of a Playwright repo: microsoft/playwright or
//   microsoft/playwright-<name>.
// - A push goes only to the repo of the run. A pull request goes to the repo of the run, or to
//   microsoft/playwright when the skill of the repo says so. The branch of a new PR must not exist
//   yet.
// - The workflow can allow only some kinds of calls, and one issue or one PR as the target. A call
//   outside them is rejected.
// - A path is relative to $OUTPUT_DIR, with `/` between the parts and without `..`. It names a
//   regular file in $OUTPUT_DIR, not a link.
// - A title is one line of at most 256 characters. A text has at most 65536 characters.
// - A label that the repo does not have is dropped.
// - At most one call of each kind `pull-request`, `push` and `issue`, at most one comment on each
//   issue, and at most one reply to each comment.
//
// What the job does with the calls:
// - It makes them in this order, whatever their order in the file: pull-request, push, issue,
//   comment, reply.
// - In a comment, it replaces `{{pull-request}}` with the URL of the PR that the pull-request call
//   opened, and `{{issue}}` with the URL of the issue that the issue call filed or found. When that
//   call failed, or there is none, it puts a note that says so instead. You cannot know these URLs
//   before the job runs, so use the placeholders, for example `Draft PR: {{pull-request}}`.
// - When the push fails, it makes no comment and no reply on that PR.
//
// The footer: end every text with one line that names what the bot did and links the run, such as
//   <sub>Triaged on Linux by the Playwright bot - [agent run](<run url>)</sub>
// The run url is $GITHUB_SERVER_URL/$GITHUB_REPOSITORY/actions/runs/$GITHUB_RUN_ID. The guide of
// the run says what to write before it. A comment on the issue that you triage ends with
// `<!-- playwright-ai-triage -->` after the footer, so that later runs find it.
//
// When there is no comment on the issue of a triage run, the workflow posts that the bot could not
// finish.
//
// How to write the file: write the whole array each time that you change it. Write it to
// $OUTPUT_DIR/calls.json.tmp, check it, then rename it with `mv` to $OUTPUT_DIR/calls.json. Then
// the file is never half written, also when the session ends while you write. The job takes the
// last version.
//
//   node -e 'const c = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")); if (!Array.isArray(c)) throw new Error("not an array")' "$OUTPUT_DIR/calls.json.tmp" \
//     && mv "$OUTPUT_DIR/calls.json.tmp" "$OUTPUT_DIR/calls.json"
//
// Add a call only for work that is done. The job makes every call in the file, also when your
// session fails or runs out of budget later.
//
// publish-calls.ts in microsoft/playwright/.github/actions/publish-calls/ imports these types and
// makes the checks.

export type Call = PullRequest | Push | Issue | Comment | Reply;

export type Kind = Call['call'];

/** The markdown of a comment, a reply, a PR description or an issue. Give one of the two keys. */
export type Text =
  /** The markdown itself. */
  | { body: string }
  /** A markdown file in $OUTPUT_DIR, such as "comment.md". */
  | { bodyFile: string };

/** Opens your fix as a draft PR. The text is the description of the PR. */
export type PullRequest = Text & {
  call: 'pull-request';
  /** The repo of the run, or the repo where the skill says that the fix goes. */
  repo: string;
  /** A new branch for the PR, such as "triage/<issue>/<run id>-<run attempt>". */
  branch: string;
  /** The title of the commit and of the PR. */
  title: string;
  /** A patch file in $OUTPUT_DIR, against the commit of the checkout of that repo, such as
   * "fix/fix.patch". */
  patch: string;
  /** The body of the commit, such as "Fixes: <issue url>". */
  commitBody?: string;
  /** Labels for the PR, which exist in the repo. */
  labels?: string[];
};

/** Pushes your commit to the branch of the PR that you revise. */
export type Push = {
  call: 'push';
  /** The repo of the run. */
  repo: string;
  /** The PR of the run. */
  pullRequest: number;
  /** The title of the commit. */
  title: string;
  /** A patch file in $OUTPUT_DIR, such as "commit/revision.patch": against the head of the PR, or
   * against `onto` when you give it. */
  patch: string;
  /** The body of the commit. */
  commitBody?: string;
  /** The commit that you rebased the PR on, as a full sha. The patch is then the whole PR against
   * it: the job replays the commits of the PR on it, and replaces the branch of the PR. */
  onto?: string;
};

/** Files an issue in another repo, such as a browser bug in microsoft/playwright-browsers. */
export type Issue = Text & {
  call: 'issue';
  repo: string;
  title: string;
  /** Labels, which exist in that repo. */
  labels?: string[];
  /** The URL of the issue that you file this one for, also in the text. When an open issue in that
   * repo has it in its text, the job uses that issue and files no new one. */
  filedFor?: string;
};

/** Posts a comment on an issue, or in the conversation of a PR. */
export type Comment = Text & {
  call: 'comment';
  repo: string;
  /** The number of the issue or of the PR. */
  issue: number;
};

/** Posts a reply in a review thread of a PR. */
export type Reply = Text & {
  call: 'reply';
  repo: string;
  pullRequest: number;
  /** The id of a comment in the thread, from review.json. */
  comment: number;
};
