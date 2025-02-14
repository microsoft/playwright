# Playwright Modernizr tests

## Rolling Modernizr

- [modernizr.com](modernizr.com) isn't getting updated anymore, see [here](https://github.com/Modernizr/Modernizr/issues/2490) and [here](https://github.com/Modernizr/Modernizr/commit/db96bdaff995a1d4abccb0dc69c77db7b47ad614). It only contains version 3.6.
- This is why we build it from source ourselves, using `roll.sh` (they recommend it).

## Updating expectations

1. Serve `tests/assets/modernizr/index.html` from a remote (localhost results will be different) https origin (e.g. https://pages.github.com).
1. Navigate to `https://your-domain.com/tests/assets/modernizr/index.html`

Do this with:

- Safari Technology Preview
- Apple iPhone

Make sure to change the updated file's name.
