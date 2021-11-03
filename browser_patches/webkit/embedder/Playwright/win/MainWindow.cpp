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
#include <WebKit/WKPreferencesRefPrivate.h>
#include <sstream>

namespace WebCore {
float deviceScaleFactorForWindow(HWND);
}

static const wchar_t* kPlaywrightRegistryKey = L"Software\\WebKit\\Playwright";

static constexpr int kToolbarImageSize = 24;
static constexpr int kToolbarURLBarIndex = 3;

static WNDPROC DefEditProc = nullptr;

static LRESULT CALLBACK EditProc(HWND, UINT, WPARAM, LPARAM);
static INT_PTR CALLBACK About(HWND, UINT, WPARAM, LPARAM);

std::wstring MainWindow::s_windowClass;
size_t MainWindow::s_numInstances;

bool MainWindow::s_headless = false;
bool MainWindow::s_controlledRemotely = false;
bool MainWindow::s_disableAcceleratedCompositing = false;

void MainWindow::configure(bool headless, bool controlledRemotely, bool disableAcceleratedCompositing) {
    s_headless = headless;
    s_controlledRemotely = controlledRemotely;
    s_disableAcceleratedCompositing = disableAcceleratedCompositing;
}

static std::wstring loadString(int id)
{
    constexpr size_t length = 100;
    wchar_t buff[length];
    LoadString(hInst, id, buff, length);
    return buff;
}

void MainWindow::registerClass(HINSTANCE hInstance)
{
    static bool initialized = false;
    if (initialized)
        return;
    initialized = true;

    s_windowClass = loadString(IDC_PLAYWRIGHT);

    WNDCLASSEX wcex;
    wcex.cbSize = sizeof(WNDCLASSEX);
    wcex.style          = CS_HREDRAW | CS_VREDRAW;
    wcex.lpfnWndProc    = WndProc;
    wcex.cbClsExtra     = 0;
    wcex.cbWndExtra     = 0;
    wcex.hInstance      = hInstance;
    wcex.hIcon          = LoadIcon(hInstance, MAKEINTRESOURCE(IDI_PLAYWRIGHT));
    wcex.hCursor        = LoadCursor(0, IDC_ARROW);
    wcex.hbrBackground  = 0;
    wcex.lpszMenuName   = MAKEINTRESOURCE(IDC_PLAYWRIGHT);
    wcex.lpszClassName  = s_windowClass.c_str();
    wcex.hIconSm        = LoadIcon(wcex.hInstance, MAKEINTRESOURCE(IDI_PLAYWRIGHT));

    RegisterClassEx(&wcex);
}

bool MainWindow::isInstance(HWND hwnd)
{
    wchar_t buff[64];
    if (!GetClassName(hwnd, buff, _countof(buff)))
        return false;
    return s_windowClass == buff;
}

MainWindow::MainWindow()
{
    s_numInstances++;
}

MainWindow::~MainWindow()
{
    s_numInstances--;
}

void MainWindow::createToolbar(HINSTANCE hInstance)
{
    m_hToolbarWnd = CreateWindowEx(0, TOOLBARCLASSNAME, nullptr, 
        WS_CHILD | WS_BORDER | TBSTYLE_FLAT | TBSTYLE_LIST | TBSTYLE_TOOLTIPS, 0, 0, 0, 0, 
        m_hMainWnd, nullptr, hInstance, nullptr);
        
    if (!m_hToolbarWnd)
        return;

    const int ImageListID = 0;

    HIMAGELIST hImageList;
    hImageList = ImageList_LoadImage(hInstance, MAKEINTRESOURCE(IDB_TOOLBAR), kToolbarImageSize, 0, CLR_DEFAULT, IMAGE_BITMAP, 0);

    SendMessage(m_hToolbarWnd, TB_SETIMAGELIST, ImageListID, reinterpret_cast<LPARAM>(hImageList));
    SendMessage(m_hToolbarWnd, TB_SETEXTENDEDSTYLE, 0, TBSTYLE_EX_MIXEDBUTTONS);

    const DWORD buttonStyles = BTNS_AUTOSIZE;

    TBBUTTON tbButtons[] = {
        { MAKELONG(0, ImageListID), IDM_HISTORY_BACKWARD, TBSTATE_ENABLED, buttonStyles, { }, 0, (INT_PTR)L"Back" },
        { MAKELONG(1, ImageListID), IDM_HISTORY_FORWARD, TBSTATE_ENABLED, buttonStyles, { }, 0, (INT_PTR)L"Forward"},
        { MAKELONG(2, ImageListID), IDM_RELOAD, TBSTATE_ENABLED, buttonStyles, { }, 0, (INT_PTR)L"Reload"},
        { 0, 0, TBSTATE_ENABLED, BTNS_SEP, { }, 0, 0}, // URL bar
    };

    SendMessage(m_hToolbarWnd, TB_BUTTONSTRUCTSIZE, sizeof(TBBUTTON), 0);
    SendMessage(m_hToolbarWnd, TB_ADDBUTTONS, _countof(tbButtons), reinterpret_cast<LPARAM>(&tbButtons));
    ShowWindow(m_hToolbarWnd, true);

    m_hURLBarWnd = CreateWindow(L"EDIT", 0, WS_CHILD | WS_VISIBLE | WS_BORDER | ES_LEFT | ES_AUTOVSCROLL, 0, 0, 0, 0, m_hToolbarWnd, 0, hInstance, 0);

    DefEditProc = reinterpret_cast<WNDPROC>(GetWindowLongPtr(m_hURLBarWnd, GWLP_WNDPROC));
    SetWindowLongPtr(m_hURLBarWnd, GWLP_WNDPROC, reinterpret_cast<LONG_PTR>(EditProc));
}

void MainWindow::resizeToolbar(int parentWidth)
{
    TBBUTTONINFO info { sizeof(TBBUTTONINFO), TBIF_BYINDEX | TBIF_SIZE };
    info.cx = parentWidth - m_toolbarItemsWidth;
    SendMessage(m_hToolbarWnd, TB_SETBUTTONINFO, kToolbarURLBarIndex, reinterpret_cast<LPARAM>(&info));
    SendMessage(m_hToolbarWnd, TB_AUTOSIZE, 0, 0);

    RECT rect;
    SendMessage(m_hToolbarWnd, TB_GETITEMRECT, kToolbarURLBarIndex, reinterpret_cast<LPARAM>(&rect));
    MoveWindow(m_hURLBarWnd, rect.left, rect.top, rect.right - rect.left, rect.bottom - rect.top, true);
}

void MainWindow::rescaleToolbar()
{
    const float scaleFactor = WebCore::deviceScaleFactorForWindow(m_hMainWnd);
    const int scaledImageSize = kToolbarImageSize * scaleFactor;

    TBBUTTONINFO info { sizeof(TBBUTTONINFO), TBIF_BYINDEX | TBIF_SIZE };

    info.cx = 0;
    SendMessage(m_hToolbarWnd, TB_SETBUTTONINFO, kToolbarURLBarIndex, reinterpret_cast<LPARAM>(&info));
    SendMessage(m_hToolbarWnd, TB_AUTOSIZE, 0, 0);

    int numItems = SendMessage(m_hToolbarWnd, TB_BUTTONCOUNT, 0, 0);

    RECT rect;
    SendMessage(m_hToolbarWnd, TB_GETITEMRECT, numItems-1, reinterpret_cast<LPARAM>(&rect));
    m_toolbarItemsWidth = rect.right;
}

bool MainWindow::init(HINSTANCE hInstance, WKPageConfigurationRef conf)
{
    auto prefs = adoptWK(WKPreferencesCreate());

    WKPageConfigurationSetPreferences(conf, prefs.get());
    WKPreferencesSetMediaCapabilitiesEnabled(prefs.get(), false);
    WKPreferencesSetDeveloperExtrasEnabled(prefs.get(), true);
    if (s_disableAcceleratedCompositing)
      WKPreferencesSetAcceleratedCompositingEnabled(prefs.get(), false);

    m_configuration = conf;

    registerClass(hInstance);

    auto title = loadString(IDS_APP_TITLE);

    m_hMainWnd = CreateWindowExW(s_headless ? WS_EX_NOACTIVATE : 0, s_windowClass.c_str(), title.c_str(),
        WS_OVERLAPPEDWINDOW, CW_USEDEFAULT, 0, CW_USEDEFAULT, 0, 0, 0, hInstance, this);

    if (!m_hMainWnd)
        return false;

    if (!s_headless) {
      createToolbar(hInstance);
      if (!m_hToolbarWnd)
          return false;
    }

    m_browserWindow.reset(new WebKitBrowserWindow(*this, m_hMainWnd, conf));

    updateDeviceScaleFactor();
    resizeSubViews();

    if (s_headless) {
        SetMenu(m_hMainWnd, NULL);
    } else {
        SetFocus(m_hURLBarWnd);
        ShowWindow(m_hMainWnd, SW_SHOW);
    }
    return true;
}

void MainWindow::resizeSubViews()
{
    RECT rcClient;
    GetClientRect(m_hMainWnd, &rcClient);
    if (s_headless) {
        MoveWindow(m_browserWindow->hwnd(), 0, 0, rcClient.right, rcClient.bottom, true);
        return;
    }

    resizeToolbar(rcClient.right);

    RECT rect;
    GetWindowRect(m_hToolbarWnd, &rect);
    POINT toolbarBottom = { 0, rect.bottom };
    ScreenToClient(m_hMainWnd, &toolbarBottom);
    auto height = toolbarBottom.y;
    MoveWindow(m_browserWindow->hwnd(), 0, height, rcClient.right, rcClient.bottom - height, true);
}

LRESULT CALLBACK MainWindow::WndProc(HWND hWnd, UINT message, WPARAM wParam, LPARAM lParam)
{
    LRESULT result = 0;
    MainWindow* thisWindow = reinterpret_cast<MainWindow*>(GetWindowLongPtr(hWnd, GWLP_USERDATA));
    if (!thisWindow && message != WM_CREATE)
        return DefWindowProc(hWnd, message, wParam, lParam);

    switch (message) {
    case WM_ACTIVATE:
        switch (LOWORD(wParam)) {
        case WA_ACTIVE:
        case WA_CLICKACTIVE:
            SetFocus(thisWindow->browserWindow()->hwnd());
        }
        break;
    case WM_CREATE:
        SetWindowLongPtr(hWnd, GWLP_USERDATA, reinterpret_cast<LONG_PTR>(reinterpret_cast<LPCREATESTRUCT>(lParam)->lpCreateParams));
        break;
    case WM_APPCOMMAND: {
        auto cmd = GET_APPCOMMAND_LPARAM(lParam);
        switch (cmd) {
        case APPCOMMAND_BROWSER_BACKWARD:
            thisWindow->browserWindow()->navigateForwardOrBackward(false);
            result = 1;
            break;
        case APPCOMMAND_BROWSER_FORWARD:
            thisWindow->browserWindow()->navigateForwardOrBackward(true);
            result = 1;
            break;
        case APPCOMMAND_BROWSER_REFRESH:
            thisWindow->browserWindow()->reload();
            result = 1;
            break;
        case APPCOMMAND_BROWSER_STOP:
            break;
        }
        break;
    }
    case WM_COMMAND: {
        int wmId = LOWORD(wParam);
        int wmEvent = HIWORD(wParam);
        switch (wmEvent) {
        case 0: // Menu or BN_CLICKED
        case 1: // Accelerator
            break;
        default:
            return DefWindowProc(hWnd, message, wParam, lParam);
        }
        // Parse the menu selections:
        switch (wmId) {
        case IDC_URL_BAR:
            thisWindow->onURLBarEnter();
            break;
        case IDM_NEW_WINDOW: {
            auto* newWindow = new MainWindow();
            newWindow->init(hInst, thisWindow->m_configuration.get());
            break;
        }
        case IDM_CLOSE_WINDOW:
            PostMessage(hWnd, WM_CLOSE, 0, 0);
            break;
        case IDM_ABOUT:
            DialogBox(hInst, MAKEINTRESOURCE(IDD_ABOUTBOX), hWnd, About);
            break;
        case IDM_WEB_INSPECTOR:
            thisWindow->browserWindow()->launchInspector();
            break;
        case IDM_HISTORY_BACKWARD:
        case IDM_HISTORY_FORWARD:
            thisWindow->browserWindow()->navigateForwardOrBackward(wmId == IDM_HISTORY_FORWARD);
            break;
        case IDM_ACTUAL_SIZE:
            thisWindow->browserWindow()->resetZoom();
            break;
        case IDM_RELOAD:
            thisWindow->browserWindow()->reload();
            break;
        case IDM_ZOOM_IN:
            thisWindow->browserWindow()->zoomIn();
            break;
        case IDM_ZOOM_OUT:
            thisWindow->browserWindow()->zoomOut();
            break;
        default:
            if (!thisWindow->toggleMenuItem(wmId))
                return DefWindowProc(hWnd, message, wParam, lParam);
        }
        }
        break;
    case WM_NCDESTROY:
        SetWindowLongPtr(hWnd, GWLP_USERDATA, 0);
        delete thisWindow;
        if (s_controlledRemotely || s_numInstances > 0)
            return 0;
        PostQuitMessage(0);
        break;
    case WM_SIZE:
        thisWindow->resizeSubViews();
        break;
    case WM_DPICHANGED: {
        thisWindow->updateDeviceScaleFactor();
        auto& rect = *reinterpret_cast<RECT*>(lParam);
        SetWindowPos(hWnd, nullptr, rect.left, rect.top, rect.right - rect.left, rect.bottom - rect.top, SWP_NOZORDER | SWP_NOACTIVATE);
        break;
    }
    default:
        return DefWindowProc(hWnd, message, wParam, lParam);
    }

    return result;
}

static bool menuItemIsChecked(const MENUITEMINFO& info)
{
    return info.fState & MFS_CHECKED;
}

bool MainWindow::toggleMenuItem(UINT menuID)
{
    if (s_headless)
        return (INT_PTR)FALSE;

    HMENU menu = ::GetMenu(hwnd());

    MENUITEMINFO info = { };
    info.cbSize = sizeof(info);
    info.fMask = MIIM_STATE;

    if (!::GetMenuItemInfo(menu, menuID, FALSE, &info))
        return false;

    BOOL newState = !menuItemIsChecked(info);
    info.fState = (newState) ? MFS_CHECKED : MFS_UNCHECKED;
    ::SetMenuItemInfo(menu, menuID, FALSE, &info);

    return true;
}

LRESULT CALLBACK EditProc(HWND hWnd, UINT message, WPARAM wParam, LPARAM lParam)
{
    switch (message) {
    case WM_SETFOCUS:
        PostMessage(hWnd, EM_SETSEL, 0, -1);
        break;
    case WM_CHAR:
        if (wParam == 13) {
            // Enter Key
            ::PostMessage(GetParent(hWnd), static_cast<UINT>(WM_COMMAND), MAKELPARAM(IDC_URL_BAR, 0), 0);
            return 0;
        }
        break;
    }
    return CallWindowProc(DefEditProc, hWnd, message, wParam, lParam);
}

// Message handler for about box.
INT_PTR CALLBACK About(HWND hDlg, UINT message, WPARAM wParam, LPARAM lParam)
{
    UNREFERENCED_PARAMETER(lParam);
    switch (message) {
    case WM_INITDIALOG:
        return (INT_PTR)TRUE;

    case WM_COMMAND:
        if (LOWORD(wParam) == IDOK || LOWORD(wParam) == IDCANCEL) {
            EndDialog(hDlg, LOWORD(wParam));
            return (INT_PTR)TRUE;
        }
        break;
    }
    return (INT_PTR)FALSE;
}

void MainWindow::loadURL(std::wstring url)
{
    if (::PathFileExists(url.c_str()) || ::PathIsUNC(url.c_str())) {
        wchar_t fileURL[INTERNET_MAX_URL_LENGTH];
        DWORD fileURLLength = _countof(fileURL);

        if (SUCCEEDED(::UrlCreateFromPath(url.c_str(), fileURL, &fileURLLength, 0)))
            url = fileURL;
    }
    if (url.find(L"://") == url.npos && url.find(L"about:blank") == url.npos)
        url = L"http://" + url;

    if (FAILED(m_browserWindow->loadURL(_bstr_t(url.c_str()))))
        return;

    if (!s_headless)
        SetFocus(m_browserWindow->hwnd());
}

void MainWindow::onURLBarEnter()
{
    if (s_headless)
        return;
    wchar_t url[INTERNET_MAX_URL_LENGTH];
    GetWindowText(m_hURLBarWnd, url, INTERNET_MAX_URL_LENGTH);
    loadURL(url);
}

void MainWindow::updateDeviceScaleFactor()
{
    if (s_headless)
        return;
    if (m_hURLBarFont)
        ::DeleteObject(m_hURLBarFont);

    rescaleToolbar();

    RECT rect;
    GetClientRect(m_hToolbarWnd, &rect);
    int fontHeight = 20;

    m_hURLBarFont = ::CreateFont(fontHeight, 0, 0, 0, FW_NORMAL, FALSE, FALSE, FALSE, DEFAULT_CHARSET,
        OUT_TT_ONLY_PRECIS, CLIP_DEFAULT_PRECIS, CLEARTYPE_QUALITY, FF_DONTCARE, L"Tahoma");
    ::SendMessage(m_hURLBarWnd, static_cast<UINT>(WM_SETFONT), reinterpret_cast<WPARAM>(m_hURLBarFont), TRUE);
}

void MainWindow::activeURLChanged(std::wstring url)
{
    if (s_headless)
        return;
    SetWindowText(m_hURLBarWnd, url.c_str());
}
