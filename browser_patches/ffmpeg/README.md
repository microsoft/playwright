# Playwright and FFMPEG

Playwright requires FFMPEG to produce screncast and bundles FFMPEG binaries for Mac , Linux and Windows.

## Configuration

We compile `libvpx` and `ffmpeg` only. Their source versions and build
configurations are defined in [`//browser_patches/ffmpeg/CONFIG.sh`](./CONFIG.sh).

## Building `ffmpeg-linux`

Compilation scripts are based on:
- https://trac.ffmpeg.org/wiki/CompilationGuide/Generic

Prerequisites:
- Mac or Linux
- Docker

Building:

```
~/playwright$ ./browser_patches/ffmpeg/build.sh --linux
```

## Building `ffmpeg-mac`

Compilation scripts are based on:
- https://trac.ffmpeg.org/wiki/CompilationGuide/Generic
- https://trac.ffmpeg.org/wiki/CompilationGuide/macOS

Prerequisites:
- Mac
- xcode command line tools: `xcode-select --install`
- [homebrew](https://brew.sh/)

Building:

```
~/playwright$ ./browser_patches/ffmpeg/build.sh --mac
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
~/playwright$ ./browser_patches/ffmpeg/build.sh --cross-compile-win32
~/playwright$ ./browser_patches/ffmpeg/build.sh --cross-compile-win64
```

