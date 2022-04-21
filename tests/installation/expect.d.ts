export {}

declare global {
    namespace PlaywrightTest {
       interface Matchers<R, T> {
          toHaveDownloaded(browsers: ("chromium" | "firefox" | "webkit")[]): R;
       }
    }
}
