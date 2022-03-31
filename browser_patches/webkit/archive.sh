#!/bin/bash
set -e
set +x

if [[ ("$1" == "-h") || ("$1" == "--help") ]]; then
  echo "usage: $(basename "$0") [output-absolute-path]"
  echo
  echo "Generate distributable .zip archive from ./checkout folder that was previously built."
  echo
  exit 0
fi

ZIP_PATH=$1
if [[ $ZIP_PATH != /* ]]; then
  echo "ERROR: path $ZIP_PATH is not absolute"
  exit 1
fi
if [[ $ZIP_PATH != *.zip ]]; then
  echo "ERROR: path $ZIP_PATH must have .zip extension"
  exit 1
fi
if [[ -f $ZIP_PATH ]]; then
  echo "ERROR: path $ZIP_PATH exists; can't do anything."
  exit 1
fi
if ! [[ -d $(dirname "$ZIP_PATH") ]]; then
  echo "ERROR: folder for path $($ZIP_PATH) does not exist."
  exit 1
fi

main() {
  if [[ ! -z "${WK_CHECKOUT_PATH}" ]]; then
    cd "${WK_CHECKOUT_PATH}"
    echo "WARNING: checkout path from WK_CHECKOUT_PATH env: ${WK_CHECKOUT_PATH}"
  else
    cd "$HOME/webkit"
  fi

  set -x
  if [[ "$(uname)" == "Darwin" ]]; then
    createZipForMac
  elif [[ "$(uname)" == "Linux" ]]; then
    createZipForLinux
  elif [[ "$(uname)" == MINGW* || "$(uname)" == MSYS* ]]; then
    createZipForWindows
  else
    echo "ERROR: cannot upload on this platform!" 1>&2
    exit 1;
  fi
}


createZipForLinux() {
  # create a TMP directory to copy all necessary files
  local tmpdir=$(mktemp -d -t webkit-deploy-XXXXXXXXXX)
  mkdir -p "$tmpdir"

  # copy runner
  cp -t "$tmpdir" "$SCRIPTS_DIR"/pw_run.sh
  # copy protocol
  node "$SCRIPTS_DIR"/concat_protocol.js > "$tmpdir"/protocol.json

  # Generate and unpack MiniBrowser bundles for each port
  for port in gtk wpe; do
    WEBKIT_OUTPUTDIR=$(pwd)/WebKitBuild/${port^^} Tools/Scripts/generate-bundle \
        --bundle=MiniBrowser --release \
        --platform=${port} --destination="${tmpdir}"
     unzip "${tmpdir}"/MiniBrowser_${port}_release.zip -d "${tmpdir}"/minibrowser-${port}
     rm -f "${tmpdir}"/MiniBrowser_${port}_release.zip
  done

  # tar resulting directory and cleanup TMP.
  cd "$tmpdir"
  zip --symlinks -r "$ZIP_PATH" ./
  cd -
  rm -rf "$tmpdir"
}

createZipForWindows() {
  # create a TMP directory to copy all necessary files
  local tmpdir="/tmp/webkit-deploy-$(date +%s)"
  mkdir -p "$tmpdir"

  cp -t "$tmpdir" ./WebKitLibraries/win/bin64/*.dll
  cd WebKitBuild/Release/bin64
  cp -r -t "$tmpdir" WebKit.resources
  cp -t "$tmpdir" JavaScriptCore.dll PlaywrightLib.dll WTF.dll WebKit2.dll libEGL.dll libGLESv2.dll
  cp -t "$tmpdir" Playwright.exe WebKitNetworkProcess.exe WebKitWebProcess.exe
  cd -
  cd "$(printMSVCRedistDir)"
  cp -t "$tmpdir" msvcp140.dll vcruntime140.dll vcruntime140_1.dll msvcp140_2.dll
  cd -

  # copy protocol
  node "$SCRIPTS_DIR"/concat_protocol.js > "$tmpdir"/protocol.json
  # tar resulting directory and cleanup TMP.
  cd "$tmpdir"
  zip -r "$ZIP_PATH" ./
  cd -
  rm -rf "$tmpdir"
}

createZipForMac() {
  # create a TMP directory to copy all necessary files
  local tmpdir=$(mktemp -d)

  # copy all relevant files
  ditto {./WebKitBuild/Release,"$tmpdir"}/com.apple.WebKit.GPU.xpc
  ditto {./WebKitBuild/Release,"$tmpdir"}/com.apple.WebKit.Networking.xpc
  ditto {./WebKitBuild/Release,"$tmpdir"}/com.apple.WebKit.WebContent.xpc
  ditto {./WebKitBuild/Release,"$tmpdir"}/JavaScriptCore.framework
  ditto {./WebKitBuild/Release,"$tmpdir"}/libANGLE-shared.dylib
  ditto {./WebKitBuild/Release,"$tmpdir"}/libwebrtc.dylib
  ditto {./WebKitBuild/Release,"$tmpdir"}/Playwright.app
  ditto {./WebKitBuild/Release,"$tmpdir"}/WebCore.framework
  ditto {./WebKitBuild/Release,"$tmpdir"}/WebInspectorUI.framework
  ditto {./WebKitBuild/Release,"$tmpdir"}/WebKit.framework
  ditto {./WebKitBuild/Release,"$tmpdir"}/WebKitLegacy.framework
  ditto {"$SCRIPTS_DIR","$tmpdir"}/pw_run.sh
  # copy protocol
  node "$SCRIPTS_DIR"/concat_protocol.js > "$tmpdir"/protocol.json

  # Remove all broken symlinks. @see https://github.com/microsoft/playwright/issues/5472
  find "${tmpdir}" -type l ! -exec test -e {} \; -print | xargs rm

  # zip resulting directory and cleanup TMP.
  ditto -c -k "$tmpdir" "$ZIP_PATH"
  rm -rf "$tmpdir"
}

trap "cd $(pwd -P)" EXIT
cd "$(dirname "$0")"
SCRIPTS_DIR="$(pwd -P)"
source "${SCRIPTS_DIR}/../utils.sh"

main "$@"
