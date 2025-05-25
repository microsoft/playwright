#!/bin/sh
ps ax | grep playwright | grep "vite\|tsc\|esbuild" | sed 's|pts/.*||' | xargs kill
