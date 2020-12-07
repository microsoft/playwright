set PATH=%WEBKIT_BUILD_PATH%
set WEBKIT_LIBRARIES=%~dp0WebKitLibraries\win
set WEBKIT_OUTPUTDIR=%~dp0WebKitBuild
perl %~dp0Tools\Scripts\build-webkit --wincairo --release --no-ninja --touch-events --orientation-events --dark-mode-css --generate-project-only --cmakeargs="-DLIBVPX_PACKAGE_PATH=C:\vcpkg\packages\libvpx_x64-windows"
%DEVENV% %~dp0WebKitBuild\Release\WebKit.sln /build "Release|x64"
