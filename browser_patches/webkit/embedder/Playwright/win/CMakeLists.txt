set(Playwright_PRIVATE_INCLUDE_DIRECTORIES
    ${CMAKE_BINARY_DIR}
    ${WebCore_PRIVATE_FRAMEWORK_HEADERS_DIR}
)

set(Playwright_SOURCES
    Common.cpp
    MainWindow.cpp
    PlaywrightLib.rc
    WebKitBrowserWindow.cpp
    WinMain.cpp
    stdafx.cpp
)

set(Playwright_PRIVATE_DEFINITIONS _UNICODE)
set(Playwright_PRIVATE_LIBRARIES
    WebKit::WTF
    comctl32
    shlwapi
    user32
)

list(APPEND Playwright_PRIVATE_DEFINITIONS ENABLE_WEBKIT)
list(APPEND Playwright_SOURCES
    WebKitBrowserWindow.cpp
)
list(APPEND Playwright_PRIVATE_LIBRARIES
    WebKit::WebKit
)

WEBKIT_EXECUTABLE_DECLARE(Playwright)
WEBKIT_EXECUTABLE(Playwright)

set_target_properties(Playwright PROPERTIES WIN32_EXECUTABLE ON)
if (${WTF_PLATFORM_WIN_CAIRO})
    target_compile_definitions(Playwright PRIVATE WIN_CAIRO)
endif ()
