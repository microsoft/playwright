/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "nsScreencastService.h"

#include "ScreencastEncoder.h"
#include "mozilla/ClearOnShutdown.h"
#include "mozilla/PresShell.h"
#include "mozilla/StaticPtr.h"
#include "nsIDocShell.h"
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

namespace mozilla {

NS_IMPL_ISUPPORTS(nsScreencastService, nsIScreencastService)

namespace {

StaticRefPtr<nsScreencastService> gScreencastService;

}

class nsScreencastService::Session : public rtc::VideoSinkInterface<webrtc::VideoFrame> {
 public:
  Session(int sessionId, const nsCString& windowId, RefPtr<ScreencastEncoder>&& encoder)
      : mSessionId(sessionId)
      , mCaptureModule(webrtc::DesktopCaptureImpl::Create(
            sessionId, windowId.get(), webrtc::CaptureDeviceType::Window))
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

  void Stop() {
    mCaptureModule->DeRegisterCaptureDataCallback(this);
    int error = mCaptureModule->StopCapture();
    if (error) {
      fprintf(stderr, "StopCapture error %d\n", error);
      return;
    }
  }

  // These callbacks end up running on the VideoCapture thread.
  void OnFrame(const webrtc::VideoFrame& videoFrame) override {
    mEncoder->encodeFrame(videoFrame);
  }

 private:
  int mSessionId;
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

nsresult nsScreencastService::StartVideoRecording(nsIDocShell* aDocShell, const nsACString& aFileName, int32_t* sessionId) {
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

#ifdef MOZ_WIDGET_GTK
  mozilla::widget::CompositorWidgetInitData initData;
  widget->GetCompositorWidgetInitData(&initData);
  const mozilla::widget::GtkCompositorWidgetInitData& gtkInitData = initData.get_GtkCompositorWidgetInitData();
  nsCString windowId;
# ifdef MOZ_X11
  windowId.AppendPrintf("%lu", gtkInitData.XWindow());
# else
  // TODO: support in wayland
  return NS_ERROR_NOT_IMPLEMENTED;
# endif
  *sessionId = ++mLastSessionId;
  nsCString error;
  RefPtr<ScreencastEncoder> encoder = ScreencastEncoder::create(error, PromiseFlatCString(aFileName), 1280, 960, Nothing());
  if (!encoder) {
    fprintf(stderr, "Failed to create ScreencastEncoder: %s\n", error.get());
    return NS_ERROR_FAILURE;
  }

  auto session = std::make_unique<Session>(*sessionId, windowId, std::move(encoder));
  if (!session->Start())
    return NS_ERROR_FAILURE;

  mIdToSession.emplace(*sessionId, std::move(session));
  return NS_OK;
#else
  // TODO: support Windows and Mac.
  return NS_ERROR_NOT_IMPLEMENTED;
#endif
}

nsresult nsScreencastService::StopVideoRecording(int32_t sessionId) {
  auto it = mIdToSession.find(sessionId);
  if (it == mIdToSession.end())
    return NS_ERROR_INVALID_ARG;
  it->second->Stop();
  mIdToSession.erase(it);
  return NS_OK;
}

}  // namespace mozilla
