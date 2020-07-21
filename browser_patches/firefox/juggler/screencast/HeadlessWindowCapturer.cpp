/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "HeadlessWindowCapturer.h"

#include "api/video/i420_buffer.h"
#include "HeadlessWidget.h"
#include "libyuv.h"
#include "mozilla/EndianUtils.h"
#include "mozilla/gfx/DataSurfaceHelpers.h"
#include "rtc_base/refcountedobject.h"
#include "rtc_base/scoped_ref_ptr.h"

using namespace mozilla::widget;
using namespace webrtc;

namespace mozilla {

rtc::scoped_refptr<webrtc::VideoCaptureModule> HeadlessWindowCapturer::Create(HeadlessWidget* headlessWindow) {
  return new rtc::RefCountedObject<HeadlessWindowCapturer>(headlessWindow);
}

HeadlessWindowCapturer::HeadlessWindowCapturer(mozilla::widget::HeadlessWidget* window)
    : mWindow(window) {
}
HeadlessWindowCapturer::~HeadlessWindowCapturer() {
  StopCapture();
}


void HeadlessWindowCapturer::RegisterCaptureDataCallback(rtc::VideoSinkInterface<webrtc::VideoFrame>* dataCallback) {
  rtc::CritScope lock2(&_callBackCs);
  _dataCallBacks.insert(dataCallback);
}
void HeadlessWindowCapturer::DeRegisterCaptureDataCallback(rtc::VideoSinkInterface<webrtc::VideoFrame>* dataCallback) {
  rtc::CritScope lock2(&_callBackCs);
  auto it = _dataCallBacks.find(dataCallback);
  if (it != _dataCallBacks.end()) {
    _dataCallBacks.erase(it);
  }
}

void HeadlessWindowCapturer::NotifyFrameCaptured(const webrtc::VideoFrame& frame) {
  rtc::CritScope lock2(&_callBackCs);
  for (auto dataCallBack : _dataCallBacks)
    dataCallBack->OnFrame(frame);
}

int32_t HeadlessWindowCapturer::StopCaptureIfAllClientsClose() {
  if (_dataCallBacks.empty()) {
    return StopCapture();
  } else {
    return 0;
  }
}

int32_t HeadlessWindowCapturer::StartCapture(const VideoCaptureCapability& capability) {
  mWindow->SetSnapshotListener([this] (RefPtr<gfx::DataSourceSurface>&& dataSurface){
    if (!NS_IsInCompositorThread()) {
      fprintf(stderr, "SnapshotListener is called not on the Compositor thread!\n");
      return;
    }

    if (dataSurface->GetFormat() != gfx::SurfaceFormat::B8G8R8A8) {
      fprintf(stderr, "Uexpected snapshot surface format: %hhd\n", dataSurface->GetFormat());
      return;
    }

    int width = dataSurface->GetSize().width;
    int height = dataSurface->GetSize().height;
    rtc::scoped_refptr<I420Buffer> buffer = I420Buffer::Create(width, height);

    gfx::DataSourceSurface::ScopedMap map(dataSurface.get(), gfx::DataSourceSurface::MapType::READ);
    if (!map.IsMapped()) {
      fprintf(stderr, "Failed to map snapshot bytes!\n");
      return;
    }

#if MOZ_LITTLE_ENDIAN()
    const int conversionResult = libyuv::ARGBToI420(
#else
    const int conversionResult = libyuv::BGRAToI420(
#endif
        map.GetData(), map.GetStride(),
        buffer->MutableDataY(), buffer->StrideY(),
        buffer->MutableDataU(), buffer->StrideU(),
        buffer->MutableDataV(), buffer->StrideV(),
        width, height);

    if (conversionResult != 0) {
      fprintf(stderr, "Failed to convert capture frame to I420: %d\n", conversionResult);
      return;
    }

    VideoFrame captureFrame(buffer, 0, rtc::TimeMillis(), kVideoRotation_0);
    NotifyFrameCaptured(captureFrame);
  });
  return 0;
}

int32_t HeadlessWindowCapturer::StopCapture() {
  if (!CaptureStarted())
    return 0;
  mWindow->SetSnapshotListener(nullptr);
  return 0;
}

bool HeadlessWindowCapturer::CaptureStarted() {
  return true;
}

}  // namespace mozilla
