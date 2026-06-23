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
        echo "ERROR: 'npx playwright install msedge-dev' only supports distributions with an official"
        echo "Microsoft Edge package: Ubuntu/Debian (.deb) and openSUSE/Fedora/RHEL (.rpm)."
        echo "Microsoft does not ship a native package for '$ID'."
        case "${ID} ${ID_LIKE}" in
          *arch*|*cachyos*)
            echo "On Arch-based systems install Microsoft Edge from the AUR ('yay -S microsoft-edge-dev-bin')."
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
  # RPM-based distributions (openSUSE via zypper, Fedora/RHEL via dnf or yum) install
  # Microsoft Edge from the same rpm repository at packages.microsoft.com.
  case "${PKG_MANAGER}" in
    zypper)
      PKG_REMOVE=(zypper --non-interactive remove)
      PKG_INSTALL=(zypper --non-interactive --gpg-auto-import-keys install)
      REPO_DIR="/etc/zypp/repos.d"
      ;;
    *)
      PKG_REMOVE=("${PKG_MANAGER}" remove -y)
      PKG_INSTALL=("${PKG_MANAGER}" install -y)
      REPO_DIR="/etc/yum.repos.d"
      ;;
  esac

  # 1. Trust Microsoft's signing key and register the Edge repository.
  rpm --import https://packages.microsoft.com/keys/microsoft.asc
  cat > "${REPO_DIR}/microsoft-edge.repo" <<'REPO'
[microsoft-edge]
name=Microsoft Edge
baseurl=https://packages.microsoft.com/yumrepos/edge
enabled=1
gpgcheck=1
gpgkey=https://packages.microsoft.com/keys/microsoft.asc
REPO

  # 2. make sure to remove old dev if any.
  if rpm -q microsoft-edge-dev >/dev/null 2>&1; then
    "${PKG_REMOVE[@]}" microsoft-edge-dev
  fi

  # 3. refresh metadata (zypper) and install.
  if [[ "${PKG_MANAGER}" == "zypper" ]]; then
    zypper --non-interactive --gpg-auto-import-keys refresh
  fi
  "${PKG_INSTALL[@]}" microsoft-edge-dev
  microsoft-edge-dev --version
  exit 0
fi

# 1. make sure to remove old dev if any.
if dpkg --get-selections | grep -q "^microsoft-edge-dev[[:space:]]*install$" >/dev/null; then
  apt-get remove -y microsoft-edge-dev
fi

# 2. Install curl to download Microsoft gpg key
if ! command -v curl >/dev/null; then
  apt-get update
  apt-get install -y curl
fi

# GnuPG is not preinstalled in slim images
if ! command -v gpg >/dev/null; then
  apt-get update
  apt-get install -y gpg
fi

# 3. Add the GPG key, the apt repo, update the apt cache, and install the package
curl -L https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor > /tmp/microsoft.gpg
install -o root -g root -m 644 /tmp/microsoft.gpg /etc/apt/trusted.gpg.d/
sh -c 'echo "deb [arch=amd64] https://packages.microsoft.com/repos/edge stable main" > /etc/apt/sources.list.d/microsoft-edge-dev.list'
rm /tmp/microsoft.gpg
apt-get update && apt-get install -y microsoft-edge-dev

microsoft-edge-dev --version
