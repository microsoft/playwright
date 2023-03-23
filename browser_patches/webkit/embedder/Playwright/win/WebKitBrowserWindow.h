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

#include "Common.h"
#include <WebKit/WKBase.h>
#include <WebKit/WebKit2_C.h>
#include <unordered_map>

class BrowserWindowClient {
public:
    virtual void activeURLChanged(std::wstring) = 0;
};

class WebKitBrowserWindow {
public:
    static WKPageRef createPageCallback(WKPageConfigurationRef);
    WebKitBrowserWindow(BrowserWindowClient&, HWND mainWnd, WKPageConfigurationRef);
    ~WebKitBrowserWindow();

    HRESULT loadURL(const BSTR& url);
    void reload();
    void navigateForwardOrBackward(bool forward);
    void launchInspector();

    _bstr_t userAgent();
    void setUserAgent(_bstr_t&);

    void resetZoom();
    void zoomIn();
    void zoomOut();

    bool canTrustServerCertificate(WKProtectionSpaceRef);
    HWND hwnd();

private:
    static WKPageRef createViewCallback(WKPageConfigurationRef, bool navigate);

    static void didChangeTitle(const void*);
    static void didChangeIsLoading(const void*);
    static void didChangeEstimatedProgress(const void*);
    static void didChangeActiveURL(const void*);
    static void didReceiveAuthenticationChallenge(WKPageRef, WKAuthenticationChallengeRef, const void*);
    static WKPageRef createNewPage(WKPageRef, WKPageConfigurationRef, WKNavigationActionRef, WKWindowFeaturesRef, const void *);
    static void closeWindow(WKPageRef, const void*);
    static void runJavaScriptAlert(WKPageRef page, WKStringRef alertText, WKFrameRef frame, WKSecurityOriginRef securityOrigin, WKPageRunJavaScriptAlertResultListenerRef listener, const void *clientInfo);
    static void runJavaScriptConfirm(WKPageRef page, WKStringRef message, WKFrameRef frame, WKSecurityOriginRef securityOrigin, WKPageRunJavaScriptConfirmResultListenerRef listener, const void *clientInfo);
    static void runJavaScriptPrompt(WKPageRef page, WKStringRef message, WKStringRef defaultValue, WKFrameRef frame, WKSecurityOriginRef securityOrigin, WKPageRunJavaScriptPromptResultListenerRef listener, const void *clientInfo);
    static void runBeforeUnloadConfirmPanel(WKPageRef page, WKStringRef message, WKFrameRef frame, WKPageRunBeforeUnloadConfirmPanelResultListenerRef listener, const void *clientInfo);
    static void handleJavaScriptDialog(WKPageRef page, bool accept, WKStringRef value, const void *clientInfo);
    static WKRect getWindowFrame(WKPageRef page, const void *clientInfo);
    static void didNotHandleKeyEvent(WKPageRef, WKNativeEventPtr, const void*);
    static void decidePolicyForNavigationAction(WKPageRef, WKFrameRef, WKFrameNavigationType, WKEventModifiers, WKEventMouseButton, WKFrameRef, WKURLRequestRef, WKFramePolicyListenerRef, WKTypeRef, const void* clientInfo);
    static void decidePolicyForResponse(WKPageRef, WKFrameRef, WKURLResponseRef, WKURLRequestRef, bool, WKFramePolicyListenerRef, WKTypeRef, const void*);

    BrowserWindowClient& m_client;
    WKRetainPtr<WKViewRef> m_view;
    HWND m_hMainWnd { nullptr };
    std::unordered_map<std::wstring, std::wstring> m_acceptedServerTrustCerts;
    WKPageRunJavaScriptAlertResultListenerRef m_alertDialog = { };
    WKPageRunJavaScriptConfirmResultListenerRef m_confirmDialog = { };
    WKPageRunJavaScriptPromptResultListenerRef m_promptDialog = { };
    WKPageRunBeforeUnloadConfirmPanelResultListenerRef m_beforeUnloadDialog = { };
};
