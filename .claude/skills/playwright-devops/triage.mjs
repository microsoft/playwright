/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// Agent-friendly Playwright triage CLI.
//
// Lists open issues (microsoft/playwright, no label) and PRs across the
// Playwright repos, sorted by "needs attention" / "stale". Defaults to
// JSON on stdout. Pass --web to render a self-contained HTML page in a
// tmp dir and open it in a browser.
//
// Auths via `gh api graphql` — install gh and `gh auth login` once.

import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const MAINTAINERS = new Set([
  'dgozman',
  'yury-s',
  'pavelfeldman',
  'Skn0tt',
]);

const BOTS = new Set([
  'github-actions',
  'copilot-pull-request-reviewer',
  'copilot-swe-agent',
]);

const QUERY = `
fragment IssueParts on Issue {
    __typename
    title
    titleHTML
    url
    createdAt
    author { login }
    assignees(first: 10) { nodes { login } }
    comments(last: 100) {
        nodes {
            createdAt
            author { login }
        }
    }
}
fragment PullRequestParts on PullRequest {
    __typename
    title
    titleHTML
    url
    createdAt
    author { login }
    assignees(first: 10) { nodes { login } }
    comments(last: 100) {
        nodes {
            createdAt
            author { login }
        }
    }
    reviews(last: 100) {
        nodes {
            createdAt
            author { login }
        }
    }
}

query {
    issues: search(query: "repo:microsoft/playwright state:open no:label is:issue", type: ISSUE_ADVANCED, first: 100) {
        nodes { ... on Issue { ...IssueParts } }
    }
    pullRequests: search(query: "(repo:microsoft/playwright OR repo:microsoft/playwright.dev OR repo:microsoft/playwright-vscode OR repo:microsoft/playwright-browsers OR repo:microsoft/playwright-cli) state:open is:pr -is:draft", type: ISSUE_ADVANCED, first: 100) {
        nodes { ... on PullRequest { ...PullRequestParts } }
    }
}
`;

// --- Tiny date helpers (replaces date-fns for this script) ---

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function businessDaysSince(date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (start >= today) return 0;
  let count = 0;
  for (const d = new Date(start); d < today; d.setDate(d.getDate() + 1)) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) count++;
  }
  return count;
}

function formatRelative(date) {
  const diffMs = Date.now() - new Date(date).getTime();
  const sec = Math.round(diffMs / 1000);
  const min = Math.round(sec / 60);
  const hr = Math.round(min / 60);
  const day = Math.round(hr / 24);
  const month = Math.round(day / 30);
  const year = Math.round(day / 365);
  if (sec < 60) return `${sec} seconds ago`;
  if (min < 60) return `${min} minute${min === 1 ? '' : 's'} ago`;
  if (hr < 24) return `${hr} hour${hr === 1 ? '' : 's'} ago`;
  if (day < 30) return `${day} day${day === 1 ? '' : 's'} ago`;
  if (month < 12) return `${month} month${month === 1 ? '' : 's'} ago`;
  return `${year} year${year === 1 ? '' : 's'} ago`;
}

// --- Arg parsing ---

function parseArgs(argv) {
  const opts = {
    web: false,
    onlyAttention: false,
    onlyStale: false,
    issuesOnly: false,
    prsOnly: false,
    help: false,
  };
  for (const arg of argv) {
    switch (arg) {
      case '--web': opts.web = true; break;
      case '--only-attention': opts.onlyAttention = true; break;
      case '--only-stale': opts.onlyStale = true; break;
      case '--issues-only': opts.issuesOnly = true; break;
      case '--prs-only': opts.prsOnly = true; break;
      case '-h':
      case '--help': opts.help = true; break;
      default:
        console.error(`Unknown argument: ${arg}`);
        opts.help = true;
        break;
    }
  }
  return opts;
}

function printHelp() {
  console.log(`Usage: node .claude/skills/playwright-devops/triage.mjs [options]

Agent-friendly Playwright triage list. Fetches open issues and PRs across the
Playwright repos and emits JSON, sorted so things needing attention come first.

Authenticates via the 'gh' CLI (must be installed and 'gh auth login'-ed).

Options:
  --web              Render a self-contained HTML file in a tmp dir and open it
                     (instead of emitting JSON)
  --only-attention   Only show tickets where the last comment is from a non-maintainer
  --only-stale       Only show tickets idle for more than 3 business days
  --issues-only      Only show issues (skip pull requests)
  --prs-only         Only show pull requests (skip issues)
  -h, --help         Show this help

Examples:
  node .claude/skills/playwright-devops/triage.mjs | jq '.issues[] | select(.requiresAttention)'
  node .claude/skills/playwright-devops/triage.mjs --only-attention --prs-only
  node .claude/skills/playwright-devops/triage.mjs --web`);
}

// --- gh subprocess ---

function ghGraphQL(query) {
  return new Promise((resolve, reject) => {
    const child = spawn('gh', ['api', 'graphql', '-f', `query=${query}`], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', d => (stdout += d));
    child.stderr.on('data', d => (stderr += d));
    child.on('error', err => {
      if (err.code === 'ENOENT')
        reject(new Error("The 'gh' CLI is not installed or not on PATH. Install from https://cli.github.com/"));
      else
        reject(err);
    });
    child.on('close', code => {
      if (code !== 0) {
        reject(new Error(`gh api graphql exited with code ${code}.\n${stderr.trim() || '(no stderr)'}\nIf this is an auth error, run: gh auth login`));
        return;
      }
      try {
        const parsed = JSON.parse(stdout);
        if (parsed.errors)
          reject(new Error(`GraphQL errors:\n${JSON.stringify(parsed.errors, null, 2)}`));
        else
          resolve(parsed.data);
      } catch (e) {
        reject(new Error(`Failed to parse gh output as JSON: ${e.message}`));
      }
    });
  });
}

// --- Triage logic ---

function toTicket(issue) {
  const rawComments = [
    issue,
    ...(issue.comments?.nodes ?? []),
    ...(issue.__typename === 'PullRequest' ? issue.reviews?.nodes ?? [] : []),
  ];
  const comments = rawComments
      .map(c => ({ author: c.author?.login, createdAt: c.createdAt }))
      .filter(c => c.author && !BOTS.has(c.author))
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  return {
    url: issue.url,
    title: issue.title,
    titleHTML: issue.titleHTML,
    createdAt: issue.createdAt,
    author: issue.author?.login ?? null,
    assignees: issue.assignees?.nodes?.map(a => a?.login).filter(Boolean) ?? [],
    comments,
  };
}

function lastComment(ticket) {
  return ticket.comments[ticket.comments.length - 1];
}

function requiresAttention(ticket) {
  const last = lastComment(ticket);
  if (!last) return false;
  return !MAINTAINERS.has(last.author);
}

function isStale(ticket) {
  const last = lastComment(ticket);
  if (!last) return false;
  return businessDaysSince(last.createdAt) > 3;
}

function score(ticket) {
  return (requiresAttention(ticket) ? 2 : 0) + (isStale(ticket) ? 1 : 0);
}

function applyFilters(tickets, opts) {
  return tickets.filter(t => {
    if (opts.onlyAttention && !requiresAttention(t)) return false;
    if (opts.onlyStale && !isStale(t)) return false;
    return true;
  });
}

function toJsonTicket(ticket) {
  const last = lastComment(ticket);
  return {
    url: ticket.url,
    title: ticket.title,
    createdAt: ticket.createdAt,
    author: ticket.author,
    assignees: ticket.assignees,
    commentCount: ticket.comments.length,
    lastComment: last ? { author: last.author, at: last.createdAt } : null,
    requiresAttention: requiresAttention(ticket),
    isStale: isStale(ticket),
  };
}

// --- HTML / --web mode ---

function escapeHtml(s) {
  return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
}

function renderHtmlSection(title, tickets) {
  if (tickets.length === 0)
    return `<h2>${escapeHtml(title)}</h2><div><em>(none)</em></div>`;

  const items = tickets.map(t => {
    const needsAttn = requiresAttention(t);
    const stale = isStale(t);

    const assigneesHtml = t.assignees.length === 0 ? '' : `<span class="item-assignees">Assigned to: ${t.assignees
        .map(a => `<a href="https://github.com/${escapeHtml(a)}">@${escapeHtml(a)}</a>`)
        .join(' ')}</span>`;

    const commentsHtml = t.comments.map((c, i) => {
      const isLast = i === t.comments.length - 1;
      let color = MAINTAINERS.has(c.author) ? 'green' : 'inherit';
      if (isLast) {
        if (needsAttn) color = 'red';
        else if (stale) color = 'brown';
      }
      return `<div style="color: ${color};"><span class="item-comment-user">${escapeHtml(c.author)}</span><span>${escapeHtml(formatRelative(c.createdAt))}</span></div>`;
    }).join('\n');

    return `<div class="item">
  <div>
    <a href="${escapeHtml(t.url)}">${escapeHtml(t.url)}</a>
    ${assigneesHtml}
  </div>
  <div class="item-title">${t.titleHTML ?? escapeHtml(t.title)}</div>
  <div>${commentsHtml}</div>
</div>`;
  }).join('\n');

  return `<h2>${escapeHtml(title)}</h2>\n${items}`;
}

function renderHtmlDocument(issues, prs, opts) {
  const sections = [];
  if (!opts.prsOnly) sections.push(renderHtmlSection('ISSUES', issues));
  if (!opts.issuesOnly) sections.push(renderHtmlSection('PULL REQUESTS', prs));
  const generatedAt = new Date().toISOString();
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Playwright Triage</title>
<style>
  body { font-family: system-ui, "Ubuntu", "Droid Sans", sans-serif; color: #222; }
  h2 { font-size: 1em; font-weight: normal; margin: 0 0 20px 0; padding: 10px; background: black; color: #ccc; }
  h2:not(:first-of-type) { margin-top: 20px; }
  footer { margin: 24px 0; color: #888; font-size: 0.85em; }
  .item { margin-top: 20px; }
  .item-title { font-weight: bold; margin: 4px 0; }
  .item-comment-user { margin-right: 10px; min-width: 150px; display: inline-block; }
  .item-assignees { margin-left: 10px; font-size: 0.9em; }
  .item-assignees a { text-decoration: none; }
</style>
</head>
<body>
${sections.join('\n')}
<footer><hr/>Generated by .claude/skills/playwright-devops/triage.mjs at ${escapeHtml(generatedAt)}</footer>
</body>
</html>
`;
}

async function openInBrowser(issues, prs, opts) {
  const html = renderHtmlDocument(issues, prs, opts);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const path = join(tmpdir(), `playwright-triage-${stamp}.html`);
  writeFileSync(path, html, 'utf8');
  console.error(`triage: wrote ${path}`);
  const { default: open } = await import('open');
  await open(path);
}

// --- Main ---

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    printHelp();
    return;
  }

  const data = await ghGraphQL(QUERY);
  const compare = (a, b) => score(b) - score(a);

  let issues = (data.issues?.nodes ?? []).map(toTicket).sort(compare);
  let prs = (data.pullRequests?.nodes ?? []).map(toTicket).sort(compare);

  issues = applyFilters(issues, opts);
  prs = applyFilters(prs, opts);

  if (opts.issuesOnly) prs = [];
  if (opts.prsOnly) issues = [];

  if (opts.web) {
    await openInBrowser(issues, prs, opts);
    return;
  }

  process.stdout.write(JSON.stringify(
      { issues: issues.map(toJsonTicket), pullRequests: prs.map(toJsonTicket) },
      null,
      2,
  ) + '\n');
}

main().catch(err => {
  console.error(`triage: ${err.message}`);
  process.exit(1);
});
