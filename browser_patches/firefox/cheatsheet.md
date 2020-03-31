### Debugging

#### Stack trace

It `mozglue/misc/StackWalk.cpp` add 

```c++
#define MOZ_DEMANGLE_SYMBOLS 1
```

In native code use

```c++
nsTraceRefcnt::WalkTheStack(stderr);
```

If the stack trace is still mangled `cat` it to `tools/rb/fix_linux_stack.py`

#### [Logging](https://developer.mozilla.org/en-US/docs/Mozilla/Developer_guide/Gecko_Logging)

```bash
MOZ_LOG=nsHttp:5
```
Module name is a string passed to the `mozilla::LazyLogModule` of the corresponding component, e.g.:

```c++
LazyLogModule gHttpLog("nsHttp");
```
