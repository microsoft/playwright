# Tool for printing .exe and .dll dependencies on Windows

This is similar to `ldd` on linux in that loads specified files and tries to
resolve all DLLs referenced by it, printing in the formar `<lib name> => <full path> | "no found"`
To minimize dependencies we link all C runtime libraries statically, there is
still one dynamic dependency on `dbghelp.dll` which is supposed to be preinstalled
on all Windows machines.

## Build instructions

Open `PrintDeps.sln` solution in Visual Studio 2019 and build `x64/Release` configuration. We
currently commit output binary into `bin/PrintDeps.exe` and bundle it in every npm.