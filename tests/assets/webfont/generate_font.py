#!/usr/bin/env python3
# Copyright (c) Microsoft Corporation.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
# http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
"""Generate iconfont.woff2 with simple rectangle glyphs for + (U+2B) and - (U+2D).

Requirements: pip3 install fonttools brotli
"""

import os

from fontTools.fontBuilder import FontBuilder
from fontTools.pens.t2CharStringPen import T2CharStringPen

fb = FontBuilder(1000, isTTF=False)
fb.setupGlyphOrder([".notdef", "plus", "hyphen"])
fb.setupCharacterMap({0x2B: "plus", 0x2D: "hyphen"})

fb.setupHorizontalMetrics({
    ".notdef": (1000, 0),
    "plus": (1000, 100),
    "hyphen": (1000, 100),
})
fb.setupHorizontalHeader(ascent=850, descent=-150)
fb.setupNameTable({
    "familyName": "pwtest-iconfont",
    "styleName": "Regular",
})
fb.setupOS2(sTypoAscender=850, sTypoDescender=-150, sTypoLineGap=0,
            usWinAscent=850, usWinDescent=150)
fb.setupPost()

charstrings = {}
pen = T2CharStringPen(1000, None)
charstrings[".notdef"] = pen.getCharString()

for name in ["plus", "hyphen"]:
    pen = T2CharStringPen(1000, None)
    pen.moveTo((100, 0))
    pen.lineTo((900, 0))
    pen.lineTo((900, 700))
    pen.lineTo((100, 700))
    pen.closePath()
    charstrings[name] = pen.getCharString()

fb.setupCFF(
    psName="pwtest-iconfont",
    fontInfo={"version": "1.0"},
    charStringsDict=charstrings,
    privateDict={}
)

fb.font.flavor = "woff2"
output_path = os.path.join(os.path.dirname(__file__), "iconfont.woff2")
fb.font.save(output_path)
print(f"Saved {output_path}")
