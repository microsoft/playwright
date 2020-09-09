# Playwright and FFMPEG

Playwright requires FFMPEG to produce screncast. Playwright relies on stock
FFMPEG on Ubuntu, and bundles FFMPEG binaries for Mac and Windows.

## Configuration

We compile `libvpx` and `ffmpeg` only. Their source versions and build
configurations are defined in [`//browser_patches/ffmpeg/CONFIG.sh`](./CONFIG.sh).

## Building `ffmpeg-mac`

Cross-compilation scripts are based on:
- https://trac.ffmpeg.org/wiki/CompilationGuide/Generic
- https://trac.ffmpeg.org/wiki/CompilationGuide/macOS

Prerequisites:
- Mac
- xcode command line tools: `xcode-select --install`
- [homebrew](https://brew.sh/)

Building:

```
~/playwright$ ./third_party/ffmpeg/build-mac.sh
```

## Building `ffmpeg-win*`

Cross-compilation scripts are based on:
- https://trac.ffmpeg.org/wiki/CompilationGuide/Generic
- https://trac.ffmpeg.org/wiki/CompilationGuide/CrossCompilingForWindows

Prerequisites:
- Mac or Linux
- [Docker](https://www.docker.com/)

Building:

```
~/playwright$ ./third_party/ffmpeg/build-win.sh --all
```

