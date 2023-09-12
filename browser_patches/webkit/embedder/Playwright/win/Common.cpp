/*
 * Copyright (C) 2006, 2008, 2013-2015 Apple Inc.  All rights reserved.
 * Copyright (C) 2009, 2011 Brent Fulgham.  All rights reserved.
 * Copyright (C) 2009, 2010, 2011 Appcelerator, Inc. All rights reserved.
 * Copyright (C) 2013 Alex Christensen. All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions
 * are met:
 * 1. Redistributions of source code must retain the above copyright
 *    notice, this list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright
 *    notice, this list of conditions and the following disclaimer in the
 *    documentation and/or other materials provided with the distribution.
 *
 * THIS SOFTWARE IS PROVIDED BY APPLE INC. ``AS IS'' AND ANY
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
 * PURPOSE ARE DISCLAIMED.  IN NO EVENT SHALL APPLE INC. OR
 * CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,
 * EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
 * PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
 * PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY
 * OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE. 
 */

#include "stdafx.h"
#include "Common.h"

#include "DialogHelper.h"
#include "PlaywrightLibResource.h"
#include "PlaywrightReplace.h"
#include <dbghelp.h>
#include <shlobj.h>
#include <wtf/StdLibExtras.h>
#include <vector>

// Global Variables:
HINSTANCE hInst;

// Support moving the transparent window
POINT s_windowPosition = { 100, 100 };
SIZE s_windowSize = { 500, 200 };

namespace WebCore {
float deviceScaleFactorForWindow(HWND);
}

void computeFullDesktopFrame()
{
    RECT desktop;
    if (!::SystemParametersInfo(SPI_GETWORKAREA, 0, static_cast<void*>(&desktop), 0))
        return;

    float scaleFactor = WebCore::deviceScaleFactorForWindow(nullptr);

    s_windowPosition.x = 0;
    s_windowPosition.y = 0;
    s_windowSize.cx = scaleFactor * (desktop.right - desktop.left);
    s_windowSize.cy = scaleFactor * (desktop.bottom - desktop.top);
}

bool getAppDataFolder(_bstr_t& directory)
{
    wchar_t appDataDirectory[MAX_PATH];
    if (FAILED(SHGetFolderPathW(0, CSIDL_LOCAL_APPDATA | CSIDL_FLAG_CREATE, 0, 0, appDataDirectory)))
        return false;

    wchar_t executablePath[MAX_PATH];
    if (!::GetModuleFileNameW(0, executablePath, MAX_PATH))
        return false;

    ::PathRemoveExtensionW(executablePath);

    directory = _bstr_t(appDataDirectory) + L"\\" + ::PathFindFileNameW(executablePath);

    return true;
}

void createCrashReport(EXCEPTION_POINTERS* exceptionPointers)
{
    _bstr_t directory;

    if (!getAppDataFolder(directory))
        return;

    if (::SHCreateDirectoryEx(0, directory, 0) != ERROR_SUCCESS
        && ::GetLastError() != ERROR_FILE_EXISTS
        && ::GetLastError() != ERROR_ALREADY_EXISTS)
        return;

    std::wstring fileName = std::wstring(static_cast<const wchar_t*>(directory)) + L"\\CrashReport.dmp";
    HANDLE miniDumpFile = ::CreateFile(fileName.c_str(), GENERIC_WRITE, 0, 0, CREATE_ALWAYS, FILE_ATTRIBUTE_NORMAL, 0);

    if (miniDumpFile && miniDumpFile != INVALID_HANDLE_VALUE) {

        MINIDUMP_EXCEPTION_INFORMATION mdei;
        mdei.ThreadId = ::GetCurrentThreadId();
        mdei.ExceptionPointers  = exceptionPointers;
        mdei.ClientPointers = 0;

#ifdef _DEBUG
        MINIDUMP_TYPE dumpType = MiniDumpWithFullMemory;
#else
        MINIDUMP_TYPE dumpType = MiniDumpNormal;
#endif

        ::MiniDumpWriteDump(::GetCurrentProcess(), ::GetCurrentProcessId(), miniDumpFile, dumpType, &mdei, 0, 0);
        ::CloseHandle(miniDumpFile);
        processCrashReport(fileName.c_str());
    }
}

std::optional<Credential> askCredential(HWND hwnd, const std::wstring& realm)
{
    struct AuthDialog : public Dialog {
        std::wstring realm;
        Credential credential;

    protected:
        void setup()
        {
            setText(IDC_REALM_TEXT, realm);
        }

        void ok() final
        {
            credential.username = getText(IDC_AUTH_USER);
            credential.password = getText(IDC_AUTH_PASSWORD);
        }
    };

    AuthDialog dialog;
    dialog.realm = realm;

    if (dialog.run(hInst, hwnd, IDD_AUTH))
        return dialog.credential;
    return std::nullopt;
}

bool askServerTrustEvaluation(HWND hwnd, const std::wstring& text)
{
    class ServerTrustEvaluationDialog : public Dialog {
    public:
        ServerTrustEvaluationDialog(const std::wstring& text)
            : m_text { text }
        {
            SendMessage(GetDlgItem(this->hDlg(), IDC_SERVER_TRUST_TEXT), WM_SETFONT, (WPARAM)GetStockObject(ANSI_FIXED_FONT), TRUE);
        }

    protected:
        std::wstring m_text;

        void setup()
        {
            setText(IDC_SERVER_TRUST_TEXT, m_text);
        }

        void ok() final
        {

        }
    };

    ServerTrustEvaluationDialog dialog { text };
    return dialog.run(hInst, hwnd, IDD_SERVER_TRUST);
}

CommandLineOptions parseCommandLine()
{
    CommandLineOptions options;

    int argc = 0;
    WCHAR** argv = CommandLineToArgvW(GetCommandLineW(), &argc);
    for (int i = 1; i < argc; ++i) {
        if (!wcsicmp(argv[i], L"--desktop"))
            options.useFullDesktop = true;
        else if (!wcsicmp(argv[i], L"--inspector-pipe"))
            options.inspectorPipe = true;
        else if (!wcsncmp(argv[i], L"--user-data-dir=", 16))
            options.userDataDir = argv[i] + 16;
        else if (!wcsncmp(argv[i], L"--curl-proxy=", 13))
            options.curloptProxy = argv[i] + 13;
        else if (!wcsncmp(argv[i], L"--curl-noproxy=", 15))
            options.curloptNoproxy = argv[i] + 15;
        else if (!wcsicmp(argv[i], L"--headless"))
            options.headless = true;
        else if (!wcsicmp(argv[i], L"--no-startup-window"))
            options.noStartupWindow = true;
        else if (!wcsicmp(argv[i], L"--disable-accelerated-compositing"))
            options.disableAcceleratedCompositing = true;
        else if (!options.requestedURL)
            options.requestedURL = argv[i];
    }

    return options;
}

std::wstring replaceString(std::wstring src, const std::wstring& oldValue, const std::wstring& newValue)
{
    if (src.empty() || oldValue.empty())
        return src;

    size_t pos = 0;
    while ((pos = src.find(oldValue, pos)) != src.npos) {
        src.replace(pos, oldValue.length(), newValue);
        pos += newValue.length();
    }

    return src;
}

std::wstring createString(WKStringRef wkString)
{
    size_t maxSize = WKStringGetLength(wkString);

    std::vector<WKChar> wkCharBuffer(maxSize);
    size_t actualLength = WKStringGetCharacters(wkString, wkCharBuffer.data(), maxSize);
    return std::wstring(wkCharBuffer.data(), actualLength);
}

std::wstring createString(WKURLRef wkURL)
{
    if (!wkURL)
        return { };
    WKRetainPtr<WKStringRef> url = adoptWK(WKURLCopyString(wkURL));
    return createString(url.get());
}

std::string createUTF8String(const wchar_t* src, size_t srcLength)
{
    int length = WideCharToMultiByte(CP_UTF8, 0, src, srcLength, 0, 0, nullptr, nullptr);
    std::vector<char> buffer(length);
    size_t actualLength = WideCharToMultiByte(CP_UTF8, 0, src, srcLength, buffer.data(), length, nullptr, nullptr);
    return { buffer.data(), actualLength };
}

WKRetainPtr<WKStringRef> createWKString(_bstr_t str)
{
    auto utf8 = createUTF8String(str, str.length());
    return adoptWK(WKStringCreateWithUTF8CString(utf8.data()));
}

WKRetainPtr<WKStringRef> createWKString(const std::wstring& str)
{
    auto utf8 = createUTF8String(str.c_str(), str.length());
    return adoptWK(WKStringCreateWithUTF8CString(utf8.data()));
}

WKRetainPtr<WKURLRef> createWKURL(_bstr_t str)
{
    auto utf8 = createUTF8String(str, str.length());
    return adoptWK(WKURLCreateWithUTF8CString(utf8.data()));
}

WKRetainPtr<WKURLRef> createWKURL(const std::wstring& str)
{
    auto utf8 = createUTF8String(str.c_str(), str.length());
    return adoptWK(WKURLCreateWithUTF8CString(utf8.data()));
}
