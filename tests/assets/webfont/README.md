This font contains two glyphs — `+` (U+2B) and `-` (U+2D) — each rendered as a
simple filled black rectangle. The simplicity makes screenshot tests insensitive
to font-rendering/antialiasing differences across platforms.

## Regenerating

Install dependencies:

```
pip3 install fonttools brotli
```

Run `generate_font.py` to regenerate `iconfont.woff2`:

```
python3 tests/assets/webfont/generate_font.py
```
