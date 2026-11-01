// Makes the calls that an agent left in calls.json in its output directory, from a job that has
// write credentials and never runs the agent's code. Everything that is posted comes from the
// calls. The checks are there to catch mistakes: every call is checked before any of them runs,
// its shape against the schema, its repo against the Playwright repos, so that nothing is filed on
// someone else's repo, and, when the workflow gives a scope, its kind and target against it. When
// one call fails a check, none of them runs.
//
// The schema is calls.d.ts next to this file. The agent reads it, and this file imports its types.
// The checks below are written by hand, because the types are gone at run time: keep SCHEMA and
// check() in line with calls.d.ts.
//
// Node removes the types when it loads this file, and it checks none of them. Use only types that
// Node can remove: no enum, no namespace, no parameter properties, no `import x = require()`. An
// `import type` is removed too, and the file stays CommonJS.

import type { Call as FileCall, Comment, Issue, Kind, PullRequest, Push, Reply } from './calls';

const fs: typeof import('fs') = require('fs');
const path: typeof import('path') = require('path');
const { execFileSync }: typeof import('child_process') = require('child_process');

// A call after the checks: the text read from its file, the patch as an absolute path, and the
// repo in lower case.
type Checked<T> = Omit<T, 'body' | 'bodyFile'> & { body: string };
type Call = Checked<PullRequest> | Push | Checked<Issue> | Checked<Comment> | Checked<Reply>;

// The keys of a kind in calls.json, other than call and the text.
type KeysOf<K extends Kind> = Exclude<keyof Extract<FileCall, { call: K }>, 'call'>;
type Key = { [K in Kind]: KeysOf<K> }[Kind];

// What the calls may change. The workflow can give the parts with a SCOPE_ input.
type Scope = {
  // The repo of the run, the one that is checked out. A pull request and a push go to it, and the
  // issue and the pull request below are in it.
  repository: string,
  // SCOPE_KINDS: the kinds of calls that this run makes. Empty allows every kind.
  kinds: Set<Kind>,
  // SCOPE_ISSUE: the only issue that comments may target.
  issue?: number,
  // SCOPE_PULL_REQUEST: the only pull request that the push, the replies and the comments on it may
  // target.
  pullRequest?: number,
};

// The parts of the github-script objects that this file uses.
type Repo = { owner: string, repo: string };
type GitHub = {
  rest: {
    pulls: {
      create(params: Repo & { head: string, base: string, title: string, body: string, draft: boolean }): Promise<{ data: { number: number, html_url: string } }>,
      get(params: Repo & { pull_number: number }): Promise<{ data: { state: string, head: { ref: string, repo: { full_name: string } | null } } }>,
      getReviewComment(params: Repo & { comment_id: number }): Promise<{ data: { id: number, in_reply_to_id?: number, pull_request_url: string, html_url: string } }>,
      createReplyForReviewComment(params: Repo & { pull_number: number, comment_id: number, body: string }): Promise<unknown>,
    },
    issues: {
      addLabels(params: Repo & { issue_number: number, labels: string[] }): Promise<unknown>,
      createComment(params: Repo & { issue_number: number, body: string }): Promise<unknown>,
      create(params: Repo & { title: string, body: string, labels: string[] }): Promise<{ data: { html_url: string } }>,
      listLabelsForRepo: unknown,
      listForRepo: unknown,
    },
  },
  paginate<T>(method: unknown, params: object): Promise<T[]>,
};
type Core = {
  info(message: string): void,
  notice(message: string): void,
  warning(message: string): void,
  error(message: string): void,
  setFailed(message: string): void,
  setOutput(name: string, value: string | number): void,
  summary: { addRaw(text: string): { write(): Promise<unknown> } },
};
type Context = { repo: Repo, payload: { repository?: { default_branch?: string } } };

// The order in which the calls run, whatever their order in the file: a comment links the pull
// request and the issue that were opened before it, and a reply comes after the push it explains.
const KINDS: Kind[] = ['pull-request', 'push', 'issue', 'comment', 'reply'];

// The keys of each kind. A kind with text takes exactly one of body and bodyFile.
const SCHEMA: { [K in Kind]: { required: KeysOf<K>[], optional: KeysOf<K>[], text: boolean } } = {
  'pull-request': { required: ['repo', 'branch', 'title', 'patch'], optional: ['commitBody', 'labels'], text: true },
  'push': { required: ['repo', 'pullRequest', 'title', 'patch'], optional: ['commitBody', 'onto'], text: false },
  'issue': { required: ['repo', 'title'], optional: ['labels', 'filedFor'], text: true },
  'comment': { required: ['repo', 'issue'], optional: [], text: true },
  'reply': { required: ['repo', 'pullRequest', 'comment'], optional: [], text: true },
};

// The links that a comment can have, to what the calls before it opened.
const LINKS = { 'pull-request': '{{pull-request}}', 'issue': '{{issue}}' };

// microsoft/playwright and microsoft/playwright-<name>.
const FAMILY = /^microsoft\/playwright(-[a-z0-9]+)*$/;
const MAX_CALLS = 100;
const MAX_TITLE = 256;
const MAX_TEXT = 65536;
const MAX_LABELS = 10;

const BOT_NAME = 'microsoft-playwright-automation[bot]';
const BOT_EMAIL = '203992400+microsoft-playwright-automation[bot]@users.noreply.github.com';

async function publish({ github, context, core }: { github: GitHub, context: Context, core: Core }): Promise<void> {
  const env = process.env;
  const repository = `${context.repo.owner}/${context.repo.repo}`.toLowerCase();

  const kinds = new Set<Kind>();
  for (const kind of (env.SCOPE_KINDS ?? '').split(/[\s,]+/).filter(Boolean)) {
    if (!isKind(kind))
      throw new Error(`SCOPE_KINDS names an unknown call: ${kind}`);
    kinds.add(kind);
  }
  const scope: Scope = {
    repository,
    kinds,
    issue: number(env.SCOPE_ISSUE, 'SCOPE_ISSUE'),
    pullRequest: number(env.SCOPE_PULL_REQUEST, 'SCOPE_PULL_REQUEST'),
  };

  let calls: Call[] = [];
  let rejected = '';
  const dir = env.DIR ?? '';
  const file = path.join(dir, 'calls.json');
  if (fs.existsSync(file)) {
    try {
      calls = validate(JSON.parse(fs.readFileSync(file, 'utf8')), scope, dir);
    } catch (error) {
      rejected = (error as Error).message;
      core.error(`Rejected calls.json, so none of its calls runs: ${rejected}`);
    }
  } else {
    core.info('The agent left no calls.json');
  }

  const summary: string[] = [];
  const failures: string[] = [];
  // What the calls before a comment opened, for its links. A failed call leaves a note instead.
  const links = new Map<string, string>();
  let failedPush: number | undefined;
  const threads = new Set<number>();

  for (const call of calls) {
    const [owner, repo] = call.repo.split('/');
    const what = describe(call);
    try {
      if (failedPush !== undefined && call.repo === repository && targetOf(call) === failedPush) {
        core.warning(`Skipped ${what}: the push to the pull request failed`);
        summary.push(`- Skipped ${what}: the push failed`);
        continue;
      }
      switch (call.call) {
        case 'pull-request': {
          // The branch must be new, so that a mistake cannot push to main or to another branch.
          const commit = commitPatch({ patch: call.patch, title: call.title, body: call.commitBody, branch: call.branch, lease: '' });
          const { data: pr } = await github.rest.pulls.create({
            owner, repo, head: call.branch, base: context.payload.repository?.default_branch ?? 'main', title: call.title,
            body: call.body, draft: true,
          });
          const labels = await knownLabels(github, core, call.repo, call.labels);
          if (labels.length)
            await github.rest.issues.addLabels({ owner, repo, issue_number: pr.number, labels });
          core.setOutput('commit', commit);
          core.setOutput('pull-request', pr.html_url);
          links.set(LINKS['pull-request'], pr.html_url);
          summary.push(`- Opened the draft pull request ${pr.html_url}`);
          break;
        }
        case 'push': {
          const { data: pr } = await github.rest.pulls.get({ owner, repo, pull_number: call.pullRequest });
          if (pr.state !== 'open' || pr.head.repo?.full_name.toLowerCase() !== repository)
            throw new Error(`#${call.pullRequest} is not an open pull request from a branch of ${repository}`);
          // With onto, the patch is the whole branch against that commit. The push replaces the
          // branch only when it is still at the checkout.
          const commit = call.onto
            ? rebaseAndCommitPatch({ patch: call.patch, title: call.title, body: call.commitBody, branch: pr.head.ref, onto: call.onto })
            : commitPatch({ patch: call.patch, title: call.title, body: call.commitBody, branch: pr.head.ref });
          core.setOutput('commit', commit);
          summary.push(`- Pushed https://github.com/${repository}/commit/${commit}`);
          break;
        }
        case 'issue': {
          const url = await fileIssue(github, core, call);
          core.setOutput('issue', url);
          links.set(LINKS['issue'], url);
          summary.push(`- Issue ${url}`);
          break;
        }
        case 'comment': {
          let body = call.body;
          for (const link of Object.values(LINKS))
            body = body.split(link).join(links.get(link) ?? '(not opened, the agent run has the details)');
          await github.rest.issues.createComment({ owner, repo, issue_number: call.issue, body });
          core.setOutput('comment', 'true');
          summary.push(`- Commented on https://github.com/${call.repo}/issues/${call.issue}`);
          break;
        }
        case 'reply': {
          // Reply to the thread of the comment, and check that it is a thread of this pull request.
          const { data: target } = await github.rest.pulls.getReviewComment({ owner, repo, comment_id: call.comment });
          if (!target.pull_request_url.toLowerCase().endsWith(`/repos/${call.repo}/pulls/${call.pullRequest}`))
            throw new Error(`comment ${call.comment} is not in a review thread of #${call.pullRequest}`);
          const thread = target.in_reply_to_id ?? target.id;
          if (threads.has(thread)) {
            core.warning(`Skipped ${what}: the thread has a reply from this run already`);
            continue;
          }
          threads.add(thread);
          await github.rest.pulls.createReplyForReviewComment({ owner, repo, pull_number: call.pullRequest, comment_id: thread, body: call.body });
          summary.push(`- Replied to ${target.html_url}`);
          break;
        }
      }
    } catch (error) {
      core.error(`${what} failed: ${(error as Error).message}`);
      failures.push(what);
      summary.push(`- Failed: ${what}`);
      if (call.call === 'push')
        failedPush = call.pullRequest;
    }
  }

  await core.summary.addRaw(`### Calls\n\n${summary.join('\n') || 'No calls.'}\n`).write();
  if (rejected)
    core.setFailed(`Rejected calls.json: ${rejected}`);
  else if (failures.length)
    core.setFailed(`Failed: ${failures.join(', ')}`);
}

// Checks the shape and the scope of every call. Returns them in the order in which they run.
function validate(raw: unknown, scope: Scope, dir: string): Call[] {
  if (!Array.isArray(raw))
    throw new Error('calls.json must be an array of calls');
  if (raw.length > MAX_CALLS)
    throw new Error(`calls.json has ${raw.length} calls, more than ${MAX_CALLS}`);
  const errors: string[] = [];
  const calls: Call[] = [];
  const once = new Set<string>();
  raw.forEach((item: unknown, index: number) => {
    try {
      const call = parse(item, dir);
      checkScope(call, scope);
      const key = call.call === 'comment' ? `comment ${call.repo}#${call.issue}`
        : call.call === 'reply' ? `reply ${call.comment}`
          : call.call;
      if (once.has(key))
        throw new Error(`more than one ${call.call === 'comment' ? 'comment on the same issue' : call.call === 'reply' ? 'reply to the same comment' : `${call.call} call`}`);
      once.add(key);
      calls.push(call);
    } catch (error) {
      errors.push(`call ${index}: ${(error as Error).message}`);
    }
  });
  if (errors.length)
    throw new Error(errors.join('; '));
  // The sort is stable, so calls of the same kind keep the order of the file.
  return calls.sort((a, b) => KINDS.indexOf(a.call) - KINDS.indexOf(b.call));
}

function parse(item: unknown, dir: string): Call {
  if (!item || typeof item !== 'object' || Array.isArray(item))
    throw new Error('a call must be an object');
  const fields = item as Record<string, unknown>;
  const kind = fields.call;
  if (typeof kind !== 'string' || !isKind(kind))
    throw new Error(`unknown call ${JSON.stringify(kind)}, expected one of ${KINDS.join(', ')}`);
  const schema = SCHEMA[kind];
  const keys = ['call', ...schema.required, ...schema.optional, ...(schema.text ? ['body', 'bodyFile'] : [])];
  for (const key of Object.keys(fields)) {
    if (!keys.includes(key))
      throw new Error(`${kind} has an unknown key ${JSON.stringify(key)}`);
  }
  const call: Record<string, unknown> = { call: kind };
  for (const key of schema.required) {
    if (fields[key] === undefined)
      throw new Error(`${kind} needs ${key}`);
    call[key] = check(key, fields[key], dir);
  }
  for (const key of schema.optional) {
    if (fields[key] !== undefined)
      call[key] = check(key, fields[key], dir);
  }
  if (schema.text) {
    if ((fields.body === undefined) === (fields.bodyFile === undefined))
      throw new Error(`${kind} needs either body or bodyFile`);
    call.body = fields.body !== undefined
      ? text(fields.body, 'body')
      : text(fs.readFileSync(resolveFile(dir, fields.bodyFile), 'utf8'), 'bodyFile');
  }
  // The keys of the kind are all checked above, so the object has the shape of its kind.
  return call as Call;
}

function check(key: Key, value: unknown, dir: string): string | number | string[] {
  switch (key) {
    case 'repo': {
      if (typeof value !== 'string' || !FAMILY.test(value.toLowerCase()))
        throw new Error(`repo must be microsoft/playwright or microsoft/playwright-<name>, got ${JSON.stringify(value)}`);
      return value.toLowerCase();
    }
    case 'issue':
    case 'pullRequest':
    case 'comment': {
      if (!isId(value))
        throw new Error(`${key} must be a positive integer, got ${JSON.stringify(value)}`);
      return value;
    }
    case 'title': {
      if (typeof value !== 'string' || !value.trim() || value.length > MAX_TITLE || /[\r\n]/.test(value))
        throw new Error(`title must be one line of 1 to ${MAX_TITLE} characters`);
      return value.trim();
    }
    case 'branch': {
      if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._/-]{0,199}$/.test(value) || value.includes('..') || value.endsWith('/') || value.endsWith('.lock'))
        throw new Error(`branch must be a branch name, such as triage/123/456-1, got ${JSON.stringify(value)}`);
      return value;
    }
    case 'onto': {
      if (typeof value !== 'string' || !/^[0-9a-f]{40}$/.test(value))
        throw new Error(`onto must be a full commit sha, got ${JSON.stringify(value)}`);
      return value;
    }
    case 'patch':
      return resolveFile(dir, value);
    case 'commitBody':
    case 'filedFor': {
      if (typeof value !== 'string' || value.length > MAX_TEXT)
        throw new Error(`${key} must be a string of at most ${MAX_TEXT} characters`);
      return value.trim();
    }
    case 'labels': {
      if (!Array.isArray(value) || value.length > MAX_LABELS || !value.every(label => typeof label === 'string' && label.trim() && label.length <= 50))
        throw new Error(`labels must be an array of at most ${MAX_LABELS} label names`);
      return (value as string[]).map(label => label.trim());
    }
  }
}

function text(value: unknown, key: string): string {
  if (typeof value !== 'string' || !value.trim() || value.length > MAX_TEXT)
    throw new Error(`${key} must be a text of 1 to ${MAX_TEXT} characters`);
  return value.trim();
}

// A regular file in dir, from a relative path with forward slashes.
function resolveFile(dir: string, relative: unknown): string {
  if (typeof relative !== 'string' || !relative || relative.includes('\\') || relative.includes('\0') || relative.startsWith('/')
    || relative.split('/').some(part => !part || part === '.' || part === '..'))
    throw new Error(`a file must be a relative path in the output directory, got ${JSON.stringify(relative)}`);
  const file = path.join(dir, ...relative.split('/'));
  let stat;
  try {
    stat = fs.lstatSync(file);
  } catch {
    throw new Error(`${relative} does not exist in the output directory`);
  }
  if (!stat.isFile())
    throw new Error(`${relative} is not a regular file`);
  const realDir = fs.realpathSync(dir);
  if (!fs.realpathSync(file).startsWith(realDir + path.sep))
    throw new Error(`${relative} is outside the output directory`);
  return file;
}

function checkScope(call: Call, scope: Scope): void {
  const { repository, kinds, issue, pullRequest } = scope;
  if (kinds.size && !kinds.has(call.call))
    throw new Error(`${call.call} is outside SCOPE_KINDS, ${[...kinds].join(' ')}`);
  switch (call.call) {
    case 'pull-request':
      // The patch is pushed to the checkout, which is the repo of the run.
      if (call.repo !== repository)
        throw new Error(`a pull request can only be opened in ${repository}, the repo of the run`);
      break;
    case 'push':
    case 'reply':
      if (call.call === 'push' && call.repo !== repository)
        throw new Error(`a push can only go to ${repository}, the repo of the run`);
      if (pullRequest !== undefined && !(call.repo === repository && call.pullRequest === pullRequest))
        throw new Error(`${call.repo}#${call.pullRequest} is outside SCOPE_PULL_REQUEST, ${repository}#${pullRequest}`);
      break;
    case 'comment':
      if ((issue !== undefined || pullRequest !== undefined) && !(call.repo === repository && (call.issue === issue || call.issue === pullRequest)))
        throw new Error(`${call.repo}#${call.issue} is outside SCOPE_ISSUE and SCOPE_PULL_REQUEST, ${repository}#${issue ?? pullRequest}`);
      break;
  }
}

// The labels that exist in the repo. The others are dropped, so that a mistake creates no label.
async function knownLabels(github: GitHub, core: Core, repository: string, labels: string[] | undefined): Promise<string[]> {
  if (!labels?.length)
    return [];
  const [owner, repo] = repository.split('/');
  const known = new Set((await github.paginate<{ name: string }>(github.rest.issues.listLabelsForRepo, { owner, repo, per_page: 100 })).map(label => label.name));
  for (const label of labels) {
    if (!known.has(label))
      core.warning(`Dropped the label ${JSON.stringify(label)}, which ${repository} does not have`);
  }
  return labels.filter(label => known.has(label));
}

// Files the issue, or finds the open one that an earlier run filed for the same issue.
async function fileIssue(github: GitHub, core: Core, call: Checked<Issue>): Promise<string> {
  const [owner, repo] = call.repo.split('/');
  if (call.filedFor) {
    const open = await github.paginate<{ body?: string | null, html_url: string, pull_request?: unknown }>(github.rest.issues.listForRepo, { owner, repo, state: 'open', per_page: 100 });
    const link = new RegExp(`${call.filedFor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?!\\d)`, 'i');
    const existing = open.find(issue => !issue.pull_request && link.test(issue.body ?? ''));
    if (existing) {
      core.notice(`${existing.html_url} is already filed for ${call.filedFor}`);
      return existing.html_url;
    }
  }
  const labels = await knownLabels(github, core, call.repo, call.labels);
  const { data: issue } = await github.rest.issues.create({ owner, repo, title: call.title, labels, body: call.body });
  return issue.html_url;
}

// Applies the patch to the checkout, commits it on the checkout as the app, and pushes it to the
// branch. With lease set to '', the branch must not exist yet. Without a lease, the push fails when
// the branch moved since the checkout.
function commitPatch({ patch, title, body, branch, lease }: { patch: string, title: string, body?: string, branch: string, lease?: string }): string {
  const parent = git('rev-parse', 'HEAD');
  const commit = commitOn(parent, { patch, title, body, replayed: false });
  git('push', ...(lease !== undefined ? [`--force-with-lease=refs/heads/${branch}:${lease}`] : []), 'origin', `${commit}:refs/heads/${branch}`);
  return commit;
}

// The patch is the whole branch against onto. Replays the commits of the branch on onto when they
// replay cleanly, adds the patch as one commit, and replaces the branch when it is still at the
// checkout. When the commits do not replay, the branch becomes one commit on onto.
function rebaseAndCommitPatch({ patch, title, body, branch, onto }: { patch: string, title: string, body?: string, branch: string, onto: string }): string {
  const head = git('rev-parse', 'HEAD');
  git('fetch', '--no-tags', '--depth=500', 'origin', onto, head);
  let parent = onto;
  let replayed = false;
  try {
    git('merge-base', onto, head);
    git('rebase', '--quiet', onto, head);
    parent = git('rev-parse', 'HEAD');
    replayed = true;
  } catch {
    try {
      git('rebase', '--abort');
    } catch {}
  }
  git('checkout', '-q', '--detach', onto);
  const commit = commitOn(parent, { patch, title, body, replayed });
  git('push', `--force-with-lease=refs/heads/${branch}:${head}`, 'origin', `${commit}:refs/heads/${branch}`);
  return commit;
}

// Applies the patch to the work tree and commits the result on parent. git apply runs no hooks and
// no scripts from the patch.
function commitOn(parent: string, { patch, title, body, replayed }: { patch: string, title: string, body?: string, replayed: boolean }): string {
  git('config', 'user.name', BOT_NAME);
  git('config', 'user.email', BOT_EMAIL);
  git('apply', '--index', patch);
  // Workflow and action changes would run with this repo's secrets in PR CI.
  const workflowFiles = git('diff', '--cached', '--name-only', '--no-renames', '-z').split('\0').filter(file => file.startsWith('.github/'));
  if (workflowFiles.length)
    throw new Error(`the patch changes workflow files: ${workflowFiles.join(', ')}`);
  const tree = git('write-tree');
  const unchanged = tree === git('rev-parse', `${parent}^{tree}`);
  if (unchanged && !replayed)
    throw new Error('the patch changes nothing');
  // A rebase without a change adds no empty commit.
  return unchanged ? parent : git('commit-tree', tree, '-p', parent, '-m', title, ...(body ? ['-m', body] : []));
}

function git(...args: string[]): string {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

// The issue or pull request that a call changes, when it has one.
function targetOf(call: Call): number | undefined {
  switch (call.call) {
    case 'comment': return call.issue;
    case 'push':
    case 'reply': return call.pullRequest;
  }
  return undefined;
}

function describe(call: Call): string {
  switch (call.call) {
    case 'pull-request': return `pull-request in ${call.repo}`;
    case 'push': return `push to ${call.repo}#${call.pullRequest}`;
    case 'issue': return `issue in ${call.repo}`;
    case 'comment': return `comment on ${call.repo}#${call.issue}`;
    case 'reply': return `reply to comment ${call.comment} on ${call.repo}#${call.pullRequest}`;
  }
}

function isKind(value: string): value is Kind {
  return (KINDS as string[]).includes(value);
}

// A number from the workflow, or undefined when it gives none.
function number(value: string | undefined, name: string): number | undefined {
  if (!value)
    return undefined;
  const result = Number(value);
  if (!isId(result))
    throw new Error(`${name} must be a positive integer: ${value}`);
  return result;
}

function isId(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) > 0;
}

module.exports = publish;
module.exports.validate = validate;
