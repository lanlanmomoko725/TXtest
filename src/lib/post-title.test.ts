import { describe, expect, it } from "vitest";
import {
  createPostSummary,
  extractPostPlainText,
  getPostPreviewTitle,
  hasExplicitPostTitle,
} from "@contracts/post-title";

describe("post title helpers", () => {
  it("keeps a user supplied title", () => {
    expect(getPostPreviewTitle("  自定义标题  ", "<p>正文</p>")).toBe("自定义标题");
    expect(hasExplicitPostTitle("  自定义标题  ", "<p>正文</p>")).toBe(true);
  });

  it("uses the complete text when the content is short", () => {
    expect(getPostPreviewTitle("", "<p>今天出现了日晕</p>")).toBe("今天出现了日晕");
    expect(hasExplicitPostTitle("", "<p>今天出现了日晕</p>")).toBe(false);
  });

  it("truncates long content to 30 characters", () => {
    const content = `<p>${"天".repeat(31)}</p>`;
    expect(createPostSummary(content)).toBe(`${"天".repeat(30)}…`);
  });

  it("normalizes rich text and decodes common entities", () => {
    expect(extractPostPlainText("<p>云层&nbsp;散开 &amp; 星光出现</p><p>第二段</p>"))
      .toBe("云层 散开 & 星光出现 第二段");
  });

  it("uses an image fallback when rich text has no text", () => {
    expect(createPostSummary('<p><img src="/uploads/example.jpg"></p>')).toBe("图片分享");
  });

  it("treats legacy generated summaries as untitled", () => {
    const content = `<p>${"云".repeat(31)}</p>`;
    expect(hasExplicitPostTitle(`${"云".repeat(30)}...`, content)).toBe(false);
    expect(hasExplicitPostTitle(`${"云".repeat(30)}…`, content)).toBe(false);
  });
});
