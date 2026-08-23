import time


def retry_with_backoff(fn, attempts=3):
    for attempt in range(attempts):
        try:
            return fn()
        except Exception:
            if attempt == attempts - 1:
                raise
            time.sleep(2 ** attempt)
