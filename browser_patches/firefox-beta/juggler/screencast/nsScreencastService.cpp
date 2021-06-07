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
#include <libyuv.h>

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
  Session(
    nsIScreencastServiceClient* client,
    rtc::scoped_refptr<webrtc::VideoCaptureModuleEx>&& capturer,
    RefPtr<ScreencastEncoder>&& encoder,
    int width, int height,
    int viewportWidth, int viewportHeight,
    gfx::IntMargin margin,
    uint32_t jpegQuality)
      : mClient(client)
      , mCaptureModule(std::move(capturer))
      , mEncoder(std::move(encoder))
      , mJpegQuality(jpegQuality)
      , mWidth(width)
      , mHeight(height)
      , mViewportWidth(viewportWidth)
      , mViewportHeight(viewportHeight)
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

  void Stop() {
    if (mEncoder)
      mCaptureModule->DeRegisterCaptureDataCallback(this);
    else
      mCaptureModule->DeRegisterRawFrameCallback(this);
    int error = mCaptureModule->StopCapture();
    if (error) {
      fprintf(stderr, "StopCapture error %d\n", error);
    }
    if (mEncoder) {
      rtc::CritScope lock(&mCaptureCallbackCs);
      mEncoder->finish([client = std::move(mClient)] {
        NS_DispatchToMainThread(NS_NewRunnableFunction(
            "NotifyScreencastStopped", [client = std::move(client)]() -> void {
              client->ScreencastStopped();
            }));
      });
    } else {
      rtc::CritScope lock(&mCaptureCallbackCs);
      mClient->ScreencastStopped();
      mClient = nullptr;
    }
  }

  void ScreencastFrameAck() {
    rtc::CritScope lock(&mCaptureCallbackCs);
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
    int pageWidth = frameInfo.width - mMargin.LeftRight();
    int pageHeight = frameInfo.height - mMargin.TopBottom();
    // Headed Firefox brings sizes in sync slowly.
    if (mViewportWidth && pageWidth > mViewportWidth)
      pageWidth = mViewportWidth;
    if (mViewportHeight && pageHeight > mViewportHeight)
      pageHeight = mViewportHeight;

    {
      rtc::CritScope lock(&mCaptureCallbackCs);
      if (mFramesInFlight >= kMaxFramesInFlight) {
        return;
      }
      ++mFramesInFlight;
      if (!mClient)
        return;
    }

    int screenshotWidth = pageWidth;
    int screenshotHeight = pageHeight;
    int screenshotTopMargin = mMargin.TopBottom();
    std::unique_ptr<uint8_t[]> canvas;
    uint8_t* canvasPtr = videoFrame;
    int canvasStride = videoFrameStride;

    if (mWidth < pageWidth || mHeight < pageHeight) {
      double scale = std::min(1., std::min((double)mWidth / pageWidth, (double)mHeight / pageHeight));
      int canvasWidth = frameInfo.width * scale;
      int canvasHeight = frameInfo.height * scale;
      canvasStride = canvasWidth * 4;

      screenshotWidth *= scale;
      screenshotHeight *= scale;
      screenshotTopMargin *= scale;

      canvas.reset(new uint8_t[canvasWidth * canvasHeight * 4]);
      canvasPtr = canvas.get();
      libyuv::ARGBScale(videoFrame,
                        videoFrameStride,
                        frameInfo.width,
                        frameInfo.height,
                        canvasPtr,
                        canvasStride,
                        canvasWidth,
                        canvasHeight,
                        libyuv::kFilterBilinear);
    }

    jpeg_compress_struct info;
    jpeg_error_mgr error;
    info.err = jpeg_std_error(&error);
    jpeg_create_compress(&info);

    unsigned char* bufferPtr = nullptr;
    unsigned long bufferSize;
    jpeg_mem_dest(&info, &bufferPtr, &bufferSize);

    info.image_width = screenshotWidth;
    info.image_height = screenshotHeight;

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
      JSAMPROW row = canvasPtr + (screenshotTopMargin + info.next_scanline) * canvasStride;
      if (jpeg_write_scanlines(&info, &row, 1) != 1) {
        fprintf(stderr, "JPEG library failed to encode line\n");
        break;
      }
    }

    jpeg_finish_compress(&info);
    jpeg_destroy_compress(&info);

    nsCString base64;
    nsresult rv = mozilla::Base64Encode(reinterpret_cast<char *>(bufferPtr), bufferSize, base64);
    free(bufferPtr);
    if (NS_WARN_IF(NS_FAILED(rv))) {
      return;
    }

    nsIScreencastServiceClient* client = mClient.get();
    NS_DispatchToMainThread(NS_NewRunnableFunction(
        "NotifyScreencastFrame", [client, base64, pageWidth, pageHeight]() -> void {
          NS_ConvertUTF8toUTF16 utf16(base64);
          client->ScreencastFrame(utf16, pageWidth, pageHeight);
        }));
  }

 private:
  RefPtr<nsIScreencastServiceClient> mClient;
  rtc::scoped_refptr<webrtc::VideoCaptureModuleEx> mCaptureModule;
  RefPtr<ScreencastEncoder> mEncoder;
  uint32_t mJpegQuality;
  rtc::CriticalSection mCaptureCallbackCs;
  uint32_t mFramesInFlight = 0;
  int mWidth;
  int mHeight;
  int mViewportWidth;
  int mViewportHeight;
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

nsresult nsScreencastService::StartVideoRecording(nsIScreencastServiceClient* aClient, nsIDocShell* aDocShell, bool isVideo, const nsACString& aVideoFileName, uint32_t width, uint32_t height, uint32_t quality, uint32_t viewportWidth, uint32_t viewportHeight, uint32_t offsetTop, nsAString& sessionId) {
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

  auto session = std::make_unique<Session>(aClient, std::move(capturer), std::move(encoder), width, height, viewportWidth, viewportHeight, margin, isVideo ? 0 : quality);
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
  it->second->Stop();
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
