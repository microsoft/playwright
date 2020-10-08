FROM ubuntu:bionic

# 1. Install node12
RUN apt-get update && apt-get install -y curl && \
    curl -sL https://deb.nodesource.com/setup_12.x | bash - && \
    apt-get install -y nodejs

# 2. Install WebKit dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    libwoff1 \
    libopus0 \
    libwebp6 \
    libwebpdemux2 \
    libenchant1c2a \
    libgudev-1.0-0 \
    libsecret-1-0 \
    libhyphen0 \
    libgdk-pixbuf2.0-0 \
    libegl1 \
    libnotify4 \
    libxslt1.1 \
    libevent-2.1-6 \
    libgles2 \
    libvpx5 \
    libxcomposite1 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libepoxy0 \
    libgtk-3-0 \
    libharfbuzz-icu0

# 3. Install gstreamer and plugins to support video playback in WebKit.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgstreamer-gl1.0-0 \
    libgstreamer-plugins-bad1.0-0 \
    gstreamer1.0-plugins-good \
    gstreamer1.0-libav

# 4. Install Chromium dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    libnss3 \
    libxss1 \
    libasound2 \
    fonts-noto-color-emoji \
    libxtst6

# 5. Install Firefox dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    libdbus-glib-1-2 \
    libxt6

# 6. Install ffmpeg to bring in audio and video codecs necessary for playing videos in Firefox.
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg

# 7. (Optional) Install XVFB if there's a need to run browsers in headful mode
RUN apt-get update && apt-get install -y --no-install-recommends \
    xvfb

# 8. Feature-parity with node.js base images.
RUN apt-get update && apt-get install -y --no-install-recommends git ssh && \
    npm install -g yarn

# 9. Create the pwuser (we internally create a symlink for the pwuser and the root user)
RUN adduser pwuser

# === BAKE BROWSERS INTO IMAGE ===

# 1. Add tip-of-tree Playwright package to install its browsers.
#    The package should be built beforehand from tip-of-tree Playwright.
COPY ./playwright.tar.gz /tmp/playwright.tar.gz

# 2. Install playwright and then delete the installation.
#    Browsers will remain downloaded in `/home/pwuser/.cache/ms-playwright`.
RUN su pwuser -c "mkdir /tmp/pw && cd /tmp/pw && npm init -y && \
    npm i /tmp/playwright.tar.gz" && \
    rm -rf /tmp/pw && rm /tmp/playwright.tar.gz

# 3. Symlink downloaded browsers for root user
RUN mkdir /root/.cache/ && \
    ln -s /home/pwuser/.cache/ms-playwright/ /root/.cache/ms-playwright
