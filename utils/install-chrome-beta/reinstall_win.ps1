$url = 'https://dl.google.com/tag/s/dl/chrome/install/beta/googlechromebetastandaloneenterprise.msi';

if ([Environment]::Is64BitProcess) {
    $url = 'https://dl.google.com/tag/s/dl/chrome/install/beta/googlechromebetastandaloneenterprise64.msi'
}

$app = Get-WmiObject -Class Win32_Product | Where-Object { 
    $_.Name -match "Google Chrome Beta" 
}
if ($app) {
    $app.Uninstall()
}

$wc = New-Object net.webclient
$msiInstaller = "$env:temp\google-chrome-beta.msi"
Remove-Item $msiInstaller
$wc.Downloadfile($url, $msiInstaller)

$arguments = "/i `"$msiInstaller`" /quiet"
Start-Process msiexec.exe -ArgumentList $arguments -Wait
