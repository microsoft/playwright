/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "nsScreencastService.h"

#include "ScreencastEncoder.h"
#include "HeadlessWidget.h"
#include "HeadlessWindowCapturer.h"
#include "mozilla/Base64.h"
#include "mozilla/ClearOnShutdown.h"
#include "mozilla/PresShell.h"
#include "mozilla/StaticPtr.h"
#include "nsIDocShell.h"
#include "nsIObserverService.h"
#include "nsIRandomGenerator.h"
#include "nsISupportsPrimitives.h"
#include "nsThreadManager.h"
#include "nsReadableUtils.h"
#include "nsView.h"
#include "nsViewManager.h"
#include "webrtc/modules/desktop_capture/desktop_capturer.h"
#include "webrtc/modules/desktop_capture/desktop_capture_options.h"
#include "webrtc/modules/desktop_capture/desktop_device_info.h"
#include "webrtc/modules/desktop_capture/desktop_frame.h"
#include "webrtc/modules/video_capture/video_capture.h"
#include "mozilla/widget/PlatformWidgetTypes.h"
#include "video_engine/desktop_capture_impl.h"
extern "C" {
#include "jpeglib.h"
}

using namespace mozilla::widget;

namespace mozilla {

NS_IMPL_ISUPPORTS(nsScreencastService, nsIScreencastService)

namespace {

const int kMaxFramesInFlight = 1;

StaticRefPtr<nsScreencastService> gScreencastService;

rtc::scoped_refptr<webrtc::VideoCaptureModuleEx> CreateWindowCapturer(nsIWidget* widget) {
  if (gfxPlatform::IsHeadless()) {
    HeadlessWidget* headlessWidget = static_cast<HeadlessWidget*>(widget);
    return HeadlessWindowCapturer::Create(headlessWidget);
  }
  uintptr_t rawWindowId = reinterpret_cast<uintptr_t>(widget->GetNativeData(NS_NATIVE_WINDOW_WEBRTC_DEVICE_ID));
  if (!rawWindowId) {
    fprintf(stderr, "Failed to get native window id\n");
    return nullptr;
  }
  nsCString windowId;
  windowId.AppendPrintf("%" PRIuPTR, rawWindowId);
  bool captureCursor = false;
  static int moduleId = 0;
  return webrtc::DesktopCaptureImpl::Create(++moduleId, windowId.get(), webrtc::CaptureDeviceType::Window, captureCursor);
}

void NotifyScreencastStopped(const nsString& sessionId) {
  nsCOMPtr<nsIObserverService> observerService = mozilla::services::GetObserverService();
  if (!observerService) {
    fprintf(stderr, "NotifyScreencastStopped error: no observer service\n");
    return;
  }

  observerService->NotifyObservers(nullptr, "juggler-screencast-stopped", sessionId.get());
}

void NotifyScreencastFrame(const nsCString& frameData) {
  nsString wideString;
  CopyASCIItoUTF16(frameData, wideString);
  nsCOMPtr<nsIObserverService> observerService = mozilla::services::GetObserverService();
  if (!observerService) {
    fprintf(stderr, "NotifyScreencastFrame error: no observer service\n");
    return;
  }

  observerService->NotifyObservers(nullptr, "juggler-screencast-frame", wideString.get());
}

nsresult generateUid(nsString& uid) {
  nsresult rv = NS_OK;
  nsCOMPtr<nsIRandomGenerator> rg = do_GetService("@mozilla.org/security/random-generator;1", &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  uint8_t* buffer;
  const int kLen = 16;
  rv = rg->GenerateRandomBytes(kLen, &buffer);
  NS_ENSURE_SUCCESS(rv, rv);

  for (int i = 0; i < kLen; i++) {
    uid.AppendPrintf("%02x", buffer[i]);
  }
  free(buffer);
  return rv;
}
}

class nsScreencastService::Session : public rtc::VideoSinkInterface<webrtc::VideoFrame>,
                                     public webrtc::RawFrameCallback {
 public:
  Session(rtc::scoped_refptr<webrtc::VideoCaptureModuleEx>&& capturer, RefPtr<ScreencastEncoder>&& encoder, gfx::IntMargin margin, uint32_t jpegQuality)
      : mCaptureModule(std::move(capturer))
      , mEncoder(std::move(encoder))
      , mJpegQuality(jpegQuality)
      , mMargin(margin) {
  }

  bool Start() {
    webrtc::VideoCaptureCapability capability;
    // The size is ignored in fact.
    capability.width = 1280;
    capability.height = 960;
    capability.maxFPS = ScreencastEncoder::fps;
    capability.videoType = webrtc::VideoType::kI420;
    int error = mCaptureModule->StartCapture(capability);
    if (error) {
      fprintf(stderr, "StartCapture error %d\n", error);
      return false;
    }

    if (mEncoder)
      mCaptureModule->RegisterCaptureDataCallback(this);
    else
      mCaptureModule->RegisterRawFrameCallback(this);
    return true;
  }

  void Stop(std::function<void()>&& callback) {
    if (mEncoder)
      mCaptureModule->DeRegisterCaptureDataCallback(this);
    else
      mCaptureModule->RegisterRawFrameCallback(this);
    int error = mCaptureModule->StopCapture();
    if (error) {
      fprintf(stderr, "StopCapture error %d\n", error);
    }
    if (mEncoder)
      mEncoder->finish(std::move(callback));
    else
      callback();
  }

  void ScreencastFrameAck() {
    rtc::CritScope lock(&mFramesInFlightCs);
    --mFramesInFlight;
  }

  // These callbacks end up running on the VideoCapture thread.
  void OnFrame(const webrtc::VideoFrame& videoFrame) override {
    if (!mEncoder)
      return;
    mEncoder->encodeFrame(videoFrame);
  }

  // These callbacks end up running on the VideoCapture thread.
  void OnRawFrame(uint8_t* videoFrame, size_t videoFrameStride, const webrtc::VideoCaptureCapability& frameInfo) override {
    if (!mJpegQuality)
      return;
    {
      rtc::CritScope lock(&mFramesInFlightCs);
      if (mFramesInFlight >= kMaxFramesInFlight)
        return;
      ++mFramesInFlight;
    }

    jpeg_compress_struct info;
    jpeg_error_mgr error;
    info.err = jpeg_std_error(&error);
    jpeg_create_compress(&info);

    unsigned char* bufferPtr = nullptr;
    unsigned long bufferSize;
    jpeg_mem_dest(&info, &bufferPtr, &bufferSize);

    info.image_width = frameInfo.width - mMargin.LeftRight();
    info.image_height = frameInfo.height - mMargin.TopBottom();

#if MOZ_LITTLE_ENDIAN()
    if (frameInfo.videoType == webrtc::VideoType::kARGB)
      info.in_color_space = JCS_EXT_BGRA;
    if (frameInfo.videoType == webrtc::VideoType::kBGRA)
      info.in_color_space = JCS_EXT_ARGB;
#else
    if (frameInfo.videoType == webrtc::VideoType::kARGB)
      info.in_color_space = JCS_EXT_ARGB;
    if (frameInfo.videoType == webrtc::VideoType::kBGRA)
      info.in_color_space = JCS_EXT_BGRA;
#endif

    // # of color components in input image
    info.input_components = 4;

    jpeg_set_defaults(&info);
    jpeg_set_quality(&info, mJpegQuality, true);

    jpeg_start_compress(&info, true);
    while (info.next_scanline < info.image_height) {
      JSAMPROW row = videoFrame + (mMargin.top + info.next_scanline) * videoFrameStride + 4 * mMargin.left;
      if (jpeg_write_scanlines(&info, &row, 1) != 1) {
        fprintf(stderr, "JPEG library failed to encode line\n");
        break;
      }
    }

    jpeg_finish_compress(&info);
    jpeg_destroy_compress(&info);

    nsCString base64;
    nsresult rv = mozilla::Base64Encode(reinterpret_cast<char *>(bufferPtr), bufferSize, base64);
    if (NS_WARN_IF(NS_FAILED(rv)))
      return;

    NS_DispatchToMainThread(NS_NewRunnableFunction(
        "NotifyScreencastFrame", [base64]() -> void {
          NotifyScreencastFrame(base64);
        }));

    free(bufferPtr);
  }

 private:
  rtc::scoped_refptr<webrtc::VideoCaptureModuleEx> mCaptureModule;
  RefPtr<ScreencastEncoder> mEncoder;
  uint32_t mJpegQuality;
  rtc::CriticalSection mFramesInFlightCs;
  uint32_t mFramesInFlight = 0;
  gfx::IntMargin mMargin;
};


// static
already_AddRefed<nsIScreencastService> nsScreencastService::GetSingleton() {
  if (gScreencastService) {
    return do_AddRef(gScreencastService);
  }

  gScreencastService = new nsScreencastService();
  // ClearOnShutdown(&gScreencastService);
  return do_AddRef(gScreencastService);
}

nsScreencastService::nsScreencastService() = default;

nsScreencastService::~nsScreencastService() {
}

nsresult nsScreencastService::StartVideoRecording(nsIDocShell* aDocShell, bool isVideo, const nsACString& aVideoFileName, uint32_t width, uint32_t height, uint32_t quality, int32_t offsetTop, nsAString& sessionId) {
  MOZ_RELEASE_ASSERT(NS_IsMainThread(), "Screencast service must be started on the Main thread.");

  PresShell* presShell = aDocShell->GetPresShell();
  if (!presShell)
    return NS_ERROR_UNEXPECTED;
  nsViewManager* viewManager = presShell->GetViewManager();
  if (!viewManager)
    return NS_ERROR_UNEXPECTED;
  nsView* view = viewManager->GetRootView();
  if (!view)
    return NS_ERROR_UNEXPECTED;
  nsIWidget* widget = view->GetWidget();

  rtc::scoped_refptr<webrtc::VideoCaptureModuleEx> capturer = CreateWindowCapturer(widget);
  if (!capturer)
    return NS_ERROR_FAILURE;

  gfx::IntMargin margin;
  auto bounds = widget->GetScreenBounds().ToUnknownRect();
  auto clientBounds = widget->GetClientBounds().ToUnknownRect();
  // Crop the image to exclude frame (if any).
  margin = bounds - clientBounds;
  // Crop the image to exclude controls.
  margin.top += offsetTop;

  nsCString error;
  RefPtr<ScreencastEncoder> encoder;
  if (isVideo) {
    encoder = ScreencastEncoder::create(error, PromiseFlatCString(aVideoFileName), width, height, margin);
    if (!encoder) {
      fprintf(stderr, "Failed to create ScreencastEncoder: %s\n", error.get());
      return NS_ERROR_FAILURE;
    }
  }

  nsString uid;
  nsresult rv = generateUid(uid);
  NS_ENSURE_SUCCESS(rv, rv);
  sessionId = uid;

  auto session = std::make_unique<Session>(std::move(capturer), std::move(encoder), margin, isVideo ? 0 : quality);
  if (!session->Start())
    return NS_ERROR_FAILURE;
  mIdToSession.emplace(sessionId, std::move(session));
  return NS_OK;
}

nsresult nsScreencastService::StopVideoRecording(const nsAString& aSessionId) {
  nsString sessionId(aSessionId);
  auto it = mIdToSession.find(sessionId);
  if (it == mIdToSession.end())
    return NS_ERROR_INVALID_ARG;
  it->second->Stop([sessionId] {
    NS_DispatchToMainThread(NS_NewRunnableFunction(
        "NotifyScreencastStopped", [sessionId]() -> void {
          NotifyScreencastStopped(sessionId);
        }));
  });
  mIdToSession.erase(it);
  return NS_OK;
}

nsresult nsScreencastService::ScreencastFrameAck(const nsAString& aSessionId) {
  nsString sessionId(aSessionId);
  auto it = mIdToSession.find(sessionId);
  if (it == mIdToSession.end())
    return NS_ERROR_INVALID_ARG;
  it->second->ScreencastFrameAck();
  return NS_OK;
}

}  // namespace mozilla
