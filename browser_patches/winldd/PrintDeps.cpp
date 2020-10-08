/**
MIT License

Copyright (c) 2020 Julien Waechter

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

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
        HMODULE hModDep = LoadLibraryEx(dllName, NULL, DONT_RESOLVE_DLL_REFERENCES | LOAD_LIBRARY_SEARCH_USER_DIRS | LOAD_LIBRARY_SEARCH_SYSTEM32);
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
    SetDllDirectoryA(".");
    HMODULE hMod = LoadLibraryEx(library, NULL, DONT_RESOLVE_DLL_REFERENCES | LOAD_LIBRARY_SEARCH_USER_DIRS | LOAD_LIBRARY_SEARCH_SYSTEM32);
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
    std::cout << "Version: r" << BUILD_NUMBER << " Usage:\n  PrintDeps FILE..." << std::endl;
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
