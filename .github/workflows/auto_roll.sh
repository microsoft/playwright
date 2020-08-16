#!/bin/bash

set -ex

browser_name="$1"
playwright_dir="$(pwd)"

function set_github_action_output_parameter {
    echo "::set-output name=$1::$2"
}

git config --global user.email "devops@playwright.dev"
git config --global user.name "playwright-devops"

# Ensure the compiled browser will be used
rm -rf ~/.cache/ms-playwright/

set_github_action_output_parameter "FFPATH" "$(pwd)/browser_patches/firefox/checkout/obj-build-playwright/dist/bin/firefox"
set_github_action_output_parameter "WKPATH" "$(pwd)/browser_patches/webkit/pw_run.sh"

if [[ "${browser_name}" == "webkit" ]]; then
    sudo apt install -y libharfbuzz-dev libepoxy-dev libgcrypt-dev libsoup2.4-dev libwebp-dev flatpak
elif [[ "${browser_name}" == "firefox" ]]; then
    sudo apt install -y autoconf2.13 libclang-dev clang
fi

./browser_patches/prepare_checkout.sh "$browser_name"

if [[ "${browser_name}" == "webkit" ]]; then
    ./browser_patches/webkit/checkout/Tools/gtk/install-dependencies
    ./browser_patches/webkit/checkout/Tools/wpe/install-dependencies

    ./browser_patches/webkit/checkout/Tools/Scripts/update-webkitwpe-libs
    ./browser_patches/webkit/checkout/Tools/Scripts/update-webkitgtk-libs
elif [[ "${browser_name}" == "firefox" ]]; then
    cd browser_patches/firefox/checkout
    SHELL=/bin/bash ./mach bootstrap --no-interactive --application-choice="Firefox for Desktop"
    cd -
fi

if [[ "${browser_name}" == "webkit" ]]; then
  cd ./browser_patches/webkit/checkout
  # Rebase WebKit atop of master branch.
  git rebase browser_upstream/master
  cd -
elif [[ "${browser_name}" == "firefox" ]]; then
  cd ./browser_patches/firefox/checkout
  # We keep firefox atop of beta branch since it's much more stable.
  git rebase browser_upstream/beta
  cd -
fi

echo "Building $browser_name"
SHELL=/bin/bash "./browser_patches/$browser_name/build.sh"

./browser_patches/export.sh "${browser_name}"

git commit -am "feat($browser_name): roll $browser_name"
