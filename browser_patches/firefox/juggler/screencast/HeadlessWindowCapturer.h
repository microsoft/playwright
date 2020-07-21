/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#pragma once

#include <memory>
#include <set>
#include "api/video/video_frame.h"
#include "media/base/videosinkinterface.h"
#include "modules/video_capture/video_capture.h"
#include "rtc_base/criticalsection.h"

class nsIWidget;

namespace mozilla {

namespace widget {
class HeadlessWidget;
}

class HeadlessWindowCapturer : public webrtc::VideoCaptureModule {
 public:
  static rtc::scoped_refptr<webrtc::VideoCaptureModule> Create(mozilla::widget::HeadlessWidget*);

  void RegisterCaptureDataCallback(
      rtc::VideoSinkInterface<webrtc::VideoFrame>* dataCallback) override;
  void DeRegisterCaptureDataCallback(
      rtc::VideoSinkInterface<webrtc::VideoFrame>* dataCallback) override;
  int32_t StopCaptureIfAllClientsClose() override;

  int32_t SetCaptureRotation(webrtc::VideoRotation) override { return -1; }
  bool SetApplyRotation(bool) override { return false; }
  bool GetApplyRotation() override { return true; }

  const char* CurrentDeviceName() const override { return "Headless window"; }

  // Platform dependent
  int32_t StartCapture(const webrtc::VideoCaptureCapability& capability) override;
  bool FocusOnSelectedSource() override { return false; }
  int32_t StopCapture() override;
  bool CaptureStarted() override;
  int32_t CaptureSettings(webrtc::VideoCaptureCapability& settings) override {
    return -1;
  }

 protected:
  HeadlessWindowCapturer(mozilla::widget::HeadlessWidget*);
  ~HeadlessWindowCapturer() override;

 private:
  void NotifyFrameCaptured(const webrtc::VideoFrame& frame);

  mozilla::widget::HeadlessWidget* mWindow = nullptr;
  rtc::CriticalSection _callBackCs;
  std::set<rtc::VideoSinkInterface<webrtc::VideoFrame>*> _dataCallBacks;
};

}  // namespace mozilla
