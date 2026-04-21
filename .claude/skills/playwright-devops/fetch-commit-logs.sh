#!/bin/bash
set -euo pipefail

# Usage: fetch-commit-logs.sh [<sha>]
# Fetches CI failure logs for a commit into ~/tmp/commit-<short-sha>/

REPO="microsoft/playwright"
REF="${1:-main}"

# Resolve commit
COMMIT_JSON=$(gh api "repos/$REPO/commits/$REF" --jq '{sha: .sha, message: .commit.message}')
SHA=$(echo "$COMMIT_JSON" | jq -r '.sha')
SHORT_SHA="${SHA:0:7}"
MESSAGE=$(echo "$COMMIT_JSON" | jq -r '.message' | head -1)

OUTDIR="$HOME/tmp/commit-$SHORT_SHA"
mkdir -p "$OUTDIR"

echo "Commit: $SHORT_SHA — $MESSAGE"
echo "Output: $OUTDIR"

# Get all workflow runs for this commit
RUNS_JSON=$(gh api "repos/$REPO/actions/runs?head_sha=$SHA&per_page=50" \
  --jq '[.workflow_runs[] | {id, name, conclusion, workflow_id}]')

# Filter to failed workflows
FAILED_RUNS=$(echo "$RUNS_JSON" | jq -c '[.[] | select(.conclusion == "failure" or .conclusion == null)]')
FAILED_COUNT=$(echo "$FAILED_RUNS" | jq 'length')

if [ "$FAILED_COUNT" -eq 0 ]; then
  echo "No failed workflows."
  echo '{"sha":"'"$SHA"'","short_sha":"'"$SHORT_SHA"'","message":"'"$MESSAGE"'","workflows":[]}' | jq . > "$OUTDIR/summary.json"
  echo "$OUTDIR"
  exit 0
fi

echo "Found $FAILED_COUNT failed workflow(s). Fetching failed jobs..."

# Build summary and collect jobs to fetch
SUMMARY='{"sha":"'"$SHA"'","short_sha":"'"$SHORT_SHA"'","message":'"$(echo "$MESSAGE" | jq -Rs .)"',"workflows":[]}'

sanitize() {
  echo "$1" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9._-]/-/g' | sed 's/--*/-/g' | sed 's/^-//;s/-$//'
}

PIDS=()

for i in $(seq 0 $((FAILED_COUNT - 1))); do
  RUN=$(echo "$FAILED_RUNS" | jq -c ".[$i]")
  RUN_ID=$(echo "$RUN" | jq -r '.id')
  RUN_NAME=$(echo "$RUN" | jq -r '.name')
  WORKFLOW_DIR=$(sanitize "$RUN_NAME")

  # Get failed jobs for this run
  JOBS_JSON=$(gh run view "$RUN_ID" --json jobs \
    --jq '[.jobs[] | select(.conclusion == "failure") | {name: .name, id: .databaseId}]')
  JOB_COUNT=$(echo "$JOBS_JSON" | jq 'length')

  if [ "$JOB_COUNT" -eq 0 ]; then
    continue
  fi

  mkdir -p "$OUTDIR/$WORKFLOW_DIR"

  # Add to summary
  WORKFLOW_ENTRY=$(jq -n \
    --arg name "$RUN_NAME" \
    --argjson id "$RUN_ID" \
    --argjson jobs "$JOBS_JSON" \
    '{name: $name, id: $id, failed_jobs: $jobs}')
  SUMMARY=$(echo "$SUMMARY" | jq --argjson w "$WORKFLOW_ENTRY" '.workflows += [$w]')

  # Fetch logs in parallel
  for j in $(seq 0 $((JOB_COUNT - 1))); do
    JOB=$(echo "$JOBS_JSON" | jq -c ".[$j]")
    JOB_ID=$(echo "$JOB" | jq -r '.id')
    JOB_NAME=$(echo "$JOB" | jq -r '.name')
    JOB_FILE=$(sanitize "$JOB_NAME")
    LOG_PATH="$OUTDIR/$WORKFLOW_DIR/$JOB_FILE.log"

    (
      echo "# $JOB_NAME" > "$LOG_PATH"
      echo "" >> "$LOG_PATH"
      gh run view --job "$JOB_ID" --log-failed 2>&1 | sed 's/\x1b\[[0-9;]*[a-zA-Z]//g' | sed $'s/^[^\t]*\t[^\t]*\t\xef\xbb\xbf\{0,1\}[0-9T:.Z-]* //' >> "$LOG_PATH" || true
      # If only header (e.g. workflow still in progress), fetch via jobs API
      if [ "$(wc -l < "$LOG_PATH")" -le 3 ]; then
        echo "# $JOB_NAME" > "$LOG_PATH"
        echo "" >> "$LOG_PATH"
        gh api "repos/$REPO/actions/jobs/$JOB_ID/logs" 2>&1 | sed 's/\x1b\[[0-9;]*[a-zA-Z]//g' | sed $'s/\xef\xbb\xbf//g' | sed 's/^[0-9T:.Z-]* //' >> "$LOG_PATH" || true
      fi
      echo "  Fetched: $WORKFLOW_DIR/$JOB_FILE.log"
    ) &
    PIDS+=($!)
  done
done

# Wait for all parallel fetches
for pid in "${PIDS[@]}"; do
  wait "$pid" 2>/dev/null || true
done

# Write summary
echo "$SUMMARY" | jq . > "$OUTDIR/summary.json"

echo ""
echo "Done. Logs saved to: $OUTDIR"
echo "$OUTDIR"
