set(Playwright_INCLUDE_DIRECTORIES
    ${PAL_FRAMEWORK_HEADERS_DIR}
    ${WebCore_PRIVATE_FRAMEWORK_HEADERS_DIR}
    ${WebKit_FRAMEWORK_HEADERS_DIR}
    ${WebKit_PRIVATE_FRAMEWORK_HEADERS_DIR}
)

set(Playwright_SOURCES
    Common.cpp
    MainWindow.cpp
    PlaywrightLib.rc
    WebKitBrowserWindow.cpp
    WinMain.cpp
    stdafx.cpp
)

set(Playwright_LIBRARIES
    DbgHelp
    WebKit::WTF
    comctl32
    comsupp
    comsuppw
    shlwapi
    WebKit
)

set(CMAKE_SHARED_LINKER_FLAGS "${CMAKE_SHARED_LINKER_FLAGS} ${MSVC_RUNTIME_LINKER_FLAGS}")
set(CMAKE_EXE_LINKER_FLAGS "${CMAKE_EXE_LINKER_FLAGS} /ENTRY:wWinMainCRTStartup")

if (${WTF_PLATFORM_WIN_CAIRO})
    add_definitions(-DWIN_CAIRO)
endif ()
add_definitions(-D_UNICODE)
include_directories(${Playwright_INCLUDE_DIRECTORIES})
add_library(PlaywrightLib SHARED ${Playwright_SOURCES})
target_link_libraries(PlaywrightLib ${Playwright_LIBRARIES})

add_executable(Playwright WIN32 ${TOOLS_DIR}/win/DLLLauncher/DLLLauncherMain.cpp Playwright.rc)
target_link_libraries(Playwright shlwapi)
set_target_properties(Playwright PROPERTIES OUTPUT_NAME "Playwright")

add_dependencies(Playwright PlaywrightLib)
