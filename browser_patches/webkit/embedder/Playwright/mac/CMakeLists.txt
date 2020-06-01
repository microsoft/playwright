set(PLAYWRIGHT_DIR "${TOOLS_DIR}/Playwright/mac")

#FIXME: This should not need WEBCORE_EXPORT defined.  This means we are including WebCore headers, and we should not.
add_definitions("-include Playwright_Prefix.pch -DWEBCORE_EXPORT=")

set(Playwright_SOURCES
    ${PLAYWRIGHT_DIR}/AppDelegate.m
    ${PLAYWRIGHT_DIR}/BrowserWindowController.m
    ${PLAYWRIGHT_DIR}/main.m
    ${TOOLS_DIR}/Playwright/MBToolbarItem.m
)

set(Playwright_INCLUDE_DIRECTORIES
    ${CMAKE_SOURCE_DIR}/Source
    ${FORWARDING_HEADERS_DIR}
    ${PLAYWRIGHT_DIR}
)

set(Playwright_LIBRARIES
    WebKit
)

set(CMAKE_EXE_LINKER_FLAGS "-framework Cocoa")

set(EXECUTABLE_NAME Playwright)
set(PRODUCT_NAME Playwright)

set(Playwright_Contents_Directory ${CMAKE_RUNTIME_OUTPUT_DIRECTORY}/Playwright.app/Contents)
make_directory(${Playwright_Contents_Directory}/Resources)
add_custom_command(OUTPUT ${Playwright_Contents_Directory}/Resources/BrowserWindow.nib
    COMMAND ibtool --compile ${Playwright_Contents_Directory}/Resources/BrowserWindow.nib ${PLAYWRIGHT_DIR}/BrowserWindow.xib VERBATIM)
add_custom_command(OUTPUT ${Playwright_Contents_Directory}/Resources/MainMenu.nib
    COMMAND ibtool --compile ${Playwright_Contents_Directory}/Resources/MainMenu.nib ${PLAYWRIGHT_DIR}/MainMenu.xib VERBATIM)
add_custom_target(PlaywrightNibs ALL DEPENDS
    ${Playwright_Contents_Directory}/Resources/BrowserWindow.nib
    ${Playwright_Contents_Directory}/Resources/MainMenu.nib
)

include_directories(${Playwright_INCLUDE_DIRECTORIES})
add_executable(Playwright MACOSX_BUNDLE ${Playwright_SOURCES})
set_target_properties(Playwright PROPERTIES MACOSX_BUNDLE_INFO_PLIST ${PLAYWRIGHT_DIR}/Info.plist)
target_link_libraries(Playwright ${Playwright_LIBRARIES})
add_dependencies(Playwright PlaywrightNibs)
