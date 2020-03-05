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
