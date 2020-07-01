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
# To find out crashing process name
file core-pid_29652.dump
# Point gdb to the local binary of the crashed process and the core file
gdb $HOME/.cache/ms-playwright/webkit-1292/minibrowser-gtk/WebKitWebProcess core-pid_29652
# Inside gdb update .so library search path to the local one
set solib-search-path /home/yurys/.cache/ms-playwright/webkit-1292/minibrowser-gtk
# Finally print backtrace
bt
```