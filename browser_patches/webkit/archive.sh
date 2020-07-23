#!/bin/bash
set -e
set +x

if [[ ("$1" == "-h") || ("$1" == "--help") ]]; then
  echo "usage: $(basename $0) [output-absolute-path]"
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
if ! [[ -d $(dirname $ZIP_PATH) ]]; then
  echo "ERROR: folder for path $($ZIP_PATH) does not exist."
  exit 1
fi

main() {
  cd checkout

  set -x
  if [[ "$(uname)" == "Darwin" ]]; then
    createZipForMac
  elif [[ "$(uname)" == "Linux" ]]; then
    createZipForLinux
  elif [[ "$(uname)" == MINGW* ]]; then
    createZipForWindows
  else
    echo "ERROR: cannot upload on this platform!" 1>&2
    exit 1;
  fi
}

copyLibrariesForWPE() {
  # Expect target directory to be passed in as first argument.
  local tmpdir=$1

  # copy runner
  cp -t $tmpdir $SCRIPTS_DIR/pw_run.sh

  # copy all relevant binaries
  cp -t $tmpdir ./WebKitBuild/WPE/Release/bin/MiniBrowser ./WebKitBuild/WPE/Release/bin/WPE*Process
  # copy all relevant shared objects
  # - exclude gstreamer plugins
  LD_LIBRARY_PATH="$PWD/WebKitBuild/WPE/DependenciesWPE/Root/lib" ldd WebKitBuild/WPE/Release/bin/MiniBrowser \
      | grep -o '[^ ]*WebKitBuild/WPE/[^ ]*' \
      | grep -v '/libgst.*so' \
      | xargs cp -t $tmpdir
  LD_LIBRARY_PATH="$PWD/WebKitBuild/WPE/DependenciesWPE/Root/lib" ldd WebKitBuild/WPE/Release/bin/WPENetworkProcess \
      | grep -o '[^ ]*WebKitBuild/WPE/[^ ]*' \
      | grep -v '/libgst.*so' \
      | xargs cp -t $tmpdir
  LD_LIBRARY_PATH="$PWD/WebKitBuild/WPE/DependenciesWPE/Root/lib" ldd WebKitBuild/WPE/Release/bin/WPEWebProcess \
      | grep -o '[^ ]*WebKitBuild/WPE/[^ ]*' \
      | grep -v '/libgst.*so' \
      | xargs cp -t $tmpdir
  # Copy some wayland libraries required for Web Process
  if ls WebKitBuild/WPE/DependenciesWPE/Root/lib/libva\-* 2>&1 >/dev/null; then
    cp -d -t $tmpdir WebKitBuild/WPE/DependenciesWPE/Root/lib/libva\-*
  fi
  # Injected bundle is loaded dynamicly via dlopen => not bt listed by ldd.
  cp -t $tmpdir WebKitBuild/WPE/Release/lib/libWPEInjectedBundle.so
  if test -d $PWD/WebKitBuild/WPE/DependenciesWPE/Root/lib/gio/modules/; then
    mkdir -p $tmpdir/gio/modules
    cp -t $tmpdir/gio/modules $PWD/WebKitBuild/WPE/DependenciesWPE/Root/lib/gio/modules/*
  fi

  cd $tmpdir
  ln -s libWPEBackend-fdo-1.0.so.1 libWPEBackend-fdo-1.0.so
  cd -

  # Strip copied binaries.
  cd $tmpdir
  strip --strip-unneeded * || true
  cd -
}

copyLibrariesForGTK() {
  # Expect target directory to be passed in as first argument.
  local tmpdir=$1

  # copy runner
  cp -t $tmpdir $SCRIPTS_DIR/pw_run.sh

  # copy all relevant binaries
  cp -t $tmpdir ./WebKitBuild/GTK/Release/bin/MiniBrowser ./WebKitBuild/GTK/Release/bin/WebKit*Process
  # copy all relevant shared objects
  # - exclude gstreamer plugins
  # - exclude libdrm
  LD_LIBRARY_PATH="$PWD/WebKitBuild/GTK/DependenciesGTK/Root/lib" ldd WebKitBuild/GTK/Release/bin/MiniBrowser \
      | grep -o '[^ ]*WebKitBuild/GTK/[^ ]*' \
      | grep -v '/libgst.*so' \
      | grep -v '/libdrm.so' \
      | xargs cp -t $tmpdir

  # Injected bundle is loaded dynamicly via dlopen => not bt listed by ldd.
  cp -t $tmpdir WebKitBuild/GTK/Release/lib/libwebkit2gtkinjectedbundle.so
  if test -d $PWD/WebKitBuild/GTK/DependenciesGTK/Root/lib/gio/modules; then
    mkdir -p $tmpdir/gio/modules
    cp -t $tmpdir/gio/modules $PWD/WebKitBuild/GTK/DependenciesGTK/Root/lib/gio/modules/*
  fi

  # we failed to nicely build libgdk_pixbuf - expect it in the env
  rm -f $tmpdir/libgdk_pixbuf*

  # tar resulting directory and cleanup TMP.
  cd $tmpdir
  strip --strip-unneeded * || true
  cd -
}

createZipForLinux() {
  # create a TMP directory to copy all necessary files
  local tmpdir=$(mktemp -d -t webkit-deploy-XXXXXXXXXX)
  mkdir -p $tmpdir
  mkdir -p $tmpdir/minibrowser-gtk
  mkdir -p $tmpdir/minibrowser-wpe

  # copy runner
  cp -t $tmpdir $SCRIPTS_DIR/pw_run.sh
  # copy protocol
  node $SCRIPTS_DIR/concat_protocol.js > $tmpdir/protocol.json

  copyLibrariesForWPE $tmpdir/minibrowser-wpe
  copyLibrariesForGTK $tmpdir/minibrowser-gtk

  # tar resulting directory and cleanup TMP.
  cd $tmpdir
  zip --symlinks -r $ZIP_PATH ./
  cd -
  rm -rf $tmpdir
}

createZipForWindows() {
  # create a TMP directory to copy all necessary files
  local tmpdir="/tmp/webkit-deploy-$(date +%s)"
  mkdir -p $tmpdir

  cp -t $tmpdir ./WebKitLibraries/win/bin64/*.dll
  cd WebKitBuild/Release/bin64
  cp -r -t $tmpdir WebKit.resources
  cp -t $tmpdir JavaScriptCore.dll PlaywrightLib.dll WTF.dll WebKit2.dll libEGL.dll libGLESv2.dll
  cp -t $tmpdir Playwright.exe WebKitNetworkProcess.exe WebKitWebProcess.exe
  cd -
  cd /c/WEBKIT_WIN64_LIBS
  cp -t $tmpdir msvcp140.dll vcruntime140.dll vcruntime140_1.dll msvcp140_2.dll
  cd -

  # copy protocol
  node $SCRIPTS_DIR/concat_protocol.js > $tmpdir/protocol.json
  # tar resulting directory and cleanup TMP.
  cd $tmpdir
  zip -r $ZIP_PATH ./
  cd -
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
  ditto {./WebKitBuild/Release,$tmpdir}/Playwright.app
  ditto {./WebKitBuild/Release,$tmpdir}/PluginProcessShim.dylib
  ditto {./WebKitBuild/Release,$tmpdir}/SecItemShim.dylib
  ditto {./WebKitBuild/Release,$tmpdir}/WebCore.framework
  ditto {./WebKitBuild/Release,$tmpdir}/WebInspectorUI.framework
  ditto {./WebKitBuild/Release,$tmpdir}/WebKit.framework
  ditto {./WebKitBuild/Release,$tmpdir}/WebKitLegacy.framework
  ditto {$SCRIPTS_DIR,$tmpdir}/pw_run.sh
  # copy protocol
  node $SCRIPTS_DIR/concat_protocol.js > $tmpdir/protocol.json

  # zip resulting directory and cleanup TMP.
  ditto -c -k $tmpdir $ZIP_PATH
  rm -rf $tmpdir
}

trap "cd $(pwd -P)" EXIT
cd "$(dirname "$0")"
SCRIPTS_DIR="$(pwd -P)"

main "$@"
