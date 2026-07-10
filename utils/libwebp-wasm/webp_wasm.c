/*
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// Minimal WASM wrapper around libwebp's encode/decode RGBA API. Exposes exactly
// what the codec benchmark needs: RGBA -> WebP (lossy or lossless) and
// WebP -> RGBA. Memory is owned by libwebp and released via webp_free().
#include <stddef.h>
#include <stdint.h>
#include <emscripten.h>
#include "webp/encode.h"
#include "webp/decode.h"

// Encode RGBA (width*height*4, row stride = width*4) to a WebP bitstream.
//   lossless == 0: lossy, `quality` is the 0..100 quality factor.
//   lossless != 0: lossless (pixels preserved exactly); `quality` is the 0..100
//                  compression effort (higher = smaller/slower).
// Returns a pointer to the libwebp-allocated output and writes its byte length
// to *out_size. Returns NULL (and *out_size == 0) on failure. Free the returned
// pointer with webp_free().
EMSCRIPTEN_KEEPALIVE
uint8_t* webp_encode_rgba(const uint8_t* rgba, int width, int height,
                          float quality, int lossless, size_t* out_size) {
  *out_size = 0;

  WebPConfig config;
  if (!WebPConfigInit(&config))
    return NULL;
  config.lossless = lossless ? 1 : 0;
  config.quality = quality;
  if (!WebPValidateConfig(&config))
    return NULL;

  WebPPicture pic;
  if (!WebPPictureInit(&pic))
    return NULL;
  pic.use_argb = config.lossless;  // lossless encodes from the ARGB buffer
  pic.width = width;
  pic.height = height;

  WebPMemoryWriter writer;
  WebPMemoryWriterInit(&writer);
  pic.writer = WebPMemoryWrite;
  pic.custom_ptr = &writer;

  const int ok = WebPPictureImportRGBA(&pic, rgba, width * 4) &&
                 WebPEncode(&config, &pic);
  WebPPictureFree(&pic);
  if (!ok) {
    WebPMemoryWriterClear(&writer);
    return NULL;
  }
  *out_size = writer.size;
  return writer.mem;  // WebPMalloc'd; release with webp_free()
}

// Decode a WebP bitstream to RGBA. Returns a pointer to the libwebp-allocated
// RGBA buffer (width*height*4) and writes the dimensions to *width/*height.
// Returns NULL on failure. Free the returned pointer with webp_free().
EMSCRIPTEN_KEEPALIVE
uint8_t* webp_decode_rgba(const uint8_t* data, size_t size,
                          int* width, int* height) {
  return WebPDecodeRGBA(data, size, width, height);
}

// Release a buffer returned by webp_encode_rgba/webp_decode_rgba.
EMSCRIPTEN_KEEPALIVE
void webp_free(void* ptr) {
  WebPFree(ptr);
}
