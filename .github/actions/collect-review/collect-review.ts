// Collects the context of a revision into review.json in the directory, for the revision agent.
// The file has three parts: the issue that the pull request is for, with its text and the comments
// on it; the pull request, with its description and commits; and the comments, reviews and
// unresolved review threads on the pull request. Only the comments of people with write access,
// the maintainers, and of the bot itself get through. Throws when the maintainers left nothing to
// address. action.yml next to this file runs it through actions/github-script, with the number of
// the pull request and the directory in the environment, and uploads the directory.
//
// Node removes the types when it loads this file, and it checks none of them. Use only types that
// Node can remove: no enum, no namespace, no parameter properties, no `import x = require()`. The
// file stays CommonJS.

const fs: typeof import('fs') = require('fs');
const path: typeof import('path') = require('path');

type Repo = { owner: string, repo: string };
type Author = { __typename: string, login: string } | null;
type Connection<T> = { totalCount: number, nodes: T[] };
type Comment = { author: Author, body: string, createdAt: string, url: string };
type Review = Comment & { state: string };
type ThreadComment = Comment & { fullDatabaseId: string, diffHunk: string };
type Thread = { isResolved: boolean, isOutdated: boolean, path: string, line: number | null, originalLine: number | null, comments: Connection<ThreadComment> };
type PullRequestData = {
  closingIssuesReferences: Connection<{ number: number, repository: { name: string, owner: { login: string } } }>,
  comments: Connection<Comment>,
  reviews: Connection<Review>,
  reviewThreads: Connection<Thread>,
};
type IssueData = { number: number, url: string, title: string, body: string, author: { login: string } | null, comments: Connection<Comment> };
type GitHub = {
  rest: {
    pulls: {
      get(params: Repo & { pull_number: number }): Promise<{ data: { number: number, html_url: string, title: string, body: string | null, head: { sha: string, ref: string }, base: { ref: string } } }>,
      listCommits: unknown,
    },
    repos: {
      getBranch(params: Repo & { branch: string }): Promise<{ data: { commit: { sha: string } } }>,
      getCollaboratorPermissionLevel(params: Repo & { username: string }): Promise<{ data: { permission?: string } }>,
    },
  },
  paginate<T>(method: unknown, params: object): Promise<T[]>,
  graphql<T>(query: string, variables: object): Promise<T>,
};
type Core = {
  warning(message: string): void,
  setOutput(name: string, value: string | number): void,
};
type Context = { repo: Repo };

// A comment in review.json: from a maintainer or from the bot. Anyone else's is dropped.
type Role = 'maintainer' | 'bot';
type Entry = { role: Role, author: string, createdAt: string, url: string, body: string };
type Item =
  | ({ kind: 'comment' } & Entry)
  | ({ kind: 'review', state: string } & Entry)
  | { kind: 'thread', path: string, line: number | null, outdated: boolean, diffHunk: string, createdAt: string, comments: ({ id: number } & Entry)[] };

async function collect({ github, context, core }: { github: GitHub, context: Context, core: Core }): Promise<void> {
  const { owner, repo } = context.repo;
  const pull_number = Number(process.env.PULL_NUMBER);
  const dir = process.env.DIR!;
  fs.mkdirSync(dir, { recursive: true });

  const { data: pr } = await github.rest.pulls.get({ owner, repo, pull_number });
  const { data: { commit: { sha: base } } } = await github.rest.repos.getBranch({ owner, repo, branch: pr.base.ref });
  const commits = await github.paginate<{ sha: string, commit: { committer: { date: string }, message: string } }>(github.rest.pulls.listCommits, { owner, repo, pull_number, per_page: 100 });
  const fields = 'author { __typename login } body createdAt url';
  const { repository: { pullRequest: data } } = await github.graphql<{ repository: { pullRequest: PullRequestData } }>(`
    query($owner: String!, $repo: String!, $number: Int!) {
      repository(owner: $owner, name: $repo) {
        pullRequest(number: $number) {
          closingIssuesReferences(first: 1) { nodes { number repository { name owner { login } } } }
          comments(last: 100) { totalCount nodes { ${fields} } }
          reviews(last: 100) { totalCount nodes { ${fields} state } }
          reviewThreads(last: 100) {
            totalCount
            nodes {
              isResolved isOutdated path line originalLine
              comments(first: 100) { totalCount nodes { ${fields} fullDatabaseId diffHunk } }
            }
          }
        }
      }
    }`, { owner, repo, number: pull_number });

  // The issue that the pull request closes. It can be in another repo of the owner: a fix for
  // playwright-cli or playwright-mcp lands here. A coverage PR closes none: its branch names
  // the issue, triage/<n>/... for an issue in this repo and triage/<repo>-<n>/... for one in another.
  const closing = data.closingIssuesReferences.nodes[0];
  const branchIssue = pr.head.ref.match(/^triage\/(?:([^/]+)-)?(\d+)\//);
  const issueRef = closing ? { owner: closing.repository.owner.login, repo: closing.repository.name, number: closing.number }
    : branchIssue ? { owner, repo: branchIssue[1] ?? repo, number: Number(branchIssue[2]) }
    : null;
  let issueData: IssueData | null = null;
  if (issueRef) {
    try {
      issueData = (await github.graphql<{ repository: { issue: IssueData | null } }>(`
        query($owner: String!, $repo: String!, $number: Int!) {
          repository(owner: $owner, name: $repo) {
            issue(number: $number) { number url title body author { login } comments(last: 100) { totalCount nodes { ${fields} } } }
          }
        }`, issueRef)).repository.issue;
    } catch (e) {
      // The issue is context for the agent, not a requirement: the comments to address are on the PR.
      core.warning(`Could not read the issue ${issueRef.owner}/${issueRef.repo}#${issueRef.number}: ${(e as Error).message}`);
    }
  }

  const connections: [string, Connection<unknown>][] = [['comments on the PR', data.comments], ['reviews', data.reviews], ['review threads', data.reviewThreads], ...data.reviewThreads.nodes.map((t): [string, Connection<unknown>] => [`comments in a thread on ${t.path}`, t.comments])];
  if (issueData)
    connections.push(['comments on the issue', issueData.comments]);
  for (const [name, connection] of connections) {
    if (connection.totalCount > connection.nodes.length)
      core.warning(`Read only ${connection.nodes.length} of ${connection.totalCount} ${name}`);
  }

  // People with write access are the maintainers. The bot is the app; before the app posted
  // the triage notes, github-actions did, with the marker.
  const maintainers = new Map<string, boolean>();
  const roleOf = async (c: Comment): Promise<Role | undefined> => {
    const author = c.author;
    if (author?.__typename === 'Bot' && author.login.replace(/\[bot\]$/, '') === 'microsoft-playwright-automation')
      return 'bot';
    if (author?.__typename === 'Bot' && author.login === 'github-actions' && c.body.includes('<!-- playwright-ai-triage -->'))
      return 'bot';
    if (author?.__typename !== 'User')
      return undefined;
    if (!maintainers.has(author.login)) {
      const { data } = await github.rest.repos.getCollaboratorPermissionLevel({ owner, repo, username: author.login }).catch(() => ({ data: {} as { permission?: string } }));
      maintainers.set(author.login, ['admin', 'write'].includes(data.permission!));
    }
    return maintainers.get(author.login) ? 'maintainer' : undefined;
  };
  // A comment from a maintainer or from the bot, or undefined for anyone else.
  const entry = async (c: Comment): Promise<Entry | undefined> => {
    const role = await roleOf(c);
    return role && { role, author: role === 'bot' ? 'microsoft-playwright-automation[bot]' : c.author!.login, createdAt: c.createdAt, url: c.url, body: c.body };
  };

  const issue = issueData && {
    number: issueData.number,
    url: issueData.url,
    title: issueData.title,
    author: issueData.author?.login,
    body: issueData.body,
    comments: [] as Entry[],
  };
  for (const c of issueData?.comments.nodes ?? []) {
    const e = await entry(c);
    if (e)
      issue!.comments.push(e);
  }

  const comments: Item[] = [];
  for (const c of data.comments.nodes) {
    const e = await entry(c);
    if (e)
      comments.push({ kind: 'comment', ...e });
  }
  for (const r of data.reviews.nodes) {
    const e = r.body.trim() && await entry(r);
    if (e)
      comments.push({ kind: 'review', state: r.state, ...e });
  }
  for (const t of data.reviewThreads.nodes) {
    if (t.isResolved)
      continue;
    const thread: ({ id: number } & Entry)[] = [];
    for (const c of t.comments.nodes) {
      // The id is what the agent replies to, in a reply call.
      const e = await entry(c);
      if (e)
        thread.push({ id: Number(c.fullDatabaseId), ...e });
    }
    if (thread.some(c => c.role === 'maintainer'))
      comments.push({ kind: 'thread', path: t.path, line: t.line ?? t.originalLine, outdated: t.isOutdated, diffHunk: t.comments.nodes[0].diffHunk, createdAt: thread[0].createdAt, comments: thread });
  }
  comments.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  if (!comments.some(c => c.kind === 'thread' ? c.comments.some(t => t.role === 'maintainer') : c.role === 'maintainer'))
    throw new Error('There are no comments from maintainers to address, other than in resolved threads');

  fs.writeFileSync(path.join(dir, 'review.json'), JSON.stringify({
    issue,
    pullRequest: {
      number: pr.number,
      url: pr.html_url,
      title: pr.title,
      body: pr.body,
      head: pr.head.sha,
      base,
      commits: commits.map(c => ({ sha: c.sha, date: c.commit.committer.date, message: c.commit.message })),
    },
    comments,
  }, null, 2));
  core.setOutput('head', pr.head.sha);
  core.setOutput('base', base);
  core.setOutput('branch', pr.head.ref);
}

module.exports = collect;
