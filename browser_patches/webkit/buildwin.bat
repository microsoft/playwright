set PATH=%WEBKIT_BUILD_PATH%
set WEBKIT_LIBRARIES=%CD%\WebKitLibraries\win
set WEBKIT_OUTPUTDIR=%CD%\WebKitBuild
perl %CD%\Tools\Scripts\build-webkit --wincairo --release --no-ninja --touch-events --orientation-events --dark-mode-css --generate-project-only --cmakeargs="-DLIBVPX_PACKAGE_PATH=C:\vcpkg\packages\libvpx_x64-windows"
%DEVENV% %CD%\WebKitBuild\Release\WebKit.sln /build "Release|x64"
