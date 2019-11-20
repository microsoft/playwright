#!/bin/bash

if [[ ("$1" == "-h") || ("$1" == "--help") ]]; then
  echo "usage: $0"
  echo
  echo "Generate distributable .zip archive from ./checkout folder that was previously built."
  echo
  exit 0
fi

set -e
set -x

main() {
  cd checkout

  if [[ "$(uname)" == "Darwin" ]]; then
    createZipForMac
  elif [[ "$(uname)" == "Linux" ]]; then
    createZipForLinux
  else
    echo "ERROR: cannot upload on this platform!" 1>&2
    exit 1;
  fi
}

createZipForLinux() {
  # create a TMP directory to copy all necessary files
  local tmpdir=$(mktemp -d -t webkit-deploy-XXXXXXXXXX)
  mkdir -p $tmpdir

  # copy all relevant binaries
  cp -t $tmpdir ./WebKitBuild/Release/bin/MiniBrowser ./WebKitBuild/Release/bin/WebKit*Process
  # copy runner
  cp -t $tmpdir ../pw_run.sh
  # copy protocol
  node ../concat_protocol.js > $tmpdir/protocol.json
  # copy all relevant shared objects
  LD_LIBRARY_PATH="$PWD/WebKitBuild/DependenciesGTK/Root/lib" ldd WebKitBuild/Release/bin/MiniBrowser | grep -o '[^ ]*WebKitBuild/[^ ]*' | xargs cp -t $tmpdir

  # we failed to nicely build libgdk_pixbuf - expect it in the env
  rm $tmpdir/libgdk_pixbuf*

  # tar resulting directory and cleanup TMP.
  local zipname="minibrowser-linux.zip"
  zip -jr ../$zipname $tmpdir
  rm -rf $tmpdir
}

createZipForMac() {
  # create a TMP directory to copy all necessary files
  local tmpdir=$(mktemp -d)

  # copy all relevant files
  ditto {./WebKitBuild/Release,$tmpdir}/com.apple.WebKit.Networking.xpc
  ditto {./WebKitBuild/Release,$tmpdir}/com.apple.WebKit.Plugin.64.xpc
  ditto {./WebKitBuild/Release,$tmpdir}/com.apple.WebKit.WebContent.xpc
  ditto {./WebKitBuild/Release,$tmpdir}/JavaScriptCore.framework
  ditto {./WebKitBuild/Release,$tmpdir}/libwebrtc.dylib
  ditto {./WebKitBuild/Release,$tmpdir}/MiniBrowser.app
  ditto {./WebKitBuild/Release,$tmpdir}/PluginProcessShim.dylib
  ditto {./WebKitBuild/Release,$tmpdir}/SecItemShim.dylib
  ditto {./WebKitBuild/Release,$tmpdir}/WebCore.framework
  ditto {./WebKitBuild/Release,$tmpdir}/WebInspectorUI.framework
  ditto {./WebKitBuild/Release,$tmpdir}/WebKit.framework
  ditto {./WebKitBuild/Release,$tmpdir}/WebKitLegacy.framework
  ditto {..,$tmpdir}/pw_run.sh
  # copy protocol
  node ../concat_protocol.js > $tmpdir/protocol.json

  # zip resulting directory and cleanup TMP.
  local MAC_MAJOR_MINOR_VERSION=$(sw_vers -productVersion | grep -o '^\d\+.\d\+')
  local zipname="minibrowser-mac-$MAC_MAJOR_MINOR_VERSION.zip"
  ditto -c -k $tmpdir ../$zipname
  rm -rf $tmpdir
}

trap "cd $(pwd -P)" EXIT
cd "$(dirname "$0")"

main "$@"
