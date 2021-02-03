/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "nsRemoteDebuggingPipe.h"

#include <cstring>
#if defined(_WIN32)
#include <io.h>
#include <windows.h>
#else
#include <stdio.h>
#include <unistd.h>
#include <sys/socket.h>
#endif

#include "mozilla/StaticPtr.h"
#include "nsISupportsPrimitives.h"
#include "nsThreadUtils.h"

namespace mozilla {

NS_IMPL_ISUPPORTS(nsRemoteDebuggingPipe, nsIRemoteDebuggingPipe)

namespace {

StaticRefPtr<nsRemoteDebuggingPipe> gPipe;

const size_t kWritePacketSize = 1 << 16;

#if defined(_WIN32)
HANDLE readHandle;
HANDLE writeHandle;
#else
const int readFD = 3;
const int writeFD = 4;
#endif

size_t ReadBytes(void* buffer, size_t size, bool exact_size)
{
    size_t bytesRead = 0;
    while (bytesRead < size) {
#if defined(_WIN32)
        DWORD sizeRead = 0;
        bool hadError = !ReadFile(readHandle, static_cast<char*>(buffer) + bytesRead,
            size - bytesRead, &sizeRead, nullptr);
#else
        int sizeRead = read(readFD, static_cast<char*>(buffer) + bytesRead,
            size - bytesRead);
        if (sizeRead < 0 && errno == EINTR)
            continue;
        bool hadError = sizeRead <= 0;
#endif
        if (hadError) {
            return 0;
        }
        bytesRead += sizeRead;
        if (!exact_size)
            break;
    }
    return bytesRead;
}

void WriteBytes(const char* bytes, size_t size)
{
    size_t totalWritten = 0;
    while (totalWritten < size) {
        size_t length = size - totalWritten;
        if (length > kWritePacketSize)
            length = kWritePacketSize;
#if defined(_WIN32)
        DWORD bytesWritten = 0;
        bool hadError = !WriteFile(writeHandle, bytes + totalWritten, static_cast<DWORD>(length), &bytesWritten, nullptr);
#else
        int bytesWritten = write(writeFD, bytes + totalWritten, length);
        if (bytesWritten < 0 && errno == EINTR)
            continue;
        bool hadError = bytesWritten <= 0;
#endif
        if (hadError)
            return;
        totalWritten += bytesWritten;
    }
}

}  // namespace

// static
already_AddRefed<nsIRemoteDebuggingPipe> nsRemoteDebuggingPipe::GetSingleton() {
  if (!gPipe) {
    gPipe = new nsRemoteDebuggingPipe();
  }
  return do_AddRef(gPipe);
}

nsRemoteDebuggingPipe::nsRemoteDebuggingPipe() = default;

nsRemoteDebuggingPipe::~nsRemoteDebuggingPipe() = default;

nsresult nsRemoteDebuggingPipe::Init(nsIRemoteDebuggingPipeClient* aClient) {
  MOZ_RELEASE_ASSERT(NS_IsMainThread(), "Remote debugging pipe must be used on the Main thread.");
  if (mClient) {
    return NS_ERROR_FAILURE;
  }
  mClient = aClient;

  MOZ_ALWAYS_SUCCEEDS(NS_NewNamedThread("Pipe Reader", getter_AddRefs(mReaderThread)));
  MOZ_ALWAYS_SUCCEEDS(NS_NewNamedThread("Pipe Writer", getter_AddRefs(mWriterThread)));

#if defined(_WIN32)
  CHAR pipeReadStr[20];
  CHAR pipeWriteStr[20];
  GetEnvironmentVariableA("PW_PIPE_READ", pipeReadStr, 20);
  GetEnvironmentVariableA("PW_PIPE_WRITE", pipeWriteStr, 20);
  readHandle = reinterpret_cast<HANDLE>(atoi(pipeReadStr));
  writeHandle = reinterpret_cast<HANDLE>(atoi(pipeWriteStr));
#endif

  MOZ_ALWAYS_SUCCEEDS(mReaderThread->Dispatch(NewRunnableMethod(
      "nsRemoteDebuggingPipe::ReaderLoop",
      this, &nsRemoteDebuggingPipe::ReaderLoop), nsIThread::DISPATCH_NORMAL));
  return NS_OK;
}

nsresult nsRemoteDebuggingPipe::Stop() {
  MOZ_RELEASE_ASSERT(NS_IsMainThread(), "Remote debugging pipe must be used on the Main thread.");
  if (!mClient) {
    return NS_ERROR_FAILURE;
  }
  m_terminated = true;
  mClient = nullptr;
  // Cancel pending synchronous read.
#if defined(_WIN32)
  CancelIoEx(readHandle, nullptr);
  CloseHandle(readHandle);
  CloseHandle(writeHandle);
#else
  shutdown(readFD, SHUT_RDWR);
  shutdown(writeFD, SHUT_RDWR);
#endif
  mReaderThread->Shutdown();
  mReaderThread = nullptr;
  mWriterThread->Shutdown();
  mWriterThread = nullptr;
  return NS_OK;
}

void nsRemoteDebuggingPipe::ReaderLoop() {
  const size_t bufSize = 256 * 1024;
  std::vector<char> buffer;
  buffer.resize(bufSize);
  std::vector<char> line;
  while (!m_terminated) {
    size_t size = ReadBytes(buffer.data(), bufSize, false);
    if (!size) {
      nsCOMPtr<nsIRunnable> runnable = NewRunnableMethod<>(
          "nsRemoteDebuggingPipe::Disconnected",
          this, &nsRemoteDebuggingPipe::Disconnected);
      NS_DispatchToMainThread(runnable.forget());
      break;
    }
    size_t start = 0;
    size_t end = line.size();
    line.insert(line.end(), buffer.begin(), buffer.begin() + size);
    while (true) {
      for (; end < line.size(); ++end) {
        if (line[end] == '\0') {
          break;
        }
      }
      if (end == line.size()) {
        break;
      }
      if (end > start) {
        nsCString message;
        message.Append(line.data() + start, end - start);
        nsCOMPtr<nsIRunnable> runnable = NewRunnableMethod<nsCString>(
            "nsRemoteDebuggingPipe::ReceiveMessage",
            this, &nsRemoteDebuggingPipe::ReceiveMessage, std::move(message));
        NS_DispatchToMainThread(runnable.forget());
      }
      ++end;
      start = end;
    }
    if (start != 0 && start < line.size()) {
      memmove(line.data(), line.data() + start, line.size() - start);
    }
    line.resize(line.size() - start);
  }
}

void nsRemoteDebuggingPipe::ReceiveMessage(const nsCString& aMessage) {
  MOZ_RELEASE_ASSERT(NS_IsMainThread(), "Remote debugging pipe must be used on the Main thread.");
  if (mClient) {
    NS_ConvertUTF8toUTF16 utf16(aMessage);
    mClient->ReceiveMessage(utf16);
  }
}

void nsRemoteDebuggingPipe::Disconnected() {
  MOZ_RELEASE_ASSERT(NS_IsMainThread(), "Remote debugging pipe must be used on the Main thread.");
  if (mClient)
    mClient->Disconnected();
}

nsresult nsRemoteDebuggingPipe::SendMessage(const nsAString& aMessage) {
  MOZ_RELEASE_ASSERT(NS_IsMainThread(), "Remote debugging pipe must be used on the Main thread.");
  if (!mClient) {
    return NS_ERROR_FAILURE;
  }
  NS_ConvertUTF16toUTF8 utf8(aMessage);
  nsCOMPtr<nsIRunnable> runnable = NS_NewRunnableFunction(
      "nsRemoteDebuggingPipe::SendMessage",
      [message = std::move(utf8)] {
        const nsCString& flat = PromiseFlatCString(message);
        WriteBytes(flat.Data(), flat.Length());
        WriteBytes("\0", 1);
      });
  MOZ_ALWAYS_SUCCEEDS(mWriterThread->Dispatch(runnable.forget(), nsIThread::DISPATCH_NORMAL));
  return NS_OK;
}

}  // namespace mozilla
