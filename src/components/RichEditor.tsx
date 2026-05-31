import { useRef, useState, useCallback, useEffect } from "react";
import {
  Bold,
  Italic,
  Heading1,
  Heading2,
  ImagePlus,
  List,
  Quote,
  Loader2,
  Link as LinkIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Indent,
  Outdent,
  Undo,
  Redo,
  Video,
  X,
} from "lucide-react";
import {
  BILIBILI_IFRAME_ATTRS,
  parseVideoUrl,
  type VideoEmbed,
} from "@contracts/video-embed";
import { uploadImage } from "@/lib/upload";

interface RichEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: string;
}

const EDITABLE_BLOCK_SELECTOR = "p,h2,h3,blockquote,li";
const BLOCK_SELECTOR = `${EDITABLE_BLOCK_SELECTOR},figure`;
const FIRST_LINE_INDENT = "2em";
const IMAGE_WIDTH_OPTIONS = [50, 75, 100] as const;
const LINE_HEIGHT_OPTIONS = [
  { label: "行距", value: "" },
  { label: "1.5", value: "1.5" },
  { label: "1.75", value: "1.75" },
  { label: "2", value: "2" },
  { label: "2.25", value: "2.25" },
] as const;
const LETTER_SPACING_OPTIONS = [
  { label: "字距", value: "" },
  { label: "0.02", value: "0.02em" },
  { label: "0.05", value: "0.05em" },
  { label: "0.1", value: "0.1em" },
] as const;

function isNodeInside(root: HTMLElement, node: Node | null): boolean {
  return !!node && (node === root || root.contains(node));
}

function getBlockFromNode(node: Node | null, root: HTMLElement): HTMLElement | null {
  if (!node) return null;
  let current: Node | null = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;

  while (current && current !== root) {
    if (current instanceof HTMLElement && current.matches(BLOCK_SELECTOR)) {
      return current;
    }
    current = current.parentElement;
  }

  return null;
}

function getCurrentBlock(root: HTMLElement): HTMLElement | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  return getBlockFromNode(sel.anchorNode, root);
}

function getSelectedEditableBlocks(root: HTMLElement): HTMLElement[] {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return [];
  const range = selection.getRangeAt(0);
  if (!isNodeInside(root, range.commonAncestorContainer)) return [];

  if (range.collapsed) {
    const block = getBlockFromNode(range.startContainer, root);
    return block && block.matches(EDITABLE_BLOCK_SELECTOR) ? [block] : [];
  }

  const blocks = Array.from(root.querySelectorAll<HTMLElement>(EDITABLE_BLOCK_SELECTOR))
    .filter((block) => {
      try {
        return range.intersectsNode(block);
      } catch {
        return false;
      }
    });

  if (blocks.length > 0) return blocks;

  const block = getBlockFromNode(range.startContainer, root);
  return block && block.matches(EDITABLE_BLOCK_SELECTOR) ? [block] : [];
}

function hasVisibleContent(node: HTMLElement): boolean {
  const text = node.textContent?.replace(/\u200B/g, "").trim() ?? "";
  return text.length > 0 || !!node.querySelector("img,iframe,video");
}

function ensureEditableParagraph(block: HTMLElement) {
  if (!hasVisibleContent(block)) {
    block.innerHTML = "<br>";
  }
}

function normalizeLinkUrl(input: string): string | null {
  const value = input.trim();
  if (!value) return null;
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

function moveSelectionTo(block: HTMLElement) {
  const selection = window.getSelection();
  if (!selection) return;
  const range = document.createRange();
  range.setStart(block, 0);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

function normalizeTopLevelDivs(root: HTMLElement) {
  Array.from(root.children).forEach((child) => {
    if (!(child instanceof HTMLElement) || child.tagName.toLowerCase() !== "div") return;
    if (child.classList.contains("video-embed-frame")) return;

    const p = document.createElement("p");
    p.innerHTML = child.innerHTML || "<br>";
    child.replaceWith(p);
  });
}

function splitBlockAndInsertAtomicBlock(range: Range, currentBlock: HTMLElement, block: HTMLElement): HTMLElement {
  range.deleteContents();

  const newP = document.createElement("p");
  newP.innerHTML = "<br>";

  if (!currentBlock.matches(EDITABLE_BLOCK_SELECTOR) || currentBlock.tagName.toLowerCase() === "li") {
    range.insertNode(block);
    block.after(newP);
    return newP;
  }

  const afterRange = document.createRange();
  afterRange.selectNodeContents(currentBlock);
  afterRange.setStart(range.startContainer, range.startOffset);
  const afterContent = afterRange.extractContents();
  const afterBlock = currentBlock.cloneNode(false) as HTMLElement;
  afterBlock.appendChild(afterContent);

  ensureEditableParagraph(currentBlock);

  currentBlock.after(block);
  block.after(newP);

  if (hasVisibleContent(afterBlock)) {
    newP.after(afterBlock);
  }

  return newP;
}

function createEmptyParagraph(): HTMLElement {
  const p = document.createElement("p");
  p.innerHTML = "<br>";
  return p;
}

function isEditorEmptyContent(root: HTMLElement): boolean {
  const text = root.textContent?.replace(/\u200B/g, "").trim() ?? "";
  return text.length === 0 && !root.querySelector("img,iframe,video");
}

export default function RichEditor({
  value,
  onChange,
  placeholder = "开始写作...",
  minHeight = "400px",
}: RichEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isEmpty, setIsEmpty] = useState(!value || value === "<p><br></p>");
  const enterCleanupTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedRangeRef = useRef<Range | null>(null);
  const videoUrlInputRef = useRef<HTMLInputElement>(null);
  const [videoDialogOpen, setVideoDialogOpen] = useState(false);
  const [videoUrl, setVideoUrl] = useState("");
  const [videoTitle, setVideoTitle] = useState("");
  const [videoError, setVideoError] = useState("");
  const [activeBlockTag, setActiveBlockTag] = useState("");
  const [firstLineIndented, setFirstLineIndented] = useState(false);
  const [lineHeightValue, setLineHeightValue] = useState("");
  const [letterSpacingValue, setLetterSpacingValue] = useState("");
  // Image alignment toolbar state
  const [imgToolbar, setImgToolbar] = useState<{
    visible: boolean;
    x: number;
    y: number;
    figure: HTMLElement | null;
  }>({ visible: false, x: 0, y: 0, figure: null });

  // Initialize editor content
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    if (value && value !== el.innerHTML) {
      el.innerHTML = value;
      setIsEmpty(isEditorEmptyContent(el));
    } else if (!value) {
      el.innerHTML = "<p><br></p>";
      setIsEmpty(true);
    }
  }, [value]);

  useEffect(() => {
    return () => {
      if (enterCleanupTimeoutRef.current) {
        clearTimeout(enterCleanupTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!videoDialogOpen) return;
    const timer = window.setTimeout(() => videoUrlInputRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [videoDialogOpen]);

  const handleInput = () => {
    const el = editorRef.current;
    if (!el) return;
    const html = el.innerHTML;
    setIsEmpty(isEditorEmptyContent(el));
    onChange(html);
  };

  const updateToolbarState = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    const block = getCurrentBlock(el);
    const tag = block?.tagName.toLowerCase() ?? "";
    setActiveBlockTag(tag);
    setFirstLineIndented(block instanceof HTMLElement && block.style.textIndent.trim().toLowerCase() === FIRST_LINE_INDENT);
    setLineHeightValue(block instanceof HTMLElement ? block.style.lineHeight.trim() : "");
    setLetterSpacingValue(block instanceof HTMLElement ? block.style.letterSpacing.trim() : "");
  }, []);

  const saveSelection = useCallback(() => {
    const el = editorRef.current;
    const selection = window.getSelection();
    if (!el || !selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    if (el.contains(range.commonAncestorContainer)) {
      savedRangeRef.current = range.cloneRange();
    }
  }, []);

  const restoreSavedSelection = useCallback(() => {
    const el = editorRef.current;
    const selection = window.getSelection();
    if (!el || !selection || !savedRangeRef.current) return false;
    if (!isNodeInside(el, savedRangeRef.current.commonAncestorContainer)) return false;
    try {
      el.focus();
      selection.removeAllRanges();
      selection.addRange(savedRangeRef.current.cloneRange());
      return true;
    } catch {
      savedRangeRef.current = null;
      return false;
    }
  }, []);

  const openVideoDialog = useCallback(() => {
    saveSelection();
    setVideoUrl("");
    setVideoTitle("");
    setVideoError("");
    setVideoDialogOpen(true);
  }, [saveSelection]);

  const closeVideoDialog = useCallback(() => {
    setVideoDialogOpen(false);
    setVideoError("");
  }, []);

  const insertAtomicBlockAtSelection = useCallback((block: HTMLElement) => {
    const el = editorRef.current;
    if (!el) return;

    el.focus();
    restoreSavedSelection();

    const activeSelection = window.getSelection();
    const range = activeSelection && activeSelection.rangeCount > 0 ? activeSelection.getRangeAt(0) : null;

    if (range && isNodeInside(el, range.commonAncestorContainer)) {
      const currentBlock = getBlockFromNode(range.startContainer, el);
      const canSplitBlock = !!currentBlock
        && currentBlock.tagName.toLowerCase() !== "figure"
        && range.collapsed
        && isNodeInside(currentBlock, range.startContainer);
      const newP = canSplitBlock
        ? splitBlockAndInsertAtomicBlock(range, currentBlock!, block)
        : createEmptyParagraph();

      if (!canSplitBlock) {
        range.deleteContents();
        range.insertNode(block);
        block.after(newP);
      }

      moveSelectionTo(newP);
    } else {
      const newP = createEmptyParagraph();
      el.appendChild(block);
      el.appendChild(newP);
      moveSelectionTo(newP);
    }

    savedRangeRef.current = null;
    updateToolbarState();
  }, [restoreSavedSelection, updateToolbarState]);

  const insertBlockAfterSelection = useCallback((block: HTMLElement) => {
    insertAtomicBlockAtSelection(block);
  }, [insertAtomicBlockAtSelection]);

  const insertVideoFromDialog = useCallback(() => {
    const video = parseVideoUrl(videoUrl, videoTitle);
    if (!video) {
      setVideoError("请粘贴哔哩哔哩完整视频页链接或官方播放器链接；暂不支持 b23.tv 短链。");
      return;
    }

    insertBlockAfterSelection(createVideoFigure(video));
    handleInput();
    closeVideoDialog();
  }, [closeVideoDialog, insertBlockAfterSelection, videoTitle, videoUrl]);

  const execCmd = useCallback((command: string, valueArg: string = "") => {
    document.execCommand(command, false, valueArg);
    editorRef.current?.focus();
    handleInput();
    updateToolbarState();
  }, [updateToolbarState]);

  const toggleBlockFormat = useCallback((tagName: "h2" | "h3" | "blockquote") => {
    const el = editorRef.current;
    if (!el) return;

    el.focus();
    const block = getCurrentBlock(el);
    const isActive = block?.tagName.toLowerCase() === tagName;
    const nextTag = isActive ? "P" : tagName === "blockquote" ? "blockquote" : tagName.toUpperCase();
    document.execCommand("formatBlock", false, nextTag);
    handleInput();
    updateToolbarState();
  }, [updateToolbarState]);

  const applyFirstLineIndent = useCallback((mode: "toggle" | "apply" | "clear") => {
    const el = editorRef.current;
    if (!el) return;

    el.focus();
    const blocks = getSelectedEditableBlocks(el);
    if (blocks.length === 0) return;

    const allIndented = blocks.every((block) => block.style.textIndent.trim().toLowerCase() === FIRST_LINE_INDENT);
    const shouldClear = mode === "clear" || (mode === "toggle" && allIndented);

    blocks.forEach((block) => {
      block.style.textIndent = shouldClear ? "" : FIRST_LINE_INDENT;
    });

    handleInput();
    updateToolbarState();
  }, [updateToolbarState]);

  const applyBlockStyle = useCallback((property: "line-height" | "letter-spacing", value: string) => {
    const el = editorRef.current;
    if (!el) return;

    restoreSavedSelection();
    el.focus();
    const blocks = getSelectedEditableBlocks(el);
    if (blocks.length === 0) return;

    blocks.forEach((block) => {
      if (value) {
        block.style.setProperty(property, value);
      } else {
        block.style.removeProperty(property);
      }
    });

    handleInput();
    updateToolbarState();
  }, [restoreSavedSelection, updateToolbarState]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Tab") {
      e.preventDefault();
      applyFirstLineIndent(e.shiftKey ? "clear" : "apply");
      return;
    }

    if (e.key === "Enter" && !e.shiftKey) {
      // Let default behavior happen but ensure we get p tags
      // The browser usually handles this well in contentEditable with execCommand
      // But we need to clean up after
      if (enterCleanupTimeoutRef.current) {
        clearTimeout(enterCleanupTimeoutRef.current);
      }
      enterCleanupTimeoutRef.current = setTimeout(() => {
        const el = editorRef.current;
        if (!el) return;
        normalizeTopLevelDivs(el);
        handleInput();
        updateToolbarState();
        enterCleanupTimeoutRef.current = null;
      }, 0);
    }
  };

  const insertImage = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      alert("请选择图片文件");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert("图片大小不能超过10MB");
      return;
    }

    setUploading(true);

    try {
      const data: { success: boolean; url?: string; error?: string } = { success: true, url: await uploadImage(file) };
      if (data.success && data.url) {
        insertAtomicBlockAtSelection(createImageFigure(data.url));
        handleInput();
      } else {
        alert(data.error || "图片上传失败");
      }
    } catch (err) {
      console.error("Image upload failed:", err);
      alert("图片上传失败");
    } finally {
      setUploading(false);
    }
  }, [insertAtomicBlockAtSelection]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    for (const file of Array.from(files)) {
      await insertImage(file);
    }
    e.target.value = "";
  };

  const handlePaste = useCallback(async (e: React.ClipboardEvent<HTMLDivElement>) => {
    const itemFiles = Array.from(e.clipboardData.items)
      .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
      .map((item) => item.getAsFile())
      .filter((file): file is File => file !== null);
    const files = itemFiles.length > 0
      ? itemFiles
      : Array.from(e.clipboardData.files).filter((file) => file.type.startsWith("image/"));

    if (files.length === 0) return;

    e.preventDefault();
    for (const file of files) {
      await insertImage(file);
    }
  }, [insertImage]);

  const insertLink = useCallback(() => {
    const url = prompt("请输入链接地址：");
    if (url) {
      const normalizedUrl = normalizeLinkUrl(url);
      if (!normalizedUrl) {
        alert("请输入 http(s) 链接或站内相对路径");
        return;
      }
      execCmd("createLink", normalizedUrl);
    }
  }, [execCmd]);

  const handleIndent = useCallback(() => {
    execCmd("indent");
  }, [execCmd]);

  const handleOutdent = useCallback(() => {
    execCmd("outdent");
  }, [execCmd]);

  const handleFirstLineIndent = useCallback(() => {
    applyFirstLineIndent("toggle");
  }, [applyFirstLineIndent]);

  // Handle click on images to show alignment toolbar
  const handleEditorClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    window.setTimeout(updateToolbarState, 0);
    if (target.tagName === "IMG") {
      const figure = target.closest("figure") as HTMLElement;
      const rect = target.getBoundingClientRect();
      setImgToolbar({
        visible: true,
        x: rect.left + rect.width / 2,
        y: rect.top - 10,
        figure: figure || target,
      });
    } else {
      setImgToolbar({ visible: false, x: 0, y: 0, figure: null });
    }
  }, [updateToolbarState]);

  const hideImgToolbar = useCallback(() => {
    setImgToolbar({ visible: false, x: 0, y: 0, figure: null });
  }, []);

  const alignImage = useCallback((align: "left" | "center" | "right") => {
    const el = imgToolbar.figure as HTMLElement | null;
    if (!el) return;
    if (el.tagName === "FIGURE") {
      const width = el.style.width || "75%";
      el.style.textAlign = align;
      el.style.margin = align === "center"
        ? "12px auto"
        : align === "left"
          ? "12px auto 12px 0"
          : "12px 0 12px auto";
      el.style.display = "block";
      el.style.width = width;
    } else {
      // Plain IMG without figure wrapper
      const img = el as HTMLImageElement;
      const parent = img.parentElement;
      if (parent) {
        parent.style.textAlign = align;
      }
      img.style.display = "inline-block";
      img.style.margin = align === "center"
        ? "12px auto"
        : align === "left"
          ? "12px 12px 12px 0"
          : "12px 0 12px 12px";
    }
    hideImgToolbar();
    handleInput();
  }, [imgToolbar, hideImgToolbar]);

  const setImageWidth = useCallback((width: number) => {
    const el = imgToolbar.figure as HTMLElement | null;
    if (!el) return;
    const targetWidth = `${width}%`;

    if (el.tagName === "FIGURE") {
      el.style.width = targetWidth;
      el.style.maxWidth = "100%";
      el.style.display = "block";
      const img = el.querySelector("img") as HTMLImageElement | null;
      if (img) {
        img.style.width = "100%";
        img.style.maxWidth = "100%";
      }
    } else {
      const img = el as HTMLImageElement;
      img.style.width = targetWidth;
      img.style.maxWidth = "100%";
    }

    handleInput();
  }, [imgToolbar]);


  return (
    <div className="border rounded-xl overflow-hidden bg-white shadow-sm">
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-3 py-2.5 border-b bg-slate-50 flex-wrap select-none">
        <ToolbarButton onClick={() => execCmd("bold")} title="加粗 (Ctrl+B)">
          <Bold className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => execCmd("italic")} title="斜体 (Ctrl+I)">
          <Italic className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarDivider />
        <ToolbarButton onClick={() => toggleBlockFormat("h2")} title="大标题" active={activeBlockTag === "h2"}>
          <Heading1 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => toggleBlockFormat("h3")} title="小标题" active={activeBlockTag === "h3"}>
          <Heading2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarDivider />
        <ToolbarButton onClick={() => execCmd("insertUnorderedList")} title="无序列表">
          <List className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => toggleBlockFormat("blockquote")} title="引用" active={activeBlockTag === "blockquote"}>
          <Quote className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => execCmd("justifyLeft")} title="左对齐">
          <AlignLeft className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => execCmd("justifyCenter")} title="居中">
          <AlignCenter className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => execCmd("justifyRight")} title="右对齐">
          <AlignRight className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => execCmd("justifyFull")} title="两端对齐">
          <AlignJustify className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarSelect
          title="行距"
          value={lineHeightValue}
          options={LINE_HEIGHT_OPTIONS}
          onPointerDown={saveSelection}
          onChange={(value) => applyBlockStyle("line-height", value)}
        />
        <ToolbarSelect
          title="字距"
          value={letterSpacingValue}
          options={LETTER_SPACING_OPTIONS}
          onPointerDown={saveSelection}
          onChange={(value) => applyBlockStyle("letter-spacing", value)}
        />
        <ToolbarDivider />
        <ToolbarButton onClick={handleIndent} title="增加缩进">
          <Indent className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={handleOutdent} title="减少缩进">
          <Outdent className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={handleFirstLineIndent}
          title="首行缩进（两个中文字符）"
          active={firstLineIndented}
        >
          <span className="text-xs font-bold leading-none">↦2</span>
        </ToolbarButton>
        <ToolbarDivider />
        <ToolbarButton onClick={insertLink} title="插入链接">
          <LinkIcon className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => {
            saveSelection();
            fileInputRef.current?.click();
          }}
          disabled={uploading}
          title="插入图片"
          active={false}
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ImagePlus className="h-4 w-4" />
          )}
        </ToolbarButton>
        <ToolbarButton onClick={openVideoDialog} title="插入视频">
          <Video className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarDivider />
        <ToolbarButton onClick={() => execCmd("undo")} title="撤销">
          <Undo className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => execCmd("redo")} title="重做">
          <Redo className="h-4 w-4" />
        </ToolbarButton>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          multiple
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {videoDialogOpen && (
        <div className="border-b bg-white px-4 py-3">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(180px,260px)_auto] md:items-end">
            <label className="grid gap-1.5 text-sm font-medium text-slate-700">
              视频链接
              <input
                ref={videoUrlInputRef}
                type="url"
                value={videoUrl}
                onChange={(e) => {
                  setVideoUrl(e.target.value);
                  setVideoError("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    insertVideoFromDialog();
                  }
                  if (e.key === "Escape") {
                    closeVideoDialog();
                  }
                }}
                className="h-9 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                placeholder="粘贴哔哩哔哩视频页链接"
              />
            </label>
            <label className="grid gap-1.5 text-sm font-medium text-slate-700">
              标题
              <input
                type="text"
                value={videoTitle}
                onChange={(e) => setVideoTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    insertVideoFromDialog();
                  }
                  if (e.key === "Escape") {
                    closeVideoDialog();
                  }
                }}
                className="h-9 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                placeholder="可选"
              />
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={insertVideoFromDialog}
                className="h-9 rounded-md bg-sky-600 px-3 text-sm font-medium text-white transition-colors hover:bg-sky-700"
              >
                插入
              </button>
              <button
                type="button"
                onClick={closeVideoDialog}
                className="h-9 rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                取消
              </button>
            </div>
          </div>
          {videoError && <p className="mt-2 text-sm text-red-600">{videoError}</p>}
        </div>
      )}

      {/* Editor */}
      <div className="relative">
        <div
          ref={editorRef}
          contentEditable
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onKeyUp={updateToolbarState}
          onMouseUp={updateToolbarState}
          onPaste={handlePaste}
          onBlur={handleInput}
          onClick={handleEditorClick}
          className="px-5 py-4 outline-none text-[15px] leading-relaxed text-slate-800 rich-editor"
          style={{ minHeight }}
          suppressContentEditableWarning
        />
        {isEmpty && (
          <div className="absolute top-0 left-0 pointer-events-none text-slate-400 px-5 py-4 text-[15px] leading-relaxed">
            {placeholder}
          </div>
        )}
      </div>

      {/* Image alignment toolbar (floating) */}
      {imgToolbar.visible && (
        <div
          className="fixed z-50 flex items-center gap-1 bg-white border shadow-lg rounded-lg px-2 py-1.5"
          style={{
            left: `${imgToolbar.x}px`,
            top: `${imgToolbar.y}px`,
            transform: "translate(-50%, -100%)",
          }}
        >
          <button
            type="button"
            onClick={() => alignImage("left")}
            className="p-1.5 rounded-md text-slate-600 hover:bg-slate-100 hover:text-sky-600 transition-colors"
            title="左对齐"
          >
            <AlignLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => alignImage("center")}
            className="p-1.5 rounded-md text-slate-600 hover:bg-slate-100 hover:text-sky-600 transition-colors"
            title="居中"
          >
            <AlignCenter className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => alignImage("right")}
            className="p-1.5 rounded-md text-slate-600 hover:bg-slate-100 hover:text-sky-600 transition-colors"
            title="右对齐"
          >
            <AlignRight className="h-4 w-4" />
          </button>
          <div className="w-px h-5 bg-slate-200 mx-1" />
          {IMAGE_WIDTH_OPTIONS.map((width) => (
            <button
              key={width}
              type="button"
              onClick={() => setImageWidth(width)}
              className="min-w-8 px-1.5 py-1 rounded-md text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-sky-600 transition-colors"
              title={`图片宽度 ${width}%`}
            >
              {width}
            </button>
          ))}
          <div className="w-px h-5 bg-slate-200 mx-1" />
          <button
            type="button"
            onClick={hideImgToolbar}
            className="p-1.5 rounded-md text-slate-400 hover:bg-slate-100 hover:text-red-500 transition-colors"
            title="关闭"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

function ToolbarButton({
  onClick,
  children,
  title,
  disabled,
  active,
}: {
  onClick: () => void;
  children: React.ReactNode;
  title: string;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`p-1.5 rounded-md transition-colors ${
        active
          ? "bg-sky-100 text-sky-700"
          : "text-slate-600 hover:bg-slate-200 hover:text-slate-900"
      } disabled:opacity-40`}
    >
      {children}
    </button>
  );
}

function ToolbarSelect({
  title,
  value,
  options,
  onChange,
  onPointerDown,
}: {
  title: string;
  value: string;
  options: ReadonlyArray<{ label: string; value: string }>;
  onChange: (value: string) => void;
  onPointerDown: () => void;
}) {
  return (
    <select
      title={title}
      value={value}
      onPointerDown={onPointerDown}
      onChange={(e) => onChange(e.target.value)}
      className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs font-medium text-slate-600 outline-none transition-colors hover:border-slate-300 focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
    >
      {options.map((option) => (
        <option key={option.value || "default"} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

function ToolbarDivider() {
  return <div className="w-px h-5 bg-slate-300 mx-1" />;
}

function createImageFigure(url: string): HTMLElement {
  const figure = document.createElement("figure");
  figure.style.margin = "12px auto";
  figure.style.textAlign = "center";
  figure.style.display = "block";
  figure.style.width = "75%";
  figure.style.maxWidth = "100%";

  const img = document.createElement("img");
  img.src = url;
  img.alt = "";
  img.style.maxWidth = "100%";
  img.style.width = "100%";
  img.style.borderRadius = "8px";
  img.style.display = "inline-block";
  img.style.boxShadow = "0 2px 8px rgba(0,0,0,0.08)";

  figure.appendChild(img);
  return figure;
}

function createVideoFigure(video: VideoEmbed): HTMLElement {
  const figure = document.createElement("figure");
  figure.className = "video-embed";
  figure.contentEditable = "false";

  const frame = document.createElement("div");
  frame.className = "video-embed-frame";

  const iframe = document.createElement("iframe");
  iframe.src = video.embedSrc;
  iframe.title = video.title;
  iframe.setAttribute("scrolling", BILIBILI_IFRAME_ATTRS.scrolling);
  iframe.setAttribute("border", BILIBILI_IFRAME_ATTRS.border);
  iframe.setAttribute("frameborder", BILIBILI_IFRAME_ATTRS.frameborder);
  iframe.setAttribute("framespacing", BILIBILI_IFRAME_ATTRS.framespacing);
  iframe.setAttribute("allow", BILIBILI_IFRAME_ATTRS.allow);
  iframe.setAttribute("allowfullscreen", BILIBILI_IFRAME_ATTRS.allowfullscreen);
  iframe.loading = BILIBILI_IFRAME_ATTRS.loading;
  iframe.referrerPolicy = BILIBILI_IFRAME_ATTRS.referrerpolicy;

  const caption = document.createElement("figcaption");
  const link = document.createElement("a");
  link.href = video.originalUrl;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = video.title;

  frame.appendChild(iframe);
  caption.appendChild(link);
  figure.appendChild(frame);
  figure.appendChild(caption);
  return figure;
}
