/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#pragma once

#include <memory>
#include <unordered_map>
#include "nsIScreencastService.h"

namespace mozilla {

class nsScreencastService final : public nsIScreencastService {
 public:
  NS_DECL_ISUPPORTS
  NS_DECL_NSISCREENCASTSERVICE

  static already_AddRefed<nsIScreencastService> GetSingleton();

  nsScreencastService();

 private:
  ~nsScreencastService();

  class Session;
  int mLastSessionId = 0;
  std::unordered_map<int, std::unique_ptr<Session>> mIdToSession;
};

}  // namespace mozilla
