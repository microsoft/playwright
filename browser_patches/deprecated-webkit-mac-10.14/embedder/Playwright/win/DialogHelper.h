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
#include <string>
#include <vector>

class Dialog {
public:
    bool run(HINSTANCE hInst, HWND hwnd, int dialogId)
    {
        auto result = DialogBoxParam(hInst, MAKEINTRESOURCE(dialogId), hwnd, doalogProc, reinterpret_cast<LPARAM>(this));
        return (result > 0);
    }

    static INT_PTR CALLBACK doalogProc(HWND hDlg, UINT message, WPARAM wParam, LPARAM lParam)
    {
        if (message == WM_INITDIALOG)
            SetWindowLongPtr(hDlg, DWLP_USER, lParam);
        else
            lParam = GetWindowLongPtr(hDlg, DWLP_USER);

        auto* dialog = reinterpret_cast<Dialog*>(lParam);
        return dialog->handle(hDlg, message, wParam);
    }

protected:
    INT_PTR handle(HWND hDlg, UINT message, WPARAM wParam)
    {
        switch (message) {
        case WM_INITDIALOG: {
            m_hDlg = hDlg;
            setup();
            update();
            return TRUE;
        }
        case WM_COMMAND:
            int wmId = LOWORD(wParam);
            switch (wmId) {
            case IDOK:
                ok();
                close(true);
                return TRUE;
            case IDCANCEL:
                cancel();
                close(false);
                return TRUE;
            default:
                auto handled = command(wmId);
                update();
                return handled;
            }
        }
        return FALSE;
    }

    virtual void setup() { }
    virtual void update() { updateOkButton(validate()); }
    virtual bool validate() { return true; }
    virtual void updateOkButton(bool isValid) { setEnabled(IDOK, isValid); }
    virtual bool command(int wmId) { return false; }
    virtual void ok() { }
    virtual void cancel() { }

    void close(bool success) { EndDialog(m_hDlg, success); }

    HWND hDlg() { return m_hDlg; }

    HWND item(int itemId) { return GetDlgItem(m_hDlg, itemId); }

    void setEnabled(int itemId, bool enabled)
    {
        EnableWindow(item(itemId), enabled);
    }

    void setText(int itemId, const std::wstring& str)
    {
        SetDlgItemText(m_hDlg, itemId, _bstr_t(str.c_str()));
    }

    std::wstring getText(int itemId)
    {
        auto length = getTextLength(itemId);
        std::vector<TCHAR> buffer(length + 1, 0);
        GetWindowText(item(itemId), buffer.data(), length + 1);
        return std::wstring { buffer.data() };
    }

    int getTextLength(int itemId)
    {
        return GetWindowTextLength(item(itemId));
    }

    class RadioGroup {
    public:
        RadioGroup(Dialog& dialog, int first, int last)
            : m_dialog(dialog)
            , m_first(first)
            , m_last(last)
        {
        }

        void set(int item)
        {
            CheckRadioButton(m_dialog.hDlg(), m_first, m_last, item);
        }

        int get()
        {
            for (int id = m_first; id <= m_last; id++) {
                if (IsDlgButtonChecked(m_dialog.hDlg(), id) == BST_CHECKED)
                    return id;
            }
            return 0;
        }

    private:
        Dialog& m_dialog;
        int m_first;
        int m_last;
    };

    RadioGroup radioGroup(int first, int last)
    {
        return RadioGroup(*this, first, last);
    }

    HWND m_hDlg { };
};
