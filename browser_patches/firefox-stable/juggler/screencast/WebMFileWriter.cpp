/*
 *  Copyright (c) 2014 The WebM project authors. All Rights Reserved.
 */

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "WebMFileWriter.h"

#include <string>
#include "mkvmuxer/mkvmuxerutil.h"

namespace mozilla {

WebMFileWriter::WebMFileWriter(FILE* file, vpx_codec_enc_cfg_t* cfg)
    : m_cfg(cfg)
    , m_writer(new mkvmuxer::MkvWriter(file))
    , m_segment(new mkvmuxer::Segment()) {
  m_segment->Init(m_writer.get());
  m_segment->set_mode(mkvmuxer::Segment::kFile);
  m_segment->OutputCues(true);

  mkvmuxer::SegmentInfo* info = m_segment->GetSegmentInfo();
  std::string version = "Playwright " + std::string(vpx_codec_version_str());
  info->set_writing_app(version.c_str());

  // Add vp8 track.
  m_videoTrackId = m_segment->AddVideoTrack(
      static_cast<int>(m_cfg->g_w), static_cast<int>(m_cfg->g_h), 0);
  if (!m_videoTrackId) {
    fprintf(stderr, "Failed to add video track\n");
  }
}

WebMFileWriter::~WebMFileWriter() {}

void WebMFileWriter::writeFrame(const vpx_codec_cx_pkt_t* pkt) {
  int64_t pts_ns = pkt->data.frame.pts * 1000000000ll * m_cfg->g_timebase.num /
                   m_cfg->g_timebase.den;
  m_segment->AddFrame(static_cast<uint8_t*>(pkt->data.frame.buf),
                      pkt->data.frame.sz, m_videoTrackId, pts_ns,
                      pkt->data.frame.flags & VPX_FRAME_IS_KEY);
}

void WebMFileWriter::finish() {
  m_segment->Finalize();
}

} // namespace mozilla
