export {}

declare global {
    namespace PlaywrightTest {
       interface Matchers<R, T> {
          toHaveLoggedSoftwareDownload(browsers: ("chromium" | "firefox" | "webkit" | "ffmpeg")[]): R;
       }
    }
}
