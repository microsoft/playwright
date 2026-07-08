---
name: playwright-test-results
description: Query Playwright CI test results from the aggregated DuckDB database. Answers questions about flaky tests, failure rates, slow tests, and per-run/SHA/PR results without hunting through GitHub artifacts.
user_invocable: true
---

# Playwright Test Results (DuckDB)

A single DuckDB file holds recent Playwright CI test results, so you can answer
questions about failures, flakiness, and slow tests with plain SQL. It is
refreshed every few hours.

## Get the database

Download the latest snapshot:

```bash
npm ci                       # first time only, from the repo root
GITHUB_TOKEN=$(gh auth token) node utils/test-results-db/cli.ts download
```

The snapshot may be missing the newest runs. To top it up locally, run `update`:

```bash
GITHUB_TOKEN=$(gh auth token) node utils/test-results-db/cli.ts update --lookback-days 3
```

Query it through the bundled `@duckdb/node-api` binding — no separate DuckDB
install needed, it ships in `node_modules` after `npm ci`:

```bash
node --input-type=module -e '
import { DuckDBInstance } from "@duckdb/node-api";
const conn = await (await DuckDBInstance.create("utils/test-results-db/test-results.duckdb")).connect();
console.table((await conn.runAndReadAll(process.argv[1])).getRowObjectsJson());
' "SELECT count(*) FROM test_results"
```

Integer columns come back as strings (JSON-safe), so do ranking and filtering
in SQL, not in JS.

## Schema

Single table `test_results`, one row per test result (**one row per retry**).
The columns are inferred from the parquet the reporter emits
(`tests/config/parquetReporter.ts`), plus two trailing columns this CLI adds:

| Column | Meaning |
| --- | --- |
| `run_id`, `run_attempt` | GitHub Actions run identity |
| `run_started_at` | when the run started |
| `workflow_name` | e.g. `tests 1` / `tests 2` / `tests others` / `MCP` |
| `event` | `push` / `pull_request` |
| `head_sha`, `head_branch`, `pr_number` | what was tested |
| `bot_name` | e.g. `chromium-ubuntu-22.04-node20`, `webkit-macos-15-large` — the CI bot. **OS and arch are encoded here**; there is no separate os column. |
| `project_name` | CI project = browser + suite, e.g. `chromium-page`, `webkit-library`, `playwright-test` |
| `test_title` | title path within the file, joined by ` › ` (`describe › test`) |
| `file`, `line`, `column_number` | source location (file is relative to repo root) |
| `expected_status` | `passed` / `skipped` / ... |
| `status` | actual result: `passed` / `failed` / `timedOut` / `skipped` / `interrupted` |
| `retry` | 0 = first attempt |
| `result_started_at` | when this attempt started |
| `duration_ms` | result duration |
| `error_message` | all errors joined, ANSI-stripped (NULL when none) |
| `tags` | **list** of strings, e.g. `['@slow', '@flaky']` (use list functions / `list_contains`) |
| `annotations` | list of `{type, description}` structs, e.g. `[{'type': 'skip', 'description': 'flaky on CI'}]` (empty list when none) |
| `artifact_id` | the GitHub artifact this row came from (dedupe key) |
| `ingested_at` | debug only — when this row was imported |

Notes:
- **A test is identified by `(project_name, file, test_title)`** — group on that
  tuple. (Playwright's `test_id` hash is deliberately not stored; those three
  columns are its pre-image.)
- **Flakiness is derived**, not stored. The signal that matters most is
  **cross-run**: a test whose *final* verdict (after retries) flips between
  runs — green in some, red in others. A separate **within-run** flake is a
  test a retry rescued inside a single run (`failed`→`passed`).
- **Real failures vs intentional ones:** filter `expected_status = 'passed'`.
  Tests marked `test.fail()` record `status='failed'` *with*
  `expected_status='failed'` and would otherwise dominate any "most failing" list.
- The db is size-capped by **run count**: the oldest whole runs are evicted over
  time, so it holds a recent window, not full history.

## Example queries

Group tests by `(project_name, file, test_title)` and (for failure/flakiness)
scope to `expected_status = 'passed'` so intentional `test.fail()` tests don't
skew the results.

**Flaky across runs** — the test's final verdict flips between runs (this is
what makes a red CI run ambiguous). `least(failed_runs, passed_runs)` ranks
genuinely bimodal tests above both always-broken and one-off failures:

```sql
WITH per_run AS (
  SELECT project_name, file, test_title, run_id, run_attempt,
         arg_max(status, retry) AS final_status,
         any_value(expected_status) AS expected
  FROM test_results
  GROUP BY project_name, file, test_title, run_id, run_attempt)
SELECT project_name, test_title,
       count(*) AS runs,
       count(*) FILTER (WHERE final_status IN ('failed','timedOut')) AS failed_runs,
       count(*) FILTER (WHERE final_status = 'passed') AS passed_runs,
       round(100.0 * count(*) FILTER (WHERE final_status IN ('failed','timedOut'))
             / count(*), 1) AS fail_pct
FROM per_run
WHERE expected = 'passed'
GROUP BY project_name, test_title
HAVING failed_runs > 0 AND passed_runs > 0 AND runs >= 10
ORDER BY least(failed_runs, passed_runs) DESC, failed_runs DESC
LIMIT 20;
```

**Filter by tag** (`tags` is a list, not a string):

```sql
SELECT project_name, test_title, count(*) AS runs
FROM test_results
WHERE list_contains(tags, '@slow')
GROUP BY project_name, test_title
ORDER BY runs DESC
LIMIT 20;
```

## Fetching the full detail

The db stores per-result summaries. For the full step tree / attachments / stdio,
fetch the original blob report for that run, if the run uploaded one. A row
identifies it by `run_id` + `bot_name`: the run's blob artifact is named
`blob-report-<bot_name>`.

```bash
# List the run's blob artifacts and find the one for this bot_name:
gh api /repos/microsoft/playwright/actions/runs/<run_id>/artifacts \
  --jq '.artifacts[] | select(.name | startswith("blob-report")) | {id, name}'

# Download it (name == "blob-report-<bot_name>"):
gh api /repos/microsoft/playwright/actions/artifacts/<artifact_id>/zip > blob.zip
```

Blob and parquet artifacts have a 7-day retention, so this works only for recent
runs; the db itself retains summaries longer (until run-count eviction).
