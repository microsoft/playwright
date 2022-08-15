/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#pragma once

#include <functional>
#include <memory>
#include "mozilla/gfx/Rect.h"
#include "mozilla/Maybe.h"
#include "mozilla/TimeStamp.h"
#include "nsISupportsImpl.h"
#include "nsStringFwd.h"

namespace webrtc {
class VideoFrame;
}

namespace mozilla {

class ScreencastEncoder {
public:
    static constexpr int fps = 25;

    static std::unique_ptr<ScreencastEncoder> create(nsCString& errorString, const nsCString& filePath, int width, int height, const gfx::IntMargin& margin);

    class VPXCodec;
    ScreencastEncoder(std::unique_ptr<VPXCodec>, const gfx::IntMargin& margin);
    ~ScreencastEncoder();

    void encodeFrame(const webrtc::VideoFrame& videoFrame);

    void finish(std::function<void()>&& callback);

private:
    void flushLastFrame();

    std::unique_ptr<VPXCodec> m_vpxCodec;
    gfx::IntMargin m_margin;
    TimeStamp m_lastFrameTimestamp;
    class VPXFrame;
    std::unique_ptr<VPXFrame> m_lastFrame;
};

} // namespace mozilla
