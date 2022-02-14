#!/bin/bash
set -e
set +x

function report_results() {
  echo
  if [[ -n "${FAILED_TESTS}" ]]; then
    cecho "RED" "SOME TESTS FAILED! To debug:"
    cecho "RED" "${FAILED_TESTS}"
    exit 1
  else
    cecho "GREEN" "All tests passed!"
    exit 0
  fi
}

trap "report_results; cd $(pwd -P)" EXIT
cd "$(dirname $0)"

source ./initialize_test.sh

setup_env_variables
echo "Building packages..."
build_packages
clean_test_root

function gh_echo {
  if [[ -z "${GITHUB_ACTIONS}" ]]; then
    return
  fi
  echo "$@"
}

FAILED_TESTS=""

TOTAL=$(ls -1 test_*.sh | wc -l | tr -d ' ')
COUNTER=1
for i in test_*.sh
do
  set +e
  cecho "YELLOW" "Running ${COUNTER}/${TOTAL} - $i..."
  COUNTER=$(( COUNTER + 1 ))
  OUTPUT=$(bash $i --multitest --no-build 2>&1)
  RV=$?
  set -e
  if [[ "${RV}" != 0 ]]; then
    FAILED_TESTS="${FAILED_TESTS}- ${i}\n"

    gh_echo "::group::FAILED - $i"
    cecho "RED" "FAILED - $i"
    echo "${OUTPUT}"
    gh_echo "::endgroup::"
  else
    gh_echo "::group::PASSED - $i"
    cecho "GREEN" "PASSED - $i"
    gh_echo "${OUTPUT}"
    gh_echo "::endgroup::"
  fi
done

