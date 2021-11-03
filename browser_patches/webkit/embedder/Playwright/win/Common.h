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

#include "stdafx.h"
#include <optional>
#include <WebKit/WKRetainPtr.h>
#include <WebKit/WKString.h>
#include <WebKit/WKURL.h>

struct CommandLineOptions {
    bool useFullDesktop { };
    bool inspectorPipe { };
    bool headless { };
    bool noStartupWindow { };
    bool disableAcceleratedCompositing { };
    _bstr_t requestedURL;
    _bstr_t userDataDir;
    _bstr_t curloptProxy;
    _bstr_t curloptNoproxy;

    CommandLineOptions()
    {
    }
};

struct Credential {
    std::wstring username;
    std::wstring password;
};

void computeFullDesktopFrame();
bool getAppDataFolder(_bstr_t& directory);
CommandLineOptions parseCommandLine();
void createCrashReport(EXCEPTION_POINTERS*);
std::optional<Credential> askCredential(HWND, const std::wstring& realm);

bool askServerTrustEvaluation(HWND, const std::wstring& text);
std::wstring replaceString(std::wstring src, const std::wstring& oldValue, const std::wstring& newValue);

extern HINSTANCE hInst;
extern POINT s_windowPosition;
extern SIZE s_windowSize;

std::wstring createString(WKStringRef wkString);
std::wstring createString(WKURLRef wkURL);
std::string createUTF8String(const wchar_t* src, size_t srcLength);
WKRetainPtr<WKStringRef> createWKString(_bstr_t str);
WKRetainPtr<WKStringRef> createWKString(const std::wstring& str);
WKRetainPtr<WKURLRef> createWKURL(_bstr_t str);
WKRetainPtr<WKURLRef> createWKURL(const std::wstring& str);
