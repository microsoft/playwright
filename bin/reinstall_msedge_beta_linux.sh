set -e
set -x

if dpkg --get-selections | grep -q "^microsoft-edge-beta[[:space:]]*install$" >/dev/null; then
  apt-get remove -y microsoft-edge-beta
fi

curl https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor > /tmp/microsoft.gpg
install -o root -g root -m 644 /tmp/microsoft.gpg /etc/apt/trusted.gpg.d/
sh -c 'echo "deb [arch=amd64] https://packages.microsoft.com/repos/edge stable main" > /etc/apt/sources.list.d/microsoft-edge-dev.list'
rm /tmp/microsoft.gpg
apt-get update && apt-get install -y microsoft-edge-beta

microsoft-edge-beta --version
