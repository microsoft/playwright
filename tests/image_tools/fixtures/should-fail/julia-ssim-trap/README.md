# Julia SSIM trap

[SSIM](https://en.wikipedia.org/wiki/Structural_similarity) is a metric used to compare image similarity.

While original SSIM is computed against the luma channel (i.e. in a gray-scale),
the Julia language [computes a weighted combination of per-channel SSIM's](https://github.com/JuliaImages/ImageQualityIndexes.jl/blob/e014cee9bef7023a1047b6eb0cbe49fbf28f2fed/src/ssim.jl#L39-L41).

This sample is a white image and a gray image that are reported equal by Julia SSIM.
It also traps all the suggestions for color-weighted SSIM given here:
https://dsp.stackexchange.com/questions/75187/how-to-apply-the-ssim-measure-on-rgb-images

