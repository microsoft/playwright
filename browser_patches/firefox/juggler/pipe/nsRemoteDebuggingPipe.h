/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#pragma once

#include <memory>
#include "nsCOMPtr.h"
#include "nsIRemoteDebuggingPipe.h"
#include "nsThread.h"

namespace mozilla {

class nsRemoteDebuggingPipe final : public nsIRemoteDebuggingPipe {
 public:
  NS_DECL_THREADSAFE_ISUPPORTS
  NS_DECL_NSIREMOTEDEBUGGINGPIPE

  static already_AddRefed<nsIRemoteDebuggingPipe> GetSingleton();
  nsRemoteDebuggingPipe();

 private:
  void ReaderLoop();
  void ReceiveMessage(const nsCString& aMessage);
  ~nsRemoteDebuggingPipe();

  RefPtr<nsIRemoteDebuggingPipeClient> mClient;
  nsCOMPtr<nsIThread> mReaderThread;
  nsCOMPtr<nsIThread> mWriterThread;
  std::atomic<bool> m_terminated { false };
};

}  // namespace mozilla
