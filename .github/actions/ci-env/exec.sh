#!/usr/bin/env bash
# Runs the command the way the tests need on this runner: under xvfb on Linux, at normal I/O
# priority on Windows (windows-normal-io.ps1), as it is on macOS.
set -e
case "$(uname -s)" in
  Linux)
    exec xvfb-run --auto-servernum --server-args="-screen 0 1280x960x24" -- "$@";;
  MINGW*|MSYS*|CYGWIN*)
    powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$(dirname "$0")/windows-normal-io.ps1" -ProcessId "$(cat /proc/$$/winpid)"
    exec "$@";;
  *)
    exec "$@";;
esac
