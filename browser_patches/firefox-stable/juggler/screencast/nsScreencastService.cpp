/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "nsScreencastService.h"

#include "ScreencastEncoder.h"
#include "HeadlessWidget.h"
#include "HeadlessWindowCapturer.h"
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

using namespace mozilla::widget;

namespace mozilla {

NS_IMPL_ISUPPORTS(nsScreencastService, nsIScreencastService)

namespace {

StaticRefPtr<nsScreencastService> gScreencastService;

rtc::scoped_refptr<webrtc::VideoCaptureModule> CreateWindowCapturer(nsIWidget* widget) {
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

class nsScreencastService::Session : public rtc::VideoSinkInterface<webrtc::VideoFrame> {
 public:
  Session(rtc::scoped_refptr<webrtc::VideoCaptureModule>&& capturer, RefPtr<ScreencastEncoder>&& encoder)
      : mCaptureModule(std::move(capturer))
      , mEncoder(std::move(encoder)) {
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

    mCaptureModule->RegisterCaptureDataCallback(this);
    return true;
  }

  void Stop(std::function<void()>&& callback) {
    mCaptureModule->DeRegisterCaptureDataCallback(this);
    int error = mCaptureModule->StopCapture();
    if (error) {
      fprintf(stderr, "StopCapture error %d\n", error);
    }
    mEncoder->finish(std::move(callback));
  }

  // These callbacks end up running on the VideoCapture thread.
  void OnFrame(const webrtc::VideoFrame& videoFrame) override {
    mEncoder->encodeFrame(videoFrame);
  }

 private:
  rtc::scoped_refptr<webrtc::VideoCaptureModule> mCaptureModule;
  RefPtr<ScreencastEncoder> mEncoder;
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

nsresult nsScreencastService::StartVideoRecording(nsIDocShell* aDocShell, const nsACString& aFileName, uint32_t width, uint32_t height, double scale, int32_t offsetTop, nsAString& sessionId) {
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

  rtc::scoped_refptr<webrtc::VideoCaptureModule> capturer = CreateWindowCapturer(widget);
  if (!capturer)
    return NS_ERROR_FAILURE;

  nsCString error;
  Maybe<double> maybeScale;
  if (scale)
    maybeScale = Some(scale);

  gfx::IntMargin margin;
  // On GTK the bottom of the client rect is below the bounds and
  // client size is actually equal to the size of the bounds so
  // we don't need an adjustment.
#ifndef MOZ_WIDGET_GTK
  auto bounds = widget->GetScreenBounds().ToUnknownRect();
  auto clientBounds = widget->GetClientBounds().ToUnknownRect();
  // Crop the image to exclude frame (if any).
  margin = bounds - clientBounds;
#endif
  // Crop the image to exclude controls.
  margin.top += offsetTop;

  RefPtr<ScreencastEncoder> encoder = ScreencastEncoder::create(error, PromiseFlatCString(aFileName), width, height, maybeScale, margin);
  if (!encoder) {
    fprintf(stderr, "Failed to create ScreencastEncoder: %s\n", error.get());
    return NS_ERROR_FAILURE;
  }

  auto session = std::make_unique<Session>(std::move(capturer), std::move(encoder));
  if (!session->Start())
    return NS_ERROR_FAILURE;

  nsString uid;
  nsresult rv = generateUid(uid);
  NS_ENSURE_SUCCESS(rv, rv);

  sessionId = uid;
  mIdToSession.emplace(uid, std::move(session));
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

}  // namespace mozilla
