# Binary Files

<!-- GEN:toc-top-level -->
- [Building `PrintDeps.exe`](#building-printdepsexe)
- [Building `ffmpeg-mac`](#building-ffmpeg-mac)
- [Building `ffmpeg-win64.exe`](#building-ffmpeg-win64exe)
- [Building `ffmpeg-win32.exe`](#building-ffmpeg-win32exe)
<!-- GEN:stop -->

## Building `PrintDeps.exe`

`<TK>`

## Building `ffmpeg-mac`

> FFMPEG: [`n4.3.1`](https://github.com/FFmpeg/FFmpeg/releases/tag/n4.3.1)
> libvpx: [`v1.9.0`](https://github.com/webmproject/libvpx/releases/tag/v1.9.0)

I mostly followed steps at https://trac.ffmpeg.org/wiki/CompilationGuide/macOS

1. Clone repo & checkout release tag (we're building release v4.3.1)

```sh
~$ git clone https://git.ffmpeg.org/ffmpeg.git ffmpeg
~$ cd ffmpeg
~/ffmpeg$ git checkout n4.3.1
```

2. Install brew dependencies

```sh
~/ffmpeg$ brew install automake fdk-aac git lame libass libtool libvorbis libvpx \
opus sdl shtool texi2html theora wget x264 x265 xvid nasm
```

3. Prepare output folders

```sh
~/ffmpeg$ mkdir -p output/bin
```

4. Configure with vpx 

```sh
~/ffmpeg$ ./configure --prefix=$PWD/output \
                      --pkg-config-flags="--static" \
                      --bindir=$PWD/output/bin \
                      --disable-everything \
                      --enable-ffmpeg \
                      --enable-protocol=pipe \
                      --enable-protocol=file \
                      --enable-parser=mjpeg \
                      --enable-decoder=mjpeg \
                      --enable-demuxer=image2pipe \
                      --enable-filter=pad \
                      --enable-filter=crop \
                      --enable-filter=scale \
                      --enable-muxer=webm \
                      --enable-encoder=libvpx_vp8 \
                      --enable-libvpx \
                      --enable-static
```

5. Make & install to the `output/bin`

```sh
~/ffmpeg$ make && make install
```

## `ffmpeg-win64.exe`

> FFMPEG: [`n4.3.1`](https://github.com/FFmpeg/FFmpeg/releases/tag/n4.3.1)
> libvpx: [`d1a7897`](https://github.com/webmproject/libvpx/commit/d1a78971ebcfd728c9c73b0cfbee69f470d4dc72)

1. Install `MSYS2` from `https://www.msys2.org` and install to `c:\msys64`

2. Launch `c:\msys64\mingw64` to launch a shell with a proper environment.

3. `MSYS2` uses `pacman` to install dependencies. Run the following commands to update & install packages:

```sh
$ pacman -Syu
$ pacman -Su
$ pacman -S make pkgconf diffutils yasm
$ pacman -S mingw-w64-x86_64-nasm mingw-w64-x86_64-gcc mingw-w64-x86_64-SDL2
```

notes:
- `yasm` is needed for `libvpx`
- the rest is a general compilation toolchain

4. Clone `libvpx` of proper version, compile manually and install to a well-known location (prefix):

```sh
$ cd /c/
$ git clone https://chromium.googlesource.com/webm/libvpx
$ cd libvpx
$ git checkout d1a78971ebcfd728c9c73b0cfbee69f470d4dc72
$ ./configure --prefix=/eee64 --target=x86_64-win64-gcc --enable-static --disable-shared --disable-docs --disable-tools --disable-unit-tests --disable-examples
$ make && make install
```

Note: `libvpx` has a useful readme: https://chromium.googlesource.com/webm/libvpx/+/master/README

5. Once `libvpx` is compiled, compile `ffmpeg` using the just-compiled `libvpx`:

```sh
$ cd /c/
$ git clone git://source.ffmpeg.org/ffmpeg.git
$ cd ffmpeg
$ git checkout n4.3.1
$ ./configure --extra-cflags="-I/eee64/include" \
              --extra-ldflags="-L/eee64/lib -static" \
              --prefix=/eee64 \
              --pkg-config-flags="--static" \
              --bindir=$PWD/output/bin \
              --disable-everything \
              --enable-ffmpeg \
              --enable-protocol=pipe \
              --enable-protocol=file \
              --enable-parser=mjpeg \
              --enable-decoder=mjpeg \
              --enable-demuxer=image2pipe \
              --enable-filter=pad \
              --enable-filter=crop \
              --enable-filter=scale \
              --enable-muxer=webm \
              --enable-libvpx \
              --enable-static \
              --enable-encoder=libvpx_vp8 \
              --disable-pthreads \
              --disable-zlib \
              --disable-iconv \
              --disable-bzlib \
              --disable-w32threads
$ make && make install
```

note: the following resources helped me to deal with some dynamic dependencies in the resulting `ffmpeg.exe`:
- https://stackoverflow.com/questions/13768515/how-to-do-static-linking-of-libwinpthread-1-dll-in-mingw

## Building `ffmpeg-win32.exe`

> FFMPEG: [`n4.3.1`](https://github.com/FFmpeg/FFmpeg/releases/tag/n4.3.1)
> libvpx: [`d1a7897`](https://github.com/webmproject/libvpx/commit/d1a78971ebcfd728c9c73b0cfbee69f470d4dc72)

> NOTE: these steps assume that `ffmpeg-win64.exe` was just built on the machine.

1. Launch `c:\msys64\mingw32` to launch a shell with a proper environment. Not sure if this is required or everything could be done from `mingw64` - but it worked.

2. Update libraries for mingw32

```sh
$ pacman -Syu
$ pacman -Su
```

3. Uninstall the `x86_64` compilers that we installed to build win64 version:

```sh
$ pacman -R mingw-w64-x86_64-nasm mingw-w64-x86_64-gcc mingw-w64-x86_64-SDL2
```

4. Install the i686 compilers instead of their x86_64 counterparts:

```sh
$ pacman -S mingw-w64-i686-nasm mingw-w64-i686-gcc mingw-w64-i686-SDL2
```

5. Remove all old source folders - we'll re-clone everything later for simplicity

```sh
$ rm -rf /c/ffmpeg && rm -rf /c/libvpx
```

6. Clone & compile libvpx. Notice a change: `--target=x86-win32-gcc`

```sh
$ cd /c/
$ git clone https://chromium.googlesource.com/webm/libvpx
$ cd libvpx
$ ./configure --prefix=/eee32 --target=x86-win32-gcc --enable-static --disable-shared --disable-docs --disable-tools --disable-unit-tests --disable-examples
$ make && make install
```

7. Clone & compile ffmpeg

```sh
$ cd /c/
$ git clone git://source.ffmpeg.org/ffmpeg.git
$ cd ffmpeg
$ git checkout n4.3.1
$ ./configure --extra-cflags="-I/eee32/include" \
              --extra-ldflags="-L/eee32/lib -static" \
              --prefix=/eee32 \
              --pkg-config-flags="--static" \
              --bindir=$PWD/output/bin \
              --disable-everything \
              --enable-ffmpeg \
              --enable-protocol=pipe \
              --enable-protocol=file \
              --enable-parser=mjpeg \
              --enable-decoder=mjpeg \
              --enable-demuxer=image2pipe \
              --enable-filter=pad \
              --enable-filter=crop \
              --enable-filter=scale \
              --enable-muxer=webm \
              --enable-libvpx \
              --enable-static \
              --enable-encoder=libvpx_vp8 \
              --disable-pthreads \
              --disable-zlib \
              --disable-iconv \
              --disable-bzlib \
              --disable-w32threads
$ make && make install
```

note: using `-j` for make somehow breaks compilation - so I'd suggest compiling everything in one thread.

