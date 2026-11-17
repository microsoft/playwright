#!/usr/bin/env bash
set -e
set +x

if [[ ($1 == '--help') || ($1 == '-h') || ($1 == '') ]]; then
  echo "usage: $(basename $0) [--list-files] playwright:localbuild-noble"
  echo
  echo "Check that no layer of the docker image contains files that can hold"
  echo "tokens or credentials, such as the npm cache, .npmrc or a .git directory."
  echo
  echo "  --list-files  also print every file that the layers of our Dockerfile add."
  echo "                Layers of the base image are not listed."
  echo
  exit 0
fi

LIST_FILES=""
if [[ "$1" == "--list-files" ]]; then
  LIST_FILES=1
  shift
fi
IMAGE="$1"

# A file that a later layer deletes is still in the layer that created it, and
# everyone who pulls the image can read it there. So the check reads every layer,
# not the file system of the final image.
#
# Each pattern is an extended regex that is matched against the path of a file
# in a layer, for example "root/.npm/_logs/2026-01-01-debug-0.log".
FORBIDDEN=(
  # npm and yarn: the cache index and the debug logs record download URLs,
  # including signed URLs of a private registry.
  '(^|/)\.npm(/|$)'
  '(^|/)_cacache(/|$)'
  '(^|/)_logs/.*-debug-[0-9]+\.log$'
  '(^|/)\.yarn(/|$)'
  '(^|/)\.cache/yarn(/|$)'
  # Registry and package manager credentials.
  '(^|/)\.npmrc$'
  '(^|/)\.yarnrc(\.yml)?$'
  '(^|/)\.pypirc$'
  '(^|/)\.netrc$'
  # Source control.
  '(^|/)\.git(/|$)'
  '(^|/)\.git-credentials$'
  # Cloud, container and ssh credentials.
  '(^|/)\.ssh(/|$)'
  '(^|/)\.aws(/|$)'
  '(^|/)\.azure(/|$)'
  '(^|/)\.kube(/|$)'
  '(^|/)\.docker(/|$)'
  '(^|/)\.config/gcloud(/|$)'
  # Local environment files.
  '(^|/)\.env(\.[^/]*)?$'
)

# Files that match a pattern above, but are a part of a package and hold no secret.
ALLOWED=(
  # The npm package has its own .npmrc with settings for npm development.
  '(^|/)node_modules/npm/\.npmrc$'
)

join_patterns() {
  local IFS='|'
  echo "$*"
}
FORBIDDEN_RE="$(join_patterns "${FORBIDDEN[@]}")"
ALLOWED_RE="$(join_patterns "${ALLOWED[@]}")"

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "${TMP_DIR}"' EXIT

echo "Checking the layers of ${IMAGE} for files that can hold credentials..."
docker save "${IMAGE}" | tar -x -C "${TMP_DIR}"

# Print one line for each layer, bottom layer first: "<ours>\t<file>\t<step>".
# - <ours> is 1 when a step of our Dockerfile made the layer, 0 for the base image.
#   BuildKit marks the steps that it runs in the image history.
# - <step> is the Dockerfile step, without the build arguments that BuildKit
#   puts in front of a RUN command.
node -e '
  const fs = require("fs");
  const path = require("path");
  const dir = process.argv[1];
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, "manifest.json"), "utf8"))[0];
  const config = JSON.parse(fs.readFileSync(path.join(dir, manifest.Config), "utf8"));
  const steps = (config.history || []).filter(h => !h.empty_layer);
  manifest.Layers.forEach((layer, i) => {
    const step = steps[i] || {};
    const ours = (step.comment || "").includes("buildkit.dockerfile") ? 1 : 0;
    const command = (step.created_by || "?").replace(/^RUN \|\d+ .*? \/bin\/sh -c /, "RUN ").replace(/\s+/g, " ");
    console.log([ours, layer, command.length > 100 ? command.slice(0, 100) + "..." : command].join("\t"));
  });
' "${TMP_DIR}" > "${TMP_DIR}/layers.tsv"

LAYER_COUNT=0
FAILED=0
while IFS=$'\t' read -r OURS LAYER STEP; do
  LAYER_COUNT=$((LAYER_COUNT + 1))
  # Paths in a layer can start with "./". Skip directory entries: an empty
  # directory, such as the ~/.ssh that a package creates, holds no secret.
  tar -tf "${TMP_DIR}/${LAYER}" > "${TMP_DIR}/entries.txt"
  sed 's|^\./||' "${TMP_DIR}/entries.txt" | grep -v '/$' > "${TMP_DIR}/files.txt" || true

  if [[ -n "${LIST_FILES}" && "${OURS}" == "1" ]]; then
    echo
    echo "=== layer ${LAYER_COUNT}: ${STEP}"
    echo "=== $(wc -l < "${TMP_DIR}/files.txt" | tr -d ' ') file(s). A \".wh.\" name marks a file that the layer deletes."
    cat "${TMP_DIR}/files.txt"
  fi

  MATCHES="$(grep -E "${FORBIDDEN_RE}" "${TMP_DIR}/files.txt" | grep -v -E "${ALLOWED_RE}" || true)"
  if [[ -n "${MATCHES}" ]]; then
    FAILED=1
    echo
    echo "ERROR: layer ${LAYER_COUNT} contains $(echo "${MATCHES}" | wc -l | tr -d ' ') forbidden file(s)."
    echo "  step: ${STEP}"
    echo "${MATCHES}" | head -20 | sed 's/^/  /'
  fi
done < "${TMP_DIR}/layers.tsv"

if (( LAYER_COUNT == 0 )); then
  echo "ERROR: found no layers in ${IMAGE}" >&2
  exit 1
fi

if (( FAILED )); then
  echo
  echo "These files stay in the image even when a later layer deletes them." >&2
  echo "Do not create them, or delete them in the RUN step that creates them." >&2
  exit 1
fi
echo
echo "Checked ${LAYER_COUNT} layer(s), found no forbidden files."
