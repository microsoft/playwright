$ErrorActionPreference = 'Stop'

$Distribution = "playwright"
$Username = "pwuser"

$distributions = (wsl --list --quiet) -split "\r?\n"
if ($distributions -contains $Distribution) {
    Write-Host "WSL distribution '$Distribution' already exists. Skipping installation."
} else {
    Write-Host "Installing new WSL distribution '$Distribution'..."
    wsl --install -d Ubuntu-24.04 --name $Distribution --no-launch
    wsl -d $Distribution -u root adduser --gecos GECOS --disabled-password $Username
}

$pwshDirname = (Resolve-Path -Path $PSScriptRoot).Path;
$playwrightCoreRoot = Resolve-Path (Join-Path $pwshDirname "..")

$initScript = @"
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
apt-get upgrade -y
node cli.js install-deps
cp bin/webkit-wsl-pipe-wrapper.mjs /home/$Username/
sudo -u $Username PLAYWRIGHT_SKIP_BROWSER_GC=1 node cli.js install webkit
"@ -replace "\r\n", "`n"

wsl -d $Distribution --cd $playwrightCoreRoot -u root -- bash -c "$initScript"
