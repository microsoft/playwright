### Debugging windows

In `Source\WTF\wtf\win\DbgHelperWin.cpp` replace

```#if !defined(NDEBUG)``` with ```#if 1```

Then regular `WTFReportBacktrace()` works.
