SET /p BUILD_NUMBER=<BUILD_NUMBER
SET CL=/DBUILD_NUMBER=%BUILD_NUMBER%

call "%VS_PATH%\VC\Auxiliary\Build\vcvars64.bat"
devenv %~dp0\PrintDeps.sln /build "Release|x64"
