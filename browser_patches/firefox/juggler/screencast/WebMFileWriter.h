/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#pragma once

#include <memory>
#include <stdio.h>
#include <stdlib.h>
#include "vpx/vpx_encoder.h"

#include "mkvmuxer/mkvmuxer.h"
#include "mkvmuxer/mkvwriter.h"

namespace mozilla {

class WebMFileWriter {
public:
    WebMFileWriter(FILE*, vpx_codec_enc_cfg_t* cfg);
    ~WebMFileWriter();

    void writeFrame(const vpx_codec_cx_pkt_t* pkt);
    void finish();

private:
    vpx_codec_enc_cfg_t* m_cfg = nullptr;
    std::unique_ptr<mkvmuxer::MkvWriter> m_writer;
    std::unique_ptr<mkvmuxer::Segment> m_segment;
    uint64_t m_videoTrackId = 0;
};

} // namespace mozilla
