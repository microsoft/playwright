#!/bin/bash

cat << EndOfMessage
****************************************************************
****************************************************************

ERROR: MacOS version is too old!

This version of Playwright does not support running
WebKit on MacOS 10.14. Please either:
- update your operating system to version 10.15 or higher
- use Playwright v1.11 or older

****************************************************************
****************************************************************
EndOfMessage
exit 1;
