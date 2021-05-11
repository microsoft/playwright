#!/usr/bin/python

import sys
import json

if len(sys.argv) < 2:
    print("ERROR: expected arch: 32bit or 64bit")
    sys.exit(1)

if str(sys.argv[1]) == "--help" or str(sys.argv[1]) == "-h":
    print("Usage: read_files.py [32bit|64bit] <files.cfg path>")
    sys.exit(1)

if len(sys.argv) < 3:
    print("ERROR: expected FILE.cfg path")
    sys.exit(1)

exclude_list = [
    # Windows exclude list
    "chrome_child.dll",
    "gaia1_0.dll",
    "gcp_setup.exe",
    "icudt.dll",
    "interactive_ui_tests.exe",
    "*.manifest",
    # Linux exclude list
    "session",
]

target_arch = sys.argv[1]
file_name = sys.argv[2]

descriptors=[]
if sys.version_info > (3, 0):
    exec(open(file_name).read())
    descriptors = FILES
else:
    variables = {}
    execfile(file_name, variables)
    descriptors = variables['FILES']

def filter_descriptors(entry):
    if 'archive' in entry:
        return False
    if not 'buildtype' in entry:
        return False
    if not 'dev' in entry['buildtype']:
        return False
    if ('arch' in entry) and (entry['arch'] != target_arch):
        return False
    if entry['filename'] in exclude_list:
        return False
    return True

for entry in filter(filter_descriptors, descriptors):
    print(entry['filename'])

