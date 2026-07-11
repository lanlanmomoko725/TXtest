import { describe, expect, it } from "vitest";
import {
  getWeiboEmoticonSource,
  renderWeiboEmoticonsHtml,
  tokenizeWeiboEmoticons,
} from "./weibo-emoticons";

describe("weibo emoticons", () => {
  it("maps common shortcodes to local assets", () => {
    expect(getWeiboEmoticonSource("666")).toBe("/emoticons/weibo/666.png");
    expect(getWeiboEmoticonSource("允悲")).toMatch(/^\/emoticons\/weibo\/.+\.png$/);
    expect(getWeiboEmoticonSource("doge")).toMatch(/^\/emoticons\/weibo\/.+\.png$/);
  });

  it("tokenizes consecutive known shortcodes", () => {
    expect(tokenizeWeiboEmoticons("好耶[666][doge]").map((token) => token.type)).toEqual([
      "text",
      "emoticon",
      "emoticon",
    ]);
  });

  it("keeps unknown shortcodes as text", () => {
    expect(tokenizeWeiboEmoticons("[不存在的表情]")).toEqual([
      { type: "text", value: "[不存在的表情]" },
    ]);
  });

  it("ignores copied zero-width artifacts after a known shortcode", () => {
    const tokens = tokenizeWeiboEmoticons("[666]\u200b\ufeff 后文");
    expect(tokens).toHaveLength(2);
    expect(tokens[1]).toEqual({ type: "text", value: " 后文" });
  });

  it("does not alter unicode emoji or HTML-like unknown text", () => {
    const text = "云散了 🌤️ 👨‍👩‍👧‍👦 [<script>]";
    expect(tokenizeWeiboEmoticons(text)).toEqual([{ type: "text", value: text }]);
  });

  it("marks generated images so content lightboxes can ignore them", () => {
    const html = renderWeiboEmoticonsHtml("厉害[666]");
    expect(html).toContain('data-emoticon="true"');
    expect(html).toContain('alt="[666]"');
    expect(html).not.toContain("face.t.sinajs.cn");
  });
});
