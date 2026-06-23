#!/usr/bin/env bash
set -e
set -x

if [[ $(arch) == "aarch64" ]]; then
  echo "ERROR: not supported on Linux Arm64"
  exit 1
fi

# Default to the Debian/Ubuntu (apt) installation path. When the host platform is
# overridden we keep this default to preserve the previous behaviour.
PKG_MANAGER="apt"

if [ -z "$PLAYWRIGHT_HOST_PLATFORM_OVERRIDE" ]; then
  if [[ ! -f "/etc/os-release" ]]; then
    echo "ERROR: cannot install on unknown linux distribution (/etc/os-release is missing)"
    exit 1
  fi

  ID=$(bash -c 'source /etc/os-release && echo $ID')
  ID_LIKE=$(bash -c 'source /etc/os-release && echo $ID_LIKE')
  case "${ID}" in
    ubuntu|debian)
      PKG_MANAGER="apt"
      ;;
    opensuse*|sles|sled)
      PKG_MANAGER="zypper"
      ;;
    fedora|rhel|centos|rocky|almalinux|amzn)
      PKG_MANAGER="redhat"
      ;;
    *)
      if [[ "${ID_LIKE}" == *debian* ]]; then
        PKG_MANAGER="apt"
      elif [[ "${ID_LIKE}" == *suse* ]]; then
        PKG_MANAGER="zypper"
      elif [[ "${ID_LIKE}" == *rhel* || "${ID_LIKE}" == *fedora* ]]; then
        PKG_MANAGER="redhat"
      else
        echo "ERROR: 'npx playwright install chrome' only supports distributions with an official"
        echo "Google Chrome package: Ubuntu/Debian (.deb) and openSUSE/Fedora/RHEL (.rpm)."
        echo "Google does not ship a native package for '$ID'."
        case "${ID} ${ID_LIKE}" in
          *arch*|*cachyos*)
            echo "On Arch-based systems install Chrome from the AUR ('yay -S google-chrome') or use"
            echo "Chromium ('pacman -S chromium'). Playwright's bundled Chromium also works."
            ;;
          *alpine*)
            echo "Alpine uses musl libc; Google Chrome and Playwright's bundled browsers require glibc"
            echo "and do not run here. Use the system Chromium instead ('apk add chromium')."
            ;;
          *gentoo*)
            echo "On Gentoo install Chrome via Portage ('emerge www-client/google-chrome') or use"
            echo "Playwright's bundled Chromium."
            ;;
          *nixos*)
            echo "On NixOS add 'google-chrome' to your configuration declaratively, or use Playwright's"
            echo "bundled Chromium. Imperative installation into /opt is not supported."
            ;;
          *)
            echo "Use Playwright's bundled Chromium, which works on most glibc-based Linux distributions."
            ;;
        esac
        exit 1
      fi
      ;;
  esac

  # The Red Hat family ships dnf on current releases and yum on older ones (e.g. RHEL 7).
  if [[ "${PKG_MANAGER}" == "redhat" ]]; then
    if command -v dnf >/dev/null; then
      PKG_MANAGER="dnf"
    else
      PKG_MANAGER="yum"
    fi
  fi
fi

if [[ "${PKG_MANAGER}" != "apt" ]]; then
  # RPM-based distributions (openSUSE via zypper, Fedora/RHEL via dnf or yum) all
  # consume the same x86_64 package from dl.google.com.
  case "${PKG_MANAGER}" in
    zypper)
      PKG_REMOVE=(zypper --non-interactive remove)
      PKG_INSTALL=(zypper --non-interactive install)
      ;;
    *)
      PKG_REMOVE=("${PKG_MANAGER}" remove -y)
      PKG_INSTALL=("${PKG_MANAGER}" install -y)
      ;;
  esac

  # 1. make sure to remove old beta if any.
  if rpm -q google-chrome-beta >/dev/null 2>&1; then
    "${PKG_REMOVE[@]}" google-chrome-beta
  fi

  # 2. Install curl to download chrome
  if ! command -v curl >/dev/null; then
    "${PKG_INSTALL[@]}" curl
  fi

  # 3. Trust Google's signing key so the package manager accepts the package.
  rpm --import https://dl.google.com/linux/linux_signing_key.pub

  # 4. download chrome beta from dl.google.com and install it.
  cd /tmp
  curl -L -O https://dl.google.com/linux/direct/google-chrome-beta_current_x86_64.rpm
  "${PKG_INSTALL[@]}" ./google-chrome-beta_current_x86_64.rpm
  rm -rf ./google-chrome-beta_current_x86_64.rpm
  cd -
  google-chrome-beta --version
  exit 0
fi

# 1. make sure to remove old beta if any.
if dpkg --get-selections | grep -q "^google-chrome-beta[[:space:]]*install$" >/dev/null; then
  apt-get remove -y google-chrome-beta
fi

# 2. Update apt lists (needed to install curl and chrome dependencies)
apt-get update

# 3. Install curl to download chrome
if ! command -v curl >/dev/null; then
  apt-get install -y curl
fi

# 4. download chrome beta from dl.google.com and install it.
cd /tmp
curl -L -O https://dl.google.com/linux/direct/google-chrome-beta_current_amd64.deb
apt-get install -y ./google-chrome-beta_current_amd64.deb
rm -rf ./google-chrome-beta_current_amd64.deb
cd -
google-chrome-beta --version
