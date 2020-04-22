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

#pragma warning(disable: 4091)

#include "stdafx.h"
#include "Common.h"
#include "MainWindow.h"
#include "PlaywrightLibResource.h"
#include "PlaywrightReplace.h"
#include <WebKit/WKContext.h>
#include <WebKit/WKWebsiteDataStoreConfigurationRef.h>
#include <WebKit/WKWebsiteDataStoreRef.h>
#include <wtf/win/SoftLinking.h>
#include "WebKitBrowserWindow.h"
#include <wtf/MainThread.h>
#include <WebKit/WKInspector.h>

SOFT_LINK_LIBRARY(user32);
SOFT_LINK_OPTIONAL(user32, SetProcessDpiAwarenessContext, BOOL, STDAPICALLTYPE, (DPI_AWARENESS_CONTEXT));

WKRetainPtr<WKStringRef> toWK(const std::string& string)
{
    return adoptWK(WKStringCreateWithUTF8CString(string.c_str()));
}

std::string toUTF8String(const wchar_t* src, size_t srcLength)
{
    int length = WideCharToMultiByte(CP_UTF8, 0, src, srcLength, 0, 0, nullptr, nullptr);
    std::vector<char> buffer(length);
    size_t actualLength = WideCharToMultiByte(CP_UTF8, 0, src, srcLength, buffer.data(), length, nullptr, nullptr);
    return { buffer.data(), actualLength };
}

int WINAPI wWinMain(_In_ HINSTANCE hInstance, _In_opt_ HINSTANCE hPrevInstance, _In_ LPWSTR lpstrCmdLine, _In_ int nCmdShow)
{
#ifdef _CRTDBG_MAP_ALLOC
    _CrtSetReportFile(_CRT_WARN, _CRTDBG_FILE_STDERR);
    _CrtSetReportMode(_CRT_WARN, _CRTDBG_MODE_FILE);
#endif

    MSG msg { };
    HACCEL hAccelTable, hPreAccelTable;

    INITCOMMONCONTROLSEX InitCtrlEx;

    InitCtrlEx.dwSize = sizeof(INITCOMMONCONTROLSEX);
    InitCtrlEx.dwICC  = 0x00004000; // ICC_STANDARD_CLASSES;
    InitCommonControlsEx(&InitCtrlEx);

    auto options = parseCommandLine();
    if (options.inspectorPipe) {
        WKInspectorInitializeRemoteInspectorPipe(
            WebKitBrowserWindow::createPageCallback,
            []() { PostQuitMessage(0); });
    }

    if (options.useFullDesktop)
        computeFullDesktopFrame();

    // Init COM
    OleInitialize(nullptr);

    if (SetProcessDpiAwarenessContextPtr())
        SetProcessDpiAwarenessContextPtr()(DPI_AWARENESS_CONTEXT_UNAWARE);

    MainWindow::configure(options.headless, options.noStartupWindow);

    if (!options.noStartupWindow) {
        auto configuration = adoptWK(WKWebsiteDataStoreConfigurationCreate());
        if (options.userDataDir.length()) {
            std::string profileFolder = toUTF8String(options.userDataDir, options.userDataDir.length());
            WKWebsiteDataStoreConfigurationSetApplicationCacheDirectory(configuration.get(), toWK(profileFolder + "\\ApplicationCache").get());
            WKWebsiteDataStoreConfigurationSetNetworkCacheDirectory(configuration.get(), toWK(profileFolder + "\\Cache").get());
            WKWebsiteDataStoreConfigurationSetCacheStorageDirectory(configuration.get(), toWK(profileFolder + "\\CacheStorage").get());
            WKWebsiteDataStoreConfigurationSetIndexedDBDatabaseDirectory(configuration.get(), toWK(profileFolder + "\\Databases" + "\\IndexedDB").get());
            WKWebsiteDataStoreConfigurationSetLocalStorageDirectory(configuration.get(), toWK(profileFolder + "\\LocalStorage").get());
            WKWebsiteDataStoreConfigurationSetWebSQLDatabaseDirectory(configuration.get(), toWK(profileFolder + "\\Databases" + "\\WebSQL").get());
            WKWebsiteDataStoreConfigurationSetMediaKeysStorageDirectory(configuration.get(), toWK(profileFolder + "\\MediaKeys").get());
            WKWebsiteDataStoreConfigurationSetResourceLoadStatisticsDirectory(configuration.get(), toWK(profileFolder + "\\ResourceLoadStatistics").get());
            WKWebsiteDataStoreConfigurationSetServiceWorkerRegistrationDirectory(configuration.get(), toWK(profileFolder + "\\ServiceWorkers").get());
        }
        auto context = adoptWK(WKContextCreateWithConfiguration(nullptr));
        auto dataStore = adoptWK(WKWebsiteDataStoreCreateWithConfiguration(configuration.get()));
        WKContextSetPrimaryDataStore(context.get(), dataStore.get());

        auto* mainWindow = new MainWindow();
        HRESULT hr = mainWindow->init(hInst, context.get(), dataStore.get());
        if (FAILED(hr))
            goto exit;

        if (options.requestedURL.length())
            mainWindow->loadURL(options.requestedURL.GetBSTR());
        else
            mainWindow->loadURL(L"about:blank");
    }

    hAccelTable = LoadAccelerators(hInst, MAKEINTRESOURCE(IDC_PLAYWRIGHT));
    hPreAccelTable = LoadAccelerators(hInst, MAKEINTRESOURCE(IDR_ACCELERATORS_PRE));

#pragma warning(disable:4509)

    // Main message loop:
    __try {
        while (GetMessage(&msg, nullptr, 0, 0)) {
            if (TranslateAccelerator(msg.hwnd, hPreAccelTable, &msg))
                continue;
            bool processed = false;
            if (MainWindow::isInstance(msg.hwnd))
                processed = TranslateAccelerator(msg.hwnd, hAccelTable, &msg);
            if (!processed) {
                TranslateMessage(&msg);
                DispatchMessage(&msg);
            }
        }
    } __except(createCrashReport(GetExceptionInformation()), EXCEPTION_EXECUTE_HANDLER) { }

exit:
#ifdef _CRTDBG_MAP_ALLOC
    _CrtDumpMemoryLeaks();
#endif

    // Shut down COM.
    OleUninitialize();

    return static_cast<int>(msg.wParam);
}

extern "C" __declspec(dllexport) int WINAPI dllLauncherEntryPoint(HINSTANCE hInstance, HINSTANCE hPrevInstance, LPWSTR lpstrCmdLine, int nCmdShow)
{
    return wWinMain(hInstance, hPrevInstance, lpstrCmdLine, nCmdShow);
}
