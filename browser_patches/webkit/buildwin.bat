set PATH=%WEBKIT_BUILD_PATH%
set WEBKIT_LIBRARIES=WebKitLibraries\win
set WEBKIT_OUTPUTDIR=WebKitBuild
perl Tools\Scripts\build-webkit --wincairo --release --no-ninja --touch-events --orientation-events --dark-mode-css --generate-project-only --cmakeargs="-DLIBVPX_PACKAGE_PATH=C:\vcpkg\packages\libvpx_x64-windows"
%DEVENV% WebKitBuild\Release\WebKit.sln /build "Release|x64"
