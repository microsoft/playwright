/*
 * Copyright (C) 2018 Sony Interactive Entertainment Inc.
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

#pragma once

#include "WebKitBrowserWindow.h"

#include <WebKit/WKBase.h>
#include <WebKit/WKRetainPtr.h>
#include <functional>
#include <memory>
#include <string>

class MainWindow : public BrowserWindowClient {
public:
    static void configure(bool controlledRemotely, bool disableAcceleratedCompositing);

    MainWindow();

    ~MainWindow();
    bool init(HINSTANCE hInstance, WKPageConfigurationRef);

    void resizeSubViews();
    HWND hwnd() const { return m_hMainWnd; }
    WebKitBrowserWindow* browserWindow() const { return m_browserWindow.get(); }

    void loadURL(std::wstring);

    static bool isInstance(HWND);
    
private:
    static LRESULT CALLBACK WndProc(HWND, UINT, WPARAM, LPARAM);
    static void registerClass(HINSTANCE hInstance);
    static std::wstring s_windowClass;
    static size_t s_numInstances;
    static bool s_controlledRemotely;
    static bool s_disableAcceleratedCompositing;

    bool toggleMenuItem(UINT menuID);
    void onURLBarEnter();
    void updateDeviceScaleFactor();

    void createToolbar(HINSTANCE);
    void resizeToolbar(int);
    void rescaleToolbar();

    // BrowserWindowClient
    void activeURLChanged(std::wstring) final;

    HWND m_hMainWnd { nullptr };
    HWND m_hToolbarWnd { nullptr };
    HWND m_hURLBarWnd { nullptr };
    HWND m_hProgressIndicator { nullptr };
    HWND m_hCacheWnd { nullptr };
    HGDIOBJ m_hURLBarFont { nullptr };
    // WKPageConfigurationRef retains page and WebKitBrowserWindow retains page via view
    // make sure view is deleted after the page.
    std::unique_ptr<WebKitBrowserWindow> m_browserWindow;
    WKRetainPtr<WKPageConfigurationRef> m_configuration;
    int m_toolbarItemsWidth { };
};
