/*
 * Copyright (C) 2010-2016 Apple Inc. All rights reserved.
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
 * THIS SOFTWARE IS PROVIDED BY APPLE INC. AND ITS CONTRIBUTORS ``AS IS''
 * AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO,
 * THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
 * PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL APPLE INC. OR ITS CONTRIBUTORS
 * BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
 * CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
 * SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
 * INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
 * CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
 * ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF
 * THE POSSIBILITY OF SUCH DAMAGE.
 */

#import "AppDelegate.h"

#import "BrowserWindowController.h"
#import <WebKit/WKNavigationActionPrivate.h>
#import <WebKit/WKNavigationDelegatePrivate.h>
#import <WebKit/WKPreferencesPrivate.h>
#import <WebKit/WKProcessPoolPrivate.h>
#import <WebKit/WKUserContentControllerPrivate.h>
#import <WebKit/WKWebViewConfigurationPrivate.h>
#import <WebKit/WKWebViewPrivate.h>
#import <WebKit/WKWebsiteDataStorePrivate.h>
#import <WebKit/WebNSURLExtras.h>
#import <WebKit/WebKit.h>
#import <WebKit/_WKDownload.h>
#import <WebKit/_WKExperimentalFeature.h>
#import <WebKit/_WKInternalDebugFeature.h>
#import <WebKit/_WKProcessPoolConfiguration.h>
#import <WebKit/_WKWebsiteDataStoreConfiguration.h>

@implementation NSApplication (PlaywrightApplicationExtensions)

- (BrowserAppDelegate *)browserAppDelegate
{
    return (BrowserAppDelegate *)[self delegate];
}

@end

@interface NSApplication (TouchBar)
@property (getter=isAutomaticCustomizeTouchBarMenuItemEnabled) BOOL automaticCustomizeTouchBarMenuItemEnabled;

@property (readonly, nonatomic) WKWebViewConfiguration *defaultConfiguration;

@end

@implementation WebViewDialog
- (void)dealloc
{
    [_webView release];
    _webView = nil;
    [super dealloc];
}
@end

enum {
    _NSBackingStoreUnbuffered = 3
};

NSString* const ActivityReason = @"Batch headless process";
const NSActivityOptions ActivityOptions =
    (NSActivityUserInitiatedAllowingIdleSystemSleep |
     NSActivityLatencyCritical) &
    ~(NSActivitySuddenTerminationDisabled |
    NSActivityAutomaticTerminationDisabled);

@implementation BrowserAppDelegate

- (id)init
{
    self = [super init];

    if (!self)
        return nil;

    _initialURL = nil;
    _userDataDir = nil;
    _proxyServer = nil;
    _proxyBypassList = nil;
    NSArray *arguments = [[NSProcessInfo processInfo] arguments];
    NSRange subargs = NSMakeRange(1, [arguments count] - 1);
    NSArray *subArray = [arguments subarrayWithRange:subargs];

    for (NSString *argument in subArray) {
        if (![argument hasPrefix:@"--"])
            _initialURL = argument;
        if ([argument hasPrefix:@"--user-data-dir="]) {
            NSRange range = NSMakeRange(16, [argument length] - 16);
            _userDataDir = [[argument substringWithRange:range] copy];
        }
        if ([argument hasPrefix:@"--proxy="]) {
            NSRange range = NSMakeRange(8, [argument length] - 8);
            _proxyServer = [[argument substringWithRange:range] copy];
        }
        if ([argument hasPrefix:@"--proxy-bypass-list="]) {
            NSRange range = NSMakeRange(20, [argument length] - 20);
            _proxyBypassList = [[argument substringWithRange:range] copy];
        }
    }

    _headless = [arguments containsObject: @"--headless"];
    _noStartupWindow = [arguments containsObject: @"--no-startup-window"];
    _browserContexts = [[NSMutableSet alloc] init];

    if (_headless) {
        _headlessWindows = [[NSMutableSet alloc] init];
        [NSApp setActivationPolicy:NSApplicationActivationPolicyAccessory];
        [[NSProcessInfo processInfo] beginActivityWithOptions:ActivityOptions
                                                       reason:ActivityReason];
        _dialogs = [[NSMutableSet alloc] init];
    } else {
        [NSApp activateIgnoringOtherApps:YES];
    }
    if ([arguments containsObject: @"--inspector-pipe"])
        [_WKBrowserInspector initializeRemoteInspectorPipe:self headless:_headless];
    return self;
}

- (void)awakeFromNib
{
    if ([NSApp respondsToSelector:@selector(setAutomaticCustomizeTouchBarMenuItemEnabled:)])
        [NSApp setAutomaticCustomizeTouchBarMenuItemEnabled:YES];
}


- (NSDictionary *)proxyConfiguration:(NSString *)proxyServer WithBypassList:(NSString *)proxyBypassList
{
    if (!proxyServer || ![proxyServer length])
        return nil;

#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Wdeprecated-declarations"

    NSMutableDictionary *dictionary = [[[NSMutableDictionary alloc] init] autorelease];
    NSURL *proxyURL = [NSURL URLWithString:proxyServer];
    NSString *host = [proxyURL host];
    NSNumber *port = [proxyURL port];
    if ([proxyServer hasPrefix:@"socks5://"]) {
        [dictionary setObject:host forKey:(NSString *)kCFStreamPropertySOCKSProxyHost];
        if (port)
            [dictionary setObject:port forKey:(NSString *)kCFStreamPropertySOCKSProxyPort];
    } else {
        [dictionary setObject:host forKey:(NSString *)kCFStreamPropertyHTTPSProxyHost];
        [dictionary setObject:host forKey:(NSString *)kCFStreamPropertyHTTPProxyHost];
        if (port) {
            [dictionary setObject:port forKey:(NSString *)kCFStreamPropertyHTTPSProxyPort];
            [dictionary setObject:port forKey:(NSString *)kCFStreamPropertyHTTPProxyPort];
        }
    }

    if (proxyBypassList && [proxyBypassList length]) {
        NSArray* bypassList = [proxyBypassList componentsSeparatedByString:@","];
        [dictionary setObject:bypassList forKey:@"ExceptionsList"];
    }

#pragma clang diagnostic pop

    return dictionary;
}

- (WKWebsiteDataStore *)persistentDataStore
{
    static WKWebsiteDataStore *dataStore;

    if (!dataStore) {
        _WKWebsiteDataStoreConfiguration *configuration = [[[_WKWebsiteDataStoreConfiguration alloc] init] autorelease];
        if (_userDataDir) {
            // Local storage state should be stored in separate dirs for persistent contexts.
            [configuration setUnifiedOriginStorageLevel:_WKUnifiedOriginStorageLevelNone];

            NSURL *cookieFile = [NSURL fileURLWithPath:[NSString stringWithFormat:@"%@/cookie.db", _userDataDir]];
            [configuration _setCookieStorageFile:cookieFile];

            NSURL *applicationCacheDirectory = [NSURL fileURLWithPath:[NSString stringWithFormat:@"%@/ApplicationCache", _userDataDir]];
            [configuration setApplicationCacheDirectory:applicationCacheDirectory];

            NSURL *cacheStorageDirectory = [NSURL fileURLWithPath:[NSString stringWithFormat:@"%@/CacheStorage", _userDataDir]];
            [configuration _setCacheStorageDirectory:cacheStorageDirectory];

            NSURL *indexedDBDirectory = [NSURL fileURLWithPath:[NSString stringWithFormat:@"%@/IndexedDB", _userDataDir]];
            [configuration _setIndexedDBDatabaseDirectory:indexedDBDirectory];

            NSURL *localStorageDirectory = [NSURL fileURLWithPath:[NSString stringWithFormat:@"%@/LocalStorage", _userDataDir]];
            [configuration _setWebStorageDirectory:localStorageDirectory];

            NSURL *mediaCacheDirectory = [NSURL fileURLWithPath:[NSString stringWithFormat:@"%@/MediaCache", _userDataDir]];
            [configuration setMediaCacheDirectory:mediaCacheDirectory];

            NSURL *mediaKeysDirectory = [NSURL fileURLWithPath:[NSString stringWithFormat:@"%@/MediaKeys", _userDataDir]];
            [configuration setMediaKeysStorageDirectory:mediaKeysDirectory];

            NSURL *networkCacheDirectory = [NSURL fileURLWithPath:[NSString stringWithFormat:@"%@/NetworkCache", _userDataDir]];
            [configuration setNetworkCacheDirectory:networkCacheDirectory];

            NSURL *loadStatsDirectory = [NSURL fileURLWithPath:[NSString stringWithFormat:@"%@/ResourceLoadStatistics", _userDataDir]];
            [configuration _setResourceLoadStatisticsDirectory:loadStatsDirectory];

            NSURL *serviceWorkersDirectory = [NSURL fileURLWithPath:[NSString stringWithFormat:@"%@/ServiceWorkers", _userDataDir]];
            [configuration _setServiceWorkerRegistrationDirectory:serviceWorkersDirectory];

            NSURL *webSqlDirectory = [NSURL fileURLWithPath:[NSString stringWithFormat:@"%@/WebSQL", _userDataDir]];
            [configuration _setWebSQLDatabaseDirectory:webSqlDirectory];
        }
        [configuration setProxyConfiguration:[self proxyConfiguration:_proxyServer WithBypassList:_proxyBypassList]];
        dataStore = [[WKWebsiteDataStore alloc] _initWithConfiguration:configuration];
    }

    return dataStore;
}

- (WKWebViewConfiguration *)defaultConfiguration
{
    static WKWebViewConfiguration *configuration;

    if (!configuration) {
        configuration = [[WKWebViewConfiguration alloc] init];
        configuration.websiteDataStore = [self persistentDataStore];
        configuration._controlledByAutomation = true;
        configuration.preferences._fullScreenEnabled = YES;
        configuration.preferences._developerExtrasEnabled = YES;
        configuration.preferences._mediaDevicesEnabled = YES;
        configuration.preferences._mockCaptureDevicesEnabled = YES;
        // Enable WebM support.
        configuration.preferences._alternateWebMPlayerEnabled = YES;
        configuration.preferences._hiddenPageDOMTimerThrottlingEnabled = NO;
        configuration.preferences._hiddenPageDOMTimerThrottlingAutoIncreases = NO;
        configuration.preferences._pageVisibilityBasedProcessSuppressionEnabled = NO;
        configuration.preferences._domTimersThrottlingEnabled = NO;
        _WKProcessPoolConfiguration *processConfiguration = [[[_WKProcessPoolConfiguration alloc] init] autorelease];
        processConfiguration.forceOverlayScrollbars = YES;
        configuration.processPool = [[[WKProcessPool alloc] _initWithConfiguration:processConfiguration] autorelease];
    }
    return configuration;
}

- (void)applicationDidFinishLaunching:(NSNotification *)aNotification
{
    if (!_headless)
        [self _updateNewWindowKeyEquivalents];

    if (_noStartupWindow)
        return;

    // Force creation of the default browser context.
    [self defaultConfiguration];
    // Creating the first NSWindow immediately makes it invisible in headless mode,
    // so we postpone it for 50ms. Experiments show that 10ms is not enough, and 20ms is enough.
    // We give it 50ms just in case.
    [NSTimer scheduledTimerWithTimeInterval: 0.05
                                    repeats: NO
                                      block:(void *)^(NSTimer* timer)
    {
        [self createNewPage:0 withURL:_initialURL ? _initialURL : @"about:blank"];
        _initialURL = nil;
    }];
}

- (void)_updateNewWindowKeyEquivalents
{
    NSString *normalWindowEquivalent = @"n";
    _newWebKit2WindowItem.keyEquivalentModifierMask = NSEventModifierFlagCommand;
    _newWebKit2WindowItem.keyEquivalent = normalWindowEquivalent;
}

#pragma mark WKBrowserInspectorDelegate

- (WKWebViewConfiguration *) sessionConfiguration:(uint64_t)sessionID
{
    for (_WKBrowserContext *browserContext in _browserContexts) {
        if ([[browserContext dataStore] sessionID] != sessionID)
            continue;
        WKWebViewConfiguration *configuration = [[[self defaultConfiguration] copy] autorelease];
        configuration.websiteDataStore = [browserContext dataStore];
        configuration.processPool = [browserContext processPool];
        return configuration;
    }
    return [self defaultConfiguration];
}

- (WKWebView *)createNewPage:(uint64_t)sessionID
{
    return [self createNewPage:sessionID withURL:@"about:blank"];
}

- (WKWebView *)createNewPage:(uint64_t)sessionID withURL:(NSString*)urlString
{
    WKWebViewConfiguration *configuration = [self sessionConfiguration:sessionID];
    if (_headless)
        return [self createHeadlessPage:configuration withURL:urlString];
    return [self createHeadfulPage:configuration withURL:urlString];
}

- (WKWebView *)createHeadfulPage:(WKWebViewConfiguration *)configuration withURL:(NSString*)urlString
{
    // WebView lifecycle will control the BrowserWindowController life times.
    BrowserWindowController *controller = [[BrowserWindowController alloc] initWithConfiguration:configuration];
    if (!controller)
        return nil;
    [controller loadURLString:urlString];
    NSWindow *window = controller.window;
    [window setIsVisible:YES];
    return [controller webView];
}

- (WKWebView *)createHeadlessPage:(WKWebViewConfiguration *)configuration withURL:(NSString*)urlString
{
    NSRect rect = NSMakeRect(0, 0, 1280, 720);
    NSScreen *firstScreen = [[NSScreen screens] objectAtIndex:0];
    NSRect windowRect = NSOffsetRect(rect, -10000, [firstScreen frame].size.height - rect.size.height + 10000);
    NSWindow* window = [[NSWindow alloc] initWithContentRect:windowRect styleMask:NSWindowStyleMaskBorderless backing:(NSBackingStoreType)_NSBackingStoreUnbuffered defer:YES];

    WKWebView* webView = [[WKWebView alloc] initWithFrame:[window.contentView bounds] configuration:configuration];
    webView._windowOcclusionDetectionEnabled = NO;
    if (!webView)
        return nil;

    webView.autoresizingMask = NSViewWidthSizable | NSViewHeightSizable;
    [window.contentView addSubview:webView];
    [window setIsVisible:YES];
    if (urlString) {
        NSURL *url = [NSURL _webkit_URLWithUserTypedString:urlString];
        [webView loadRequest:[NSURLRequest requestWithURL:url]];
    }
    [_headlessWindows addObject:window];
    webView.navigationDelegate = self;
    webView.UIDelegate = self;
    return [webView autorelease];
}

- (_WKBrowserContext *)createBrowserContext:(NSString *)proxyServer WithBypassList:(NSString *) proxyBypassList
{
    _WKBrowserContext *browserContext = [[_WKBrowserContext alloc] init];
    _WKProcessPoolConfiguration *processConfiguration = [[[_WKProcessPoolConfiguration alloc] init] autorelease];
    processConfiguration.forceOverlayScrollbars = YES;
    _WKWebsiteDataStoreConfiguration *dataStoreConfiguration = [[[_WKWebsiteDataStoreConfiguration alloc] initNonPersistentConfiguration] autorelease];
    if (!proxyServer || ![proxyServer length])
        proxyServer = _proxyServer;
    if (!proxyBypassList || ![proxyBypassList length])
        proxyBypassList = _proxyBypassList;
    [dataStoreConfiguration setProxyConfiguration:[self proxyConfiguration:proxyServer WithBypassList:proxyBypassList]];
    browserContext.dataStore = [[[WKWebsiteDataStore alloc] _initWithConfiguration:dataStoreConfiguration] autorelease];
    browserContext.processPool = [[[WKProcessPool alloc] _initWithConfiguration:processConfiguration] autorelease];
    [_browserContexts addObject:browserContext];
    return browserContext;
}

- (void)deleteBrowserContext:(uint64_t)sessionID
{
    for (_WKBrowserContext *browserContext in _browserContexts) {
        if ([[browserContext dataStore] sessionID] != sessionID)
            continue;
        [_browserContexts removeObject:browserContext];
        return;
    }
}

- (void)quit
{
    [NSApp performSelector:@selector(terminate:) withObject:nil afterDelay:0.0];
}

#pragma mark WKUIDelegate

- (void)webViewDidClose:(WKWebView *)webView {
    [self webView:webView handleJavaScriptDialog:false value:nil];
    for (NSWindow *window in _headlessWindows) {
        if (webView.window != window)
            continue;
        [webView removeFromSuperview];
        [window close];
        [_headlessWindows removeObject:window];
        break;
    }
}

- (void)_webView:(WKWebView *)webView getWindowFrameWithCompletionHandler:(void (^)(CGRect))completionHandler
{
    completionHandler([webView.window frame]);
}

- (void)webView:(WKWebView *)webView runJavaScriptAlertPanelWithMessage:(NSString *)message initiatedByFrame:(WKFrameInfo *)frame completionHandler:(void (^)(void))completionHandler
{
    WebViewDialog* dialog = [[WebViewDialog alloc] autorelease];
    dialog.webView = webView;
    dialog.completionHandler = ^void (BOOL accept, NSString* value) {
        completionHandler();
    };
    [_dialogs addObject:dialog];
}

- (void)webView:(WKWebView *)webView runJavaScriptConfirmPanelWithMessage:(NSString *)message initiatedByFrame:(WKFrameInfo *)frame completionHandler:(void (^)(BOOL result))completionHandler
{
    WebViewDialog* dialog = [[WebViewDialog alloc] autorelease];
    dialog.webView = webView;
    dialog.completionHandler = ^void (BOOL accept, NSString* value) {
        completionHandler(accept);
    };
    [_dialogs addObject:dialog];
}

- (void)webView:(WKWebView *)webView runJavaScriptTextInputPanelWithPrompt:(NSString *)prompt defaultText:(NSString *)defaultText initiatedByFrame:(WKFrameInfo *)frame completionHandler:(void (^)(NSString *result))completionHandler
{
    WebViewDialog* dialog = [[WebViewDialog alloc] autorelease];
    dialog.webView = webView;
    dialog.completionHandler = ^void (BOOL accept, NSString* value) {
        completionHandler(accept && value ? value : nil);
    };
    [_dialogs addObject:dialog];
}

- (void)_webView:(WKWebView *)webView runBeforeUnloadConfirmPanelWithMessage:(NSString *)message initiatedByFrame:(WKFrameInfo *)frame completionHandler:(void (^)(BOOL result))completionHandler
{
    WebViewDialog* dialog = [[WebViewDialog alloc] autorelease];
    dialog.webView = webView;
    dialog.completionHandler = ^void (BOOL accept, NSString* value) {
        completionHandler(accept);
    };
    [_dialogs addObject:dialog];
}

- (void)webView:(WKWebView *)webView handleJavaScriptDialog:(BOOL)accept value:(NSString *)value
{
    for (WebViewDialog *dialog in _dialogs) {
        if (dialog.webView != webView)
            continue;
        dialog.completionHandler(accept, value);
        [_dialogs removeObject:dialog];
        break;
    }
}

- (nullable WKWebView *)webView:(WKWebView *)webView createWebViewWithConfiguration:(WKWebViewConfiguration *)configuration forNavigationAction:(WKNavigationAction *)navigationAction windowFeatures:(WKWindowFeatures *)windowFeatures
{
    return [self createHeadlessPage:configuration withURL:nil];
}

- (void)webView:(WKWebView *)webView decidePolicyForNavigationAction:(WKNavigationAction *)navigationAction decisionHandler:(void (^)(WKNavigationActionPolicy))decisionHandler
{
    LOG(@"decidePolicyForNavigationAction");

    if (navigationAction.shouldPerformDownload) {
        decisionHandler(WKNavigationActionPolicyDownload);
        return;
    }

    if (navigationAction.buttonNumber == 1 &&
        (navigationAction.modifierFlags & (NSEventModifierFlagCommand | NSEventModifierFlagShift)) != 0) {
        WKWindowFeatures* windowFeatures = [[[WKWindowFeatures alloc] init] autorelease];
        WKWebView* newView = [self webView:webView createWebViewWithConfiguration:webView.configuration forNavigationAction:navigationAction windowFeatures:windowFeatures];
        [newView loadRequest:navigationAction.request];
        decisionHandler(WKNavigationActionPolicyCancel);
        return;
    }

    if (navigationAction._canHandleRequest) {
        decisionHandler(WKNavigationActionPolicyAllow);
        return;
    }
    decisionHandler(WKNavigationActionPolicyCancel);
}

- (void)webView:(WKWebView *)webView decidePolicyForNavigationResponse:(WKNavigationResponse *)navigationResponse decisionHandler:(void (^)(WKNavigationResponsePolicy))decisionHandler
{
    if (![navigationResponse.response isKindOfClass:[NSHTTPURLResponse class]]) {
      decisionHandler(WKNavigationResponsePolicyAllow);
      return;
    }

    NSHTTPURLResponse *httpResponse = (NSHTTPURLResponse *)navigationResponse.response;

    NSString *contentType = [httpResponse valueForHTTPHeaderField:@"Content-Type"];
    if (!navigationResponse.canShowMIMEType && (contentType && [contentType length] > 0)) {
        decisionHandler(WKNavigationResponsePolicyDownload);
        return;
    }

    if (contentType && ([contentType isEqualToString:@"application/pdf"] || [contentType isEqualToString:@"text/pdf"])) {
        decisionHandler(WKNavigationResponsePolicyDownload);
        return;
    }

    NSString *disposition = [[httpResponse allHeaderFields] objectForKey:@"Content-Disposition"];
    if (disposition && [disposition hasPrefix:@"attachment"]) {
        decisionHandler(WKNavigationResponsePolicyDownload);
        return;
    }
    decisionHandler(WKNavigationResponsePolicyAllow);
}

- (void)webView:(WKWebView *)webView navigationAction:(WKNavigationAction *)navigationAction didBecomeDownload:(WKDownload *)download
{
    download.delegate = self;
}

- (void)webView:(WKWebView *)webView navigationResponse:(WKNavigationResponse *)navigationResponse didBecomeDownload:(WKDownload *)download
{
    download.delegate = self;
}

// Always automatically accept requestStorageAccess dialog.
- (void)_webView:(WKWebView *)webView requestStorageAccessPanelForDomain:(NSString *)requestingDomain underCurrentDomain:(NSString *)currentDomain completionHandler:(void (^)(BOOL result))completionHandler
{
    completionHandler(true);
}

#pragma mark WKDownloadDelegate

- (void)download:(WKDownload *)download decideDestinationUsingResponse:(NSURLResponse *)response suggestedFilename:(NSString *)suggestedFilename completionHandler:(void (^)(NSURL * _Nullable destination))completionHandler
{
    completionHandler(nil);
}

@end
