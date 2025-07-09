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
#include "stdafx.h"
#include "Common.h"
#include "MainWindow.h"
#include "PlaywrightLibResource.h"
#include "WebKitBrowserWindow.h"
#include <WebCore/GDIUtilities.h>
#include <WebKit/WKAuthenticationChallenge.h>
#include <WebKit/WKAuthenticationDecisionListener.h>
#include <WebKit/WKCertificateInfoCurl.h>
#include <WebKit/WKCredential.h>
#include <WebKit/WKFramePolicyListener.h>
#include <WebKit/WKInspector.h>
#include <WebKit/WKPagePrivate.h>
#include <WebKit/WKProtectionSpace.h>
#include <WebKit/WKProtectionSpaceCurl.h>
#include <WebKit/WKWebsiteDataStoreRef.h>
#include <WebKit/WKWebsiteDataStoreRefCurl.h>
#include <vector>

std::wstring createPEMString(WKProtectionSpaceRef protectionSpace)
{
    auto chain = adoptWK(WKProtectionSpaceCopyCertificateChain(protectionSpace));

    std::wstring pems;

    for (size_t i = 0; i < WKArrayGetSize(chain.get()); i++) {
        auto item = WKArrayGetItemAtIndex(chain.get(), i);
        assert(WKGetTypeID(item) == WKDataGetTypeID());
        auto certificate = static_cast<WKDataRef>(item);
        auto size = WKDataGetSize(certificate);
        auto data = WKDataGetBytes(certificate);

        for (size_t i = 0; i < size; i++)
            pems.push_back(data[i]);
    }

    return replaceString(pems, L"\n", L"\r\n");
}

WebKitBrowserWindow::WebKitBrowserWindow(BrowserWindowClient& client, HWND mainWnd, WKPageConfigurationRef conf)
    : m_client(client)
    , m_hMainWnd(mainWnd)
{
    RECT rect = { };
    m_view = adoptWK(WKViewCreate(rect, conf, mainWnd));
    WKViewSetIsInWindow(m_view.get(), true);

    auto page = WKViewGetPage(m_view.get());

    WKPageNavigationClientV0 navigationClient = { };
    navigationClient.base.version = 0;
    navigationClient.base.clientInfo = this;
    navigationClient.didReceiveAuthenticationChallenge = didReceiveAuthenticationChallenge;
    WKPageSetPageNavigationClient(page, &navigationClient.base);

    WKPageUIClientV14 uiClient = { };
    uiClient.base.version = 14;
    uiClient.base.clientInfo = this;
    uiClient.createNewPage = createNewPage;
    uiClient.didNotHandleKeyEvent = didNotHandleKeyEvent;
    uiClient.close = closeWindow;
    uiClient.runJavaScriptAlert = runJavaScriptAlert;
    uiClient.runJavaScriptConfirm = runJavaScriptConfirm;
    uiClient.runJavaScriptPrompt = runJavaScriptPrompt;
    uiClient.runBeforeUnloadConfirmPanel = runBeforeUnloadConfirmPanel;
    uiClient.handleJavaScriptDialog = handleJavaScriptDialog;
    uiClient.getWindowFrame = getWindowFrame;
    WKPageSetPageUIClient(page, &uiClient.base);

    WKPageStateClientV0 stateClient = { };
    stateClient.base.version = 0;
    stateClient.base.clientInfo = this;
    stateClient.didChangeTitle = didChangeTitle;
    stateClient.didChangeIsLoading = didChangeIsLoading;
    stateClient.didChangeActiveURL = didChangeActiveURL;
    WKPageSetPageStateClient(page, &stateClient.base);

    WKPagePolicyClientV1 policyClient = { };
    policyClient.base.version = 1;
    policyClient.base.clientInfo = this;
    policyClient.decidePolicyForResponse = decidePolicyForResponse;
    policyClient.decidePolicyForNavigationAction = decidePolicyForNavigationAction;
    WKPageSetPagePolicyClient(page, &policyClient.base);

    WKPageSetControlledByAutomation(page, true);
    resetZoom();
}

WebKitBrowserWindow::~WebKitBrowserWindow()
{
    if (m_alertDialog) {
        WKRelease(m_alertDialog);
        m_alertDialog = NULL;
    }

    if (m_confirmDialog) {
        WKRelease(m_confirmDialog);
        m_confirmDialog = NULL;
    }

    if (m_promptDialog) {
        WKRelease(m_promptDialog);
        m_promptDialog = NULL;
    }

    if (m_beforeUnloadDialog) {
        WKRelease(m_beforeUnloadDialog);
        m_beforeUnloadDialog = NULL;
    }
}

HWND WebKitBrowserWindow::hwnd()
{
    return WKViewGetWindow(m_view.get());
}

HRESULT WebKitBrowserWindow::loadURL(const BSTR& url)
{
    auto page = WKViewGetPage(m_view.get());
    WKPageLoadURL(page, createWKURL(_bstr_t(url)).get());
    return true;
}

void WebKitBrowserWindow::reload()
{
    auto page = WKViewGetPage(m_view.get());
    WKPageReload(page);
}

void WebKitBrowserWindow::navigateForwardOrBackward(bool forward)
{
    auto page = WKViewGetPage(m_view.get());
    if (forward)
        WKPageGoForward(page);
    else
        WKPageGoBack(page);
}

void WebKitBrowserWindow::launchInspector()
{
    auto page = WKViewGetPage(m_view.get());
    auto inspector = WKPageGetInspector(page);
    WKInspectorShow(inspector);
}

void WebKitBrowserWindow::setUserAgent(_bstr_t& customUAString)
{
    auto page = WKViewGetPage(m_view.get());
    auto ua = createWKString(customUAString);
    WKPageSetCustomUserAgent(page, ua.get());
}

_bstr_t WebKitBrowserWindow::userAgent()
{
    auto page = WKViewGetPage(m_view.get());
    auto ua = adoptWK(WKPageCopyUserAgent(page));
    return createString(ua.get()).c_str();
}

void WebKitBrowserWindow::resetZoom()
{
    auto page = WKViewGetPage(m_view.get());
    WKPageSetPageZoomFactor(page, WebCore::deviceScaleFactorForWindow(hwnd()));
}

void WebKitBrowserWindow::zoomIn()
{
    auto page = WKViewGetPage(m_view.get());
    double s = WKPageGetPageZoomFactor(page);
    WKPageSetPageZoomFactor(page, s * 1.25);
}

void WebKitBrowserWindow::zoomOut()
{
    auto page = WKViewGetPage(m_view.get());
    double s = WKPageGetPageZoomFactor(page);
    WKPageSetPageZoomFactor(page, s * 0.8);
}

static WebKitBrowserWindow& toWebKitBrowserWindow(const void *clientInfo)
{
    return *const_cast<WebKitBrowserWindow*>(static_cast<const WebKitBrowserWindow*>(clientInfo));
}

void WebKitBrowserWindow::didChangeTitle(const void* clientInfo)
{
    auto& thisWindow = toWebKitBrowserWindow(clientInfo);
    auto page = WKViewGetPage(thisWindow.m_view.get());
    WKRetainPtr<WKStringRef> title = adoptWK(WKPageCopyTitle(page));
    std::wstring titleString = createString(title.get()) + L" [WebKit]";
    SetWindowText(thisWindow.m_hMainWnd, titleString.c_str());
}

void WebKitBrowserWindow::didChangeIsLoading(const void* clientInfo)
{
    auto& thisWindow = toWebKitBrowserWindow(clientInfo);
}

void WebKitBrowserWindow::didChangeActiveURL(const void* clientInfo)
{
    auto& thisWindow = toWebKitBrowserWindow(clientInfo);
    auto page = WKViewGetPage(thisWindow.m_view.get());
    WKRetainPtr<WKURLRef> url = adoptWK(WKPageCopyActiveURL(page));
    thisWindow.m_client.activeURLChanged(createString(url.get()));
}

void WebKitBrowserWindow::didReceiveAuthenticationChallenge(WKPageRef page, WKAuthenticationChallengeRef challenge, const void* clientInfo)
{
    auto& thisWindow = toWebKitBrowserWindow(clientInfo);
    auto protectionSpace = WKAuthenticationChallengeGetProtectionSpace(challenge);
    auto decisionListener = WKAuthenticationChallengeGetDecisionListener(challenge);
    auto authenticationScheme = WKProtectionSpaceGetAuthenticationScheme(protectionSpace);

    if (authenticationScheme == kWKProtectionSpaceAuthenticationSchemeServerTrustEvaluationRequested) {
        if (thisWindow.canTrustServerCertificate(protectionSpace)) {
            WKRetainPtr<WKStringRef> username = createWKString("accept server trust");
            WKRetainPtr<WKStringRef> password = createWKString("");
            WKRetainPtr<WKCredentialRef> wkCredential = adoptWK(WKCredentialCreate(username.get(), password.get(), kWKCredentialPersistenceForSession));
            WKAuthenticationDecisionListenerUseCredential(decisionListener, wkCredential.get());
            return;
        }
    } else if (!s_headless) {
        WKRetainPtr<WKStringRef> realm(WKProtectionSpaceCopyRealm(protectionSpace));

        if (auto credential = askCredential(thisWindow.hwnd(), createString(realm.get()))) {
            WKRetainPtr<WKStringRef> username = createWKString(credential->username);
            WKRetainPtr<WKStringRef> password = createWKString(credential->password);
            WKRetainPtr<WKCredentialRef> wkCredential = adoptWK(WKCredentialCreate(username.get(), password.get(), kWKCredentialPersistenceForSession));
            WKAuthenticationDecisionListenerUseCredential(decisionListener, wkCredential.get());
            return;
        }
    }

    WKAuthenticationDecisionListenerUseCredential(decisionListener, nullptr);
}

bool WebKitBrowserWindow::canTrustServerCertificate(WKProtectionSpaceRef protectionSpace)
{
    auto host = createString(adoptWK(WKProtectionSpaceCopyHost(protectionSpace)).get());
    auto verificationError = WKProtectionSpaceGetCertificateVerificationError(protectionSpace);
    auto description = createString(adoptWK(WKProtectionSpaceCopyCertificateVerificationErrorDescription(protectionSpace)).get());
    auto pem = createPEMString(protectionSpace);

    auto it = m_acceptedServerTrustCerts.find(host);
    if (it != m_acceptedServerTrustCerts.end() && it->second == pem)
        return true;

    std::wstring textString = L"[HOST] " + host + L"\r\n";
    textString.append(L"[ERROR] " + std::to_wstring(verificationError) + L"\r\n");
    textString.append(L"[DESCRIPTION] " + description + L"\r\n");
    textString.append(pem);

    if (s_headless)
        return false;

    if (askServerTrustEvaluation(hwnd(), textString)) {
        m_acceptedServerTrustCerts.emplace(host, pem);
        return true;
    }

    return false;
}

void WebKitBrowserWindow::closeWindow(WKPageRef page, const void* clientInfo)
{
    auto& thisWindow = toWebKitBrowserWindow(clientInfo);
    PostMessage(thisWindow.m_hMainWnd, WM_CLOSE, 0, 0);
}

void WebKitBrowserWindow::runJavaScriptAlert(WKPageRef page, WKStringRef alertText, WKFrameRef frame, WKSecurityOriginRef securityOrigin, WKPageRunJavaScriptAlertResultListenerRef listener, const void *clientInfo)
{
    auto& thisWindow = toWebKitBrowserWindow(clientInfo);
    WKRetain(listener);
    thisWindow.m_alertDialog = listener;
}

void WebKitBrowserWindow::runJavaScriptConfirm(WKPageRef page, WKStringRef message, WKFrameRef frame, WKSecurityOriginRef securityOrigin, WKPageRunJavaScriptConfirmResultListenerRef listener, const void *clientInfo)
{
    auto& thisWindow = toWebKitBrowserWindow(clientInfo);
    WKRetain(listener);
    thisWindow.m_confirmDialog = listener;
}

void WebKitBrowserWindow::runJavaScriptPrompt(WKPageRef page, WKStringRef message, WKStringRef defaultValue, WKFrameRef frame, WKSecurityOriginRef securityOrigin, WKPageRunJavaScriptPromptResultListenerRef listener, const void *clientInfo)
{
    auto& thisWindow = toWebKitBrowserWindow(clientInfo);
    WKRetain(listener);
    thisWindow.m_promptDialog = listener;
}

void WebKitBrowserWindow::runBeforeUnloadConfirmPanel(WKPageRef page, WKStringRef message, WKFrameRef frame, WKPageRunBeforeUnloadConfirmPanelResultListenerRef listener, const void *clientInfo)
{
    auto& thisWindow = toWebKitBrowserWindow(clientInfo);
    WKRetain(listener);
    thisWindow.m_beforeUnloadDialog = listener;
}
    
void WebKitBrowserWindow::handleJavaScriptDialog(WKPageRef page, bool accept, WKStringRef value, const void *clientInfo)
{
    auto& thisWindow = toWebKitBrowserWindow(clientInfo);
    if (thisWindow.m_alertDialog) {
        WKPageRunJavaScriptAlertResultListenerCall(thisWindow.m_alertDialog);
        WKRelease(thisWindow.m_alertDialog);
        thisWindow.m_alertDialog = NULL;
    }

    if (thisWindow.m_confirmDialog) {
        WKPageRunJavaScriptConfirmResultListenerCall(thisWindow.m_confirmDialog, accept);
        WKRelease(thisWindow.m_confirmDialog);
        thisWindow.m_confirmDialog = NULL;
    }

    if (thisWindow.m_promptDialog) {
        WKPageRunJavaScriptPromptResultListenerCall(thisWindow.m_promptDialog, accept ? value : NULL);
        WKRelease(thisWindow.m_promptDialog);
        thisWindow.m_promptDialog = NULL;
    }

    if (thisWindow.m_beforeUnloadDialog) {
        WKPageRunBeforeUnloadConfirmPanelResultListenerCall(thisWindow.m_beforeUnloadDialog, accept);
        WKRelease(thisWindow.m_beforeUnloadDialog);
        thisWindow.m_beforeUnloadDialog = NULL;
    }
}

WKRect WebKitBrowserWindow::getWindowFrame(WKPageRef page, const void *clientInfo) {
    auto& thisWindow = toWebKitBrowserWindow(clientInfo);
    WKRect wkFrame { };
    RECT r;
    if (::GetWindowRect(thisWindow.m_hMainWnd, &r)) {
        wkFrame.origin.x = r.left;
        wkFrame.origin.y = r.top;
        wkFrame.size.width = r.right - r.left;
        wkFrame.size.height = r.bottom - r.top;
    }
    return wkFrame;
}

WKPageRef WebKitBrowserWindow::createPageCallback(WKPageConfigurationRef configuration)
{
    // This comes from the Playwright agent, configuration is a pool+data pair.
    return WebKitBrowserWindow::createViewCallback(configuration, true);
}

WKPageRef WebKitBrowserWindow::createViewCallback(WKPageConfigurationRef configuration, bool navigate)
{
    auto* newWindow = new MainWindow();
    bool ok = newWindow->init(hInst, configuration);
    if (navigate)
        newWindow->browserWindow()->loadURL(_bstr_t("about:blank").GetBSTR());

    auto* newBrowserWindow = newWindow->browserWindow();
    return WKViewGetPage(newBrowserWindow->m_view.get());
}


WKPageRef WebKitBrowserWindow::createNewPage(WKPageRef, WKPageConfigurationRef configuration, WKNavigationActionRef, WKWindowFeaturesRef, const void*)
{
    // This comes from the client for popups, configuration is inherited from main page.
    // Retain popups as per API contract.
    WKRetainPtr<WKPageRef> newPage = createViewCallback(configuration, false);
    return newPage.leakRef();
}

void WebKitBrowserWindow::didNotHandleKeyEvent(WKPageRef, WKNativeEventPtr event, const void* clientInfo)
{
    auto& thisWindow = toWebKitBrowserWindow(clientInfo);
    PostMessage(thisWindow.m_hMainWnd, event->message, event->wParam, event->lParam);
}

void WebKitBrowserWindow::decidePolicyForNavigationAction(WKPageRef page, WKFrameRef frame, WKFrameNavigationType navigationType, WKEventModifiers modifiers, WKEventMouseButton mouseButton, WKFrameRef originatingFrame, WKURLRequestRef request, WKFramePolicyListenerRef listener, WKTypeRef userData, const void* clientInfo)
{
    WebKitBrowserWindow* browserWindow = reinterpret_cast<WebKitBrowserWindow*>(const_cast<void*>(clientInfo));
    if (navigationType == kWKFrameNavigationTypeLinkClicked &&
        mouseButton == kWKEventMouseButtonLeftButton &&
        (modifiers & (kWKEventModifiersShiftKey | kWKEventModifiersControlKey)) != 0) {
        WKRetainPtr<WKPageRef> newPage = createViewCallback(WKPageCopyPageConfiguration(page), false);
        WKPageLoadURLRequest(newPage.get(), request);
        WKFramePolicyListenerIgnore(listener);
        return;
    }
    WKFramePolicyListenerUse(listener);
}

void WebKitBrowserWindow::decidePolicyForResponse(WKPageRef page, WKFrameRef frame, WKURLResponseRef response, WKURLRequestRef request, bool canShowMIMEType, WKFramePolicyListenerRef listener, WKTypeRef userData, const void* clientInfo)
{
    // Safari renders resources without content-type as text.
    if (WKURLResponseIsAttachment(response) || (!WKStringIsEmpty(WKURLResponseCopyMIMEType(response)) && !canShowMIMEType))
        WKFramePolicyListenerDownload(listener);
    else
        WKFramePolicyListenerUse(listener);
}
