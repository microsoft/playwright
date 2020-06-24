set PATH=%WEBKIT_BUILD_PATH%
set WEBKIT_LIBRARIES=%~dp0checkout\WebKitLibraries\win
set WEBKIT_OUTPUTDIR=%~dp0checkout\WebKitBuild
perl %~dp0checkout\Tools\Scripts\build-webkit --wincairo --release --no-ninja --touch-events --orientation-events --dark-mode-css --generate-project-only --cmakeargs="-DLIBVPX_PACKAGE_PATH=C:\vcpkg\packages\libvpx_x64-windows"
%DEVENV% %~dp0checkout\WebKitBuild\Release\WebKit.sln /build "Release|x64"
