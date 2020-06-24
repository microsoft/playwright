### Debugging windows

In `Source\WTF\wtf\win\DbgHelperWin.cpp` replace

```#if !defined(NDEBUG)``` with ```#if 1```

Then regular `WTFReportBacktrace()` works.

### Enable core dumps on Linux

```bash
mkdir -p /tmp/coredumps
sudo bash -c 'echo "/tmp/coredumps/core-pid_%p.dump" > /proc/sys/kernel/core_pattern'
ulimit -c unlimited
```
Then to read stack traces run the following command:
```bash
Tools/jhbuild/jhbuild-wrapper --wpe run gdb --batch -ex "thread apply all bt" WebKitBuild/WPE/Release/bin/MiniBrowser /tmp/coredumps/core-pid_29652.dump &> trace.txt
```