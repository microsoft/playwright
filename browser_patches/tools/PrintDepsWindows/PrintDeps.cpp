/**
 * Copyright Microsoft Corporation. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

#include <iostream>
#include <map>
#include <string>

#include <windows.h>
#include <Dbghelp.h>

using DepsMap = std::map<std::string, std::string>;

std::string getLastErrorString()
{
    LPTSTR lpMsgBuf;
    DWORD dw = GetLastError();
    FormatMessage(
        FORMAT_MESSAGE_ALLOCATE_BUFFER | FORMAT_MESSAGE_FROM_SYSTEM,
        NULL,
        dw,
        MAKELANGID(LANG_NEUTRAL, SUBLANG_DEFAULT),
        (LPTSTR)&lpMsgBuf,
        0, NULL);
    std::string result(lpMsgBuf);
    LocalFree(lpMsgBuf);
    return result;
}

const DepsMap getDependencies(const HMODULE hMod)
{
    // See https://docs.microsoft.com/en-us/archive/msdn-magazine/2002/february/inside-windows-win32-portable-executable-file-format-in-detail
    // for PE format description.
    ULONG size;
    PIMAGE_IMPORT_DESCRIPTOR pImportDesc =  (PIMAGE_IMPORT_DESCRIPTOR)ImageDirectoryEntryToData(hMod, true, IMAGE_DIRECTORY_ENTRY_IMPORT, &size);
    DepsMap deps;
    // According to https://docs.microsoft.com/en-us/archive/msdn-magazine/2002/march/inside-windows-an-in-depth-look-into-the-win32-portable-executable-file-format-part-2
    // "The end of the IMAGE_IMPORT_DESCRIPTOR array is indicated by an entry with fields all set to 0."
    while (pImportDesc->Name)
    {
        LPCSTR dllName = (LPCSTR)((BYTE*)hMod + pImportDesc->Name);
        std::string dllPath = "not found";
        HMODULE hModDep = LoadLibraryEx(dllName, NULL, DONT_RESOLVE_DLL_REFERENCES);
        if (hModDep != NULL)
        {
            TCHAR pathBuffer[_MAX_PATH];
            DWORD result = GetModuleFileName(hModDep, pathBuffer, _MAX_PATH);
            if (result == 0) {
                std::cerr << "Failed to get library file name: " << dllName << "  Error: " << getLastErrorString() << std::endl;
            }
            dllPath = std::string(pathBuffer);
            FreeLibrary(hModDep);
        }
        deps[std::string(dllName)] = dllPath;
        pImportDesc++;
    }

    return deps;
}

int printDependencies(const char* library)
{
    HMODULE hMod = LoadLibraryEx(library, NULL, DONT_RESOLVE_DLL_REFERENCES);
    if (hMod == NULL)
    {
        std::cerr << "Failed to load " << library << "  Error: " << getLastErrorString() << std::endl;
        return -1;
    }
    const DepsMap& deps = getDependencies(hMod);
    for (const auto iter : deps)
    {
        std::cout << "    " << iter.first << " => " << iter.second << std::endl;
    }
    FreeLibrary(hMod);
    return 0;
}

int printUsage()
{
    std::cout << "Usage:\n  PrintDeps FILE..." << std::endl;
    return -1;
}

int main(int argc, char* argv[])
{
    if (argc <= 1)
    {
        return printUsage();
    }
    int res = 0;
    for (int i = 1; i < argc; ++i)
    {
        std::cout << argv[i] << std::endl;
        res = printDependencies(argv[i]);
    }
    return res;
}
