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

rtc::scoped_refptr<webrtc::VideoCaptureModule> CreateWindowCapturer(nsIWidget* widget, int sessionId) {
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
  return webrtc::DesktopCaptureImpl::Create(sessionId, windowId.get(), webrtc::CaptureDeviceType::Window, captureCursor);
}

void NotifyScreencastStopped(int32_t sessionId) {
  nsCOMPtr<nsIObserverService> observerService = mozilla::services::GetObserverService();
  if (!observerService) {
    fprintf(stderr, "NotifyScreencastStopped error: no observer service\n");
    return;
  }

  nsString id;
  id.AppendPrintf("%" PRIi32, sessionId);
  observerService->NotifyObservers(nullptr, "juggler-screencast-stopped", id.get());
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
    capability.maxFPS = 24;
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

nsresult nsScreencastService::StartVideoRecording(nsIDocShell* aDocShell, const nsACString& aFileName, uint32_t width, uint32_t height, double scale, int32_t offsetTop, int32_t* sessionId) {
  MOZ_RELEASE_ASSERT(NS_IsMainThread(), "Screencast service must be started on the Main thread.");
  *sessionId = -1;

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

  *sessionId = ++mLastSessionId;
  rtc::scoped_refptr<webrtc::VideoCaptureModule> capturer = CreateWindowCapturer(widget, *sessionId);
  if (!capturer)
    return NS_ERROR_FAILURE;

  nsCString error;
  Maybe<double> maybeScale;
  if (scale)
    maybeScale = Some(scale);
  RefPtr<ScreencastEncoder> encoder = ScreencastEncoder::create(error, PromiseFlatCString(aFileName), width, height, maybeScale, offsetTop);
  if (!encoder) {
    fprintf(stderr, "Failed to create ScreencastEncoder: %s\n", error.get());
    return NS_ERROR_FAILURE;
  }

  auto session = std::make_unique<Session>(std::move(capturer), std::move(encoder));
  if (!session->Start())
    return NS_ERROR_FAILURE;

  mIdToSession.emplace(*sessionId, std::move(session));
  return NS_OK;
}

nsresult nsScreencastService::StopVideoRecording(int32_t sessionId) {
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
