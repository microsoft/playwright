#!/bin/bash
set -e
set +x

if [[ ("$1" == "-h") || ("$1" == "--help") ]]; then
  echo "usage: $(basename $0) [ZIP-PATH]"
  echo
  echo "Generate a single .zip archive that contains both gtk and wpe builds"
  echo
  exit 0
fi

if [[ "$(uname)" != "Linux" ]]; then
  echo "ERROR: this script works only on linux"
  echo
  exit 1
fi

ZIP_PATH="$1"
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

trap "cd $(pwd -P)" EXIT
cd "$(dirname "$0")"

# create a TMP directory to copy all necessary files
TMPDIR=$(mktemp -d -t webkit-deploy-XXXXXXXXXX)
GTK_ZIP_PATH=$(mktemp -t -u minibrowser-gtk-XXXXXX.zip)
WPE_ZIP_PATH=$(mktemp -t -u minibrowser-wpe-XXXXXX.zip)
../download.sh webkit-gtk $GTK_ZIP_PATH
../download.sh webkit-wpe $WPE_ZIP_PATH

# Create directory
mkdir -p $TMPDIR

# copy runner
cp -t $TMPDIR ./pw_run.sh

pushd $TMPDIR

# Copy MiniBrowser-GTK
mkdir minibrowser-gtk
pushd minibrowser-gtk
cp $GTK_ZIP_PATH archive.zip
unzip archive.zip
rm archive.zip
popd

# Copy MiniBrowser-WPE
mkdir minibrowser-wpe
pushd minibrowser-wpe
cp $WPE_ZIP_PATH archive.zip
unzip archive.zip
rm archive.zip
popd

mv minibrowser-gtk/protocol.json .
rm minibrowser-wpe/protocol.json

zip --symlinks -r $ZIP_PATH ./
popd

rm -rf $TMPDIR
rm -rf $WPE_ZIP_PATH
rm -rf $GTK_ZIP_PATH
