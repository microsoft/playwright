#!/bin/sh
ps ax | grep playwright | grep "vite\|tsc\|babel\|esbuild" | sed 's|pts/.*||' | xargs kill

