cd utils\build
npx pkg --public --targets node12-win-x86 --output=output\win32\playwright-cli.exe ..\..
copy ..\..\browsers.json output\win32
copy ..\..\third_party\ffmpeg\COPYING.GPLv3 output\win32\ffmpeg.COPYING.GPLv3
copy ..\..\third_party\ffmpeg\ffmpeg-win32.exe output\win32
copy ..\..\bin\PrintDeps.exe output\win32
$version = & node -p "require('../../package.json').version"
cd output\win32
Compress-Archive -Force -Path * -DestinationPath ..\playwright-$version-win32.zip
cd ..\..\..\..
