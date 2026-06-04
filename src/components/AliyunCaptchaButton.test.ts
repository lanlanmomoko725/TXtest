import { describe, expect, it } from "vitest";
import { getAliyunCaptchaRem, getAliyunCaptchaSlideStyle } from "./AliyunCaptchaButton";

describe("AliyunCaptchaButton UI options", () => {
  it("uses Aliyun rem as a scale factor instead of a font pixel size", () => {
    expect(getAliyunCaptchaRem()).toBe(1);
  });

  it("keeps slide width inside common mobile and desktop viewports", () => {
    expect(getAliyunCaptchaSlideStyle(375)).toEqual({ width: 343, height: 40 });
    expect(getAliyunCaptchaSlideStyle(1440)).toEqual({ width: 360, height: 40 });
  });
});
