/*
 * Copyright (c) 2010, The WebM Project authors. All rights reserved.
 * Copyright (c) 2013 The Chromium Authors. All rights reserved.
 * Copyright (C) 2020 Microsoft Corporation.
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
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
 * "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
 * LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
 * A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
 * OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
 * SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
 * LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
 * DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
 * THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "ScreencastEncoder.h"

#include <algorithm>
#include <libyuv.h>
#include <vpx/vp8.h>
#include <vpx/vp8cx.h>
#include <vpx/vpx_encoder.h>
#include "nsIThread.h"
#include "nsThreadUtils.h"
#include "WebMFileWriter.h"
#include "api/video/video_frame.h"

namespace mozilla {

namespace {

struct VpxCodecDeleter {
  void operator()(vpx_codec_ctx_t* codec) {
    if (codec) {
        vpx_codec_err_t ret = vpx_codec_destroy(codec);
        if (ret != VPX_CODEC_OK)
            fprintf(stderr, "Failed to destroy codec: %s\n", vpx_codec_error(codec));
    }
  }
};

using ScopedVpxCodec = std::unique_ptr<vpx_codec_ctx_t, VpxCodecDeleter>;

// Number of timebase unints per one frame.
constexpr int timeScale = 1000;

// Defines the dimension of a macro block. This is used to compute the active
// map for the encoder.
const int kMacroBlockSize = 16;

void createImage(unsigned int width, unsigned int height,
                 std::unique_ptr<vpx_image_t>& out_image,
                 std::unique_ptr<uint8_t[]>& out_image_buffer,
                 int& out_buffer_size) {
  std::unique_ptr<vpx_image_t> image(new vpx_image_t());
  memset(image.get(), 0, sizeof(vpx_image_t));

  // libvpx seems to require both to be assigned.
  image->d_w = width;
  image->w = width;
  image->d_h = height;
  image->h = height;

  // I420
  image->fmt = VPX_IMG_FMT_YV12;
  image->x_chroma_shift = 1;
  image->y_chroma_shift = 1;

  // libyuv's fast-path requires 16-byte aligned pointers and strides, so pad
  // the Y, U and V planes' strides to multiples of 16 bytes.
  const int y_stride = ((image->w - 1) & ~15) + 16;
  const int uv_unaligned_stride = y_stride >> image->x_chroma_shift;
  const int uv_stride = ((uv_unaligned_stride - 1) & ~15) + 16;

  // libvpx accesses the source image in macro blocks, and will over-read
  // if the image is not padded out to the next macroblock: crbug.com/119633.
  // Pad the Y, U and V planes' height out to compensate.
  // Assuming macroblocks are 16x16, aligning the planes' strides above also
  // macroblock aligned them.
  static_assert(kMacroBlockSize == 16, "macroblock_size_not_16");
  const int y_rows = ((image->h - 1) & ~(kMacroBlockSize-1)) + kMacroBlockSize;
  const int uv_rows = y_rows >> image->y_chroma_shift;

  // Allocate a YUV buffer large enough for the aligned data & padding.
  out_buffer_size = y_stride * y_rows + 2*uv_stride * uv_rows;
  std::unique_ptr<uint8_t[]> image_buffer(new uint8_t[out_buffer_size]);

  // Reset image value to 128 so we just need to fill in the y plane.
  memset(image_buffer.get(), 128, out_buffer_size);

  // Fill in the information for |image_|.
  unsigned char* uchar_buffer =
      reinterpret_cast<unsigned char*>(image_buffer.get());
  image->planes[0] = uchar_buffer;
  image->planes[1] = image->planes[0] + y_stride * y_rows;
  image->planes[2] = image->planes[1] + uv_stride * uv_rows;
  image->stride[0] = y_stride;
  image->stride[1] = uv_stride;
  image->stride[2] = uv_stride;

  out_image = std::move(image);
  out_image_buffer = std::move(image_buffer);
}

} // namespace

class ScreencastEncoder::VPXFrame {
public:
    VPXFrame(rtc::scoped_refptr<webrtc::VideoFrameBuffer>&& buffer, const gfx::IntMargin& margin)
        : m_frameBuffer(std::move(buffer))
        , m_margin(margin)
    { }

    void setDuration(TimeDuration duration) { m_duration = duration; }
    TimeDuration duration() const { return m_duration; }

    void convertToVpxImage(vpx_image_t* image)
    {
        if (m_frameBuffer->type() != webrtc::VideoFrameBuffer::Type::kI420) {
            fprintf(stderr, "convertToVpxImage unexpected frame buffer type: %d\n", m_frameBuffer->type());
            return;
        }

        auto src = m_frameBuffer->GetI420();
        const int y_stride = image->stride[VPX_PLANE_Y];
        MOZ_ASSERT(image->stride[VPX_PLANE_U] == image->stride[VPX_PLANE_V]);
        const int uv_stride = image->stride[1];
        uint8_t* y_data = image->planes[VPX_PLANE_Y];
        uint8_t* u_data = image->planes[VPX_PLANE_U];
        uint8_t* v_data = image->planes[VPX_PLANE_V];

        /**
         * Let's say we have the following image of 6x3 pixels (same number = same pixel value):
         *  112233
         *  112233
         *  445566
         * In I420 format (see https://en.wikipedia.org/wiki/YUV), the image will have the following data planes:
         *   Y [stride_Y = 6]:
         *    112233
         *    112233
         *    445566
         *   U [stride_U = 3] - this plane has aggregate for each 2x2 pixels:
         *    123
         *    456
         *   V [stride_V = 3] - this plane has aggregate for each 2x2 pixels:
         *    123
         *    456
         *
         * To crop this image efficiently, we can move src_Y/U/V pointer and
         * adjust the src_width and src_height. However, we must cut off only **even**
         * amount of lines and columns to retain semantic of U and V planes which
         * contain only 1/4 of pixel information.
         */
        int yuvTopOffset = m_margin.top + (m_margin.top & 1);
        int yuvLeftOffset = m_margin.left + (m_margin.left & 1);

        double src_width = src->width() - yuvLeftOffset;
        double src_height = src->height() - yuvTopOffset;

        if (src_width > image->w || src_height > image->h) {
          double scale = std::min(image->w / src_width, image->h / src_height);
          double dst_width = src_width * scale;
          if (dst_width > image->w) {
            src_width *= image->w / dst_width;
            dst_width = image->w;
          }
          double dst_height = src_height * scale;
          if (dst_height > image->h) {
            src_height *= image->h / dst_height;
            dst_height = image->h;
          }
          libyuv::I420Scale(src->DataY() + yuvTopOffset * src->StrideY() + yuvLeftOffset, src->StrideY(),
                            src->DataU() + (yuvTopOffset * src->StrideU() + yuvLeftOffset) / 2, src->StrideU(),
                            src->DataV() + (yuvTopOffset * src->StrideV() + yuvLeftOffset) / 2, src->StrideV(),
                            src_width, src_height,
                            y_data, y_stride,
                            u_data, uv_stride,
                            v_data, uv_stride,
                            dst_width, dst_height,
                            libyuv::kFilterBilinear);
        } else {
          int width = std::min<int>(image->w, src_width);
          int height = std::min<int>(image->h, src_height);

          libyuv::I420Copy(src->DataY() + yuvTopOffset * src->StrideY() + yuvLeftOffset, src->StrideY(),
                           src->DataU() + (yuvTopOffset * src->StrideU() + yuvLeftOffset) / 2, src->StrideU(),
                           src->DataV() + (yuvTopOffset * src->StrideV() + yuvLeftOffset) / 2, src->StrideV(),
                           y_data, y_stride,
                           u_data, uv_stride,
                           v_data, uv_stride,
                           width, height);
        }
    }

private:
    rtc::scoped_refptr<webrtc::VideoFrameBuffer> m_frameBuffer;
    gfx::IntMargin m_margin;
    TimeDuration m_duration;
};


class ScreencastEncoder::VPXCodec {
public:
    VPXCodec(ScopedVpxCodec codec, vpx_codec_enc_cfg_t cfg, FILE* file)
        : m_codec(std::move(codec))
        , m_cfg(cfg)
        , m_file(file)
        , m_writer(new WebMFileWriter(file, &m_cfg))
    {
        nsresult rv = NS_NewNamedThread("Screencast enc", getter_AddRefs(m_encoderQueue));
        if (rv != NS_OK) {
          fprintf(stderr, "ScreencastEncoder::VPXCodec failed to spawn thread %d\n", rv);
          return;
        }

        createImage(cfg.g_w, cfg.g_h, m_image, m_imageBuffer, m_imageBufferSize);
    }

    ~VPXCodec() {
      m_encoderQueue->Shutdown();
      m_encoderQueue = nullptr;
    }

    void encodeFrameAsync(std::unique_ptr<VPXFrame>&& frame)
    {
        m_encoderQueue->Dispatch(NS_NewRunnableFunction("VPXCodec::encodeFrameAsync", [this, frame = std::move(frame)] {
            memset(m_imageBuffer.get(), 128, m_imageBufferSize);
            frame->convertToVpxImage(m_image.get());

            double frameCount = frame->duration().ToSeconds() * fps;
            // For long duration repeat frame at 1 fps to ensure last frame duration is short enough.
            // TODO: figure out why simply passing duration doesn't work well.
            for (;frameCount > 1.5; frameCount -= 1) {
                encodeFrame(m_image.get(), timeScale);
            }
            encodeFrame(m_image.get(), std::max<int>(1, frameCount * timeScale));
        }));
    }

    void finishAsync(std::function<void()>&& callback)
    {
        m_encoderQueue->Dispatch(NS_NewRunnableFunction("VPXCodec::finishAsync", [this, callback = std::move(callback)] {
            finish();
            callback();
        }));
    }

private:
    bool encodeFrame(vpx_image_t *img, int duration)
    {
        vpx_codec_iter_t iter = nullptr;
        const vpx_codec_cx_pkt_t *pkt = nullptr;
        int flags = 0;
        const vpx_codec_err_t res = vpx_codec_encode(m_codec.get(), img, m_pts, duration, flags, VPX_DL_REALTIME);
        if (res != VPX_CODEC_OK) {
            fprintf(stderr, "Failed to encode frame: %s\n", vpx_codec_error(m_codec.get()));
            return false;
        }

        bool gotPkts = false;
        while ((pkt = vpx_codec_get_cx_data(m_codec.get(), &iter)) != nullptr) {
            gotPkts = true;

            if (pkt->kind == VPX_CODEC_CX_FRAME_PKT) {
                m_writer->writeFrame(pkt);
                ++m_frameCount;
                // fprintf(stderr, "  #%03d %spts=%" PRId64 " sz=%zd\n", m_frameCount, (pkt->data.frame.flags & VPX_FRAME_IS_KEY) != 0 ? "[K] " : "", pkt->data.frame.pts, pkt->data.frame.sz);
                m_pts += pkt->data.frame.duration;
            }
        }

        return gotPkts;
    }

    void finish()
    {
        // Flush encoder.
        while (encodeFrame(nullptr, 1))
            ++m_frameCount;

        m_writer->finish();
        fclose(m_file);
        // fprintf(stderr, "ScreencastEncoder::finish %d frames\n", m_frameCount);
    }

    RefPtr<nsIThread> m_encoderQueue;
    ScopedVpxCodec m_codec;
    vpx_codec_enc_cfg_t m_cfg;
    FILE* m_file { nullptr };
    std::unique_ptr<WebMFileWriter> m_writer;
    int m_frameCount { 0 };
    int64_t m_pts { 0 };
    std::unique_ptr<uint8_t[]> m_imageBuffer;
    int m_imageBufferSize { 0 };
    std::unique_ptr<vpx_image_t> m_image;
};

ScreencastEncoder::ScreencastEncoder(std::unique_ptr<VPXCodec> vpxCodec, const gfx::IntMargin& margin)
    : m_vpxCodec(std::move(vpxCodec))
    , m_margin(margin)
{
}

ScreencastEncoder::~ScreencastEncoder()
{
}

std::unique_ptr<ScreencastEncoder> ScreencastEncoder::create(nsCString& errorString, const nsCString& filePath, int width, int height, const gfx::IntMargin& margin)
{
    vpx_codec_iface_t* codec_interface = vpx_codec_vp8_cx();
    if (!codec_interface) {
        errorString = "Codec not found.";
        return nullptr;
    }

    if (width <= 0 || height <= 0 || (width % 2) != 0 || (height % 2) != 0) {
        errorString.AppendPrintf("Invalid frame size: %dx%d", width, height);
        return nullptr;
    }

    vpx_codec_enc_cfg_t cfg;
    memset(&cfg, 0, sizeof(cfg));
    vpx_codec_err_t error = vpx_codec_enc_config_default(codec_interface, &cfg, 0);
    if (error) {
        errorString.AppendPrintf("Failed to get default codec config: %s", vpx_codec_err_to_string(error));
        return nullptr;
    }

    cfg.g_w = width;
    cfg.g_h = height;
    cfg.g_timebase.num = 1;
    cfg.g_timebase.den = fps * timeScale;
    cfg.g_error_resilient = VPX_ERROR_RESILIENT_DEFAULT;

    ScopedVpxCodec codec(new vpx_codec_ctx_t);
    if (vpx_codec_enc_init(codec.get(), codec_interface, &cfg, 0)) {
        errorString.AppendPrintf("Failed to initialize encoder: %s", vpx_codec_error(codec.get()));
        return nullptr;
    }

    FILE* file = fopen(filePath.get(), "wb");
    if (!file) {
        errorString.AppendPrintf("Failed to open file '%s' for writing: %s", filePath.get(), strerror(errno));
        return nullptr;
    }

    std::unique_ptr<VPXCodec> vpxCodec(new VPXCodec(std::move(codec), cfg, file));
    // fprintf(stderr, "ScreencastEncoder initialized with: %s\n", vpx_codec_iface_name(codec_interface));
    return std::make_unique<ScreencastEncoder>(std::move(vpxCodec), margin);
}

void ScreencastEncoder::flushLastFrame()
{
    TimeStamp now = TimeStamp::Now();
    if (m_lastFrameTimestamp) {
        // If previous frame encoding failed for some rason leave the timestampt intact.
        if (!m_lastFrame)
            return;

        m_lastFrame->setDuration(now - m_lastFrameTimestamp);
        m_vpxCodec->encodeFrameAsync(std::move(m_lastFrame));
    }
    m_lastFrameTimestamp = now;
}

void ScreencastEncoder::encodeFrame(const webrtc::VideoFrame& videoFrame)
{
    // fprintf(stderr, "ScreencastEncoder::encodeFrame\n");
    flushLastFrame();

    m_lastFrame = std::make_unique<VPXFrame>(videoFrame.video_frame_buffer(), m_margin);
}

void ScreencastEncoder::finish(std::function<void()>&& callback)
{
    if (!m_vpxCodec) {
        callback();
        return;
    }

    flushLastFrame();
    m_vpxCodec->finishAsync([callback = std::move(callback)] () mutable {
        NS_DispatchToMainThread(NS_NewRunnableFunction("ScreencastEncoder::finish callback", std::move(callback)));
    });
}


} // namespace mozilla
