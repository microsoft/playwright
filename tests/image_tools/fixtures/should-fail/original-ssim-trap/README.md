# Original SSIM trap

[SSIM](https://en.wikipedia.org/wiki/Structural_similarity) is a metric used to compare image similarity.

The sample provides two different images. However, since the original SSIM implementation
[converts images into
gray-scale](https://github.com/obartra/ssim/blob/ca8e3c6a6ff5f4f2e232239e0c3d91806f3c97d5/src/index.ts#L104),
SSIM metric will yield a perfect match for these images.
