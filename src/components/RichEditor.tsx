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
  Indent,
  Outdent,
  Undo,
  Redo,
  X,
} from "lucide-react";
import { uploadImage } from "@/lib/upload";

interface RichEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: string;
}

function getCurrentBlock(): Element | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  let node = sel.anchorNode as Node | null;
  if (!node) return null;
  if (node.nodeType === Node.TEXT_NODE) {
    node = node.parentElement;
  }
  while (node && node !== document.body) {
    const tag = (node as Element).tagName?.toLowerCase();
    if (tag === "p" || tag === "h2" || tag === "h3" || tag === "blockquote" || tag === "li" || tag === "figure") {
      return node as Element;
    }
    node = (node as Element).parentElement;
  }
  return null;
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
      setIsEmpty(!value.trim() || value === "<p><br></p>");
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

  const handleInput = () => {
    const el = editorRef.current;
    if (!el) return;
    const html = el.innerHTML;
    const empty = !html.trim() || html === "<p><br></p>" || html === "<br>";
    setIsEmpty(empty);
    onChange(html);
  };

  const execCmd = useCallback((command: string, valueArg: string = "") => {
    document.execCommand(command, false, valueArg);
    editorRef.current?.focus();
    handleInput();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
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
        // Remove any divs that were created, replace with p
        const divs = el.querySelectorAll("div");
        divs.forEach((div) => {
          const p = document.createElement("p");
          p.innerHTML = div.innerHTML;
          div.parentNode?.replaceChild(p, div);
        });
        handleInput();
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
        // insert image
        const el = editorRef.current;
        if (!el) return;
        el.focus();

        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) {
          // Append at end
          const figure = createImageFigure(data.url);
          const newP = document.createElement("p");
          newP.innerHTML = "<br>";
          el.appendChild(figure);
          el.appendChild(newP);
          // Place cursor in new paragraph
          const range = document.createRange();
          range.setStart(newP, 0);
          range.collapse(true);
          selection?.removeAllRanges();
          selection?.addRange(range);
        } else {
          const range = selection.getRangeAt(0);

          // If cursor is inside a p/h/li/etc, split the block and insert image between
          const currentBlock = getCurrentBlock();
          if (currentBlock && currentBlock.tagName.toLowerCase() !== "figure") {
            // Split the current block at cursor
            const afterRange = range.cloneRange();
            afterRange.collapse(false);
            const extracted = range.extractContents();
            const remaining = currentBlock.cloneNode(false) as HTMLElement;
            remaining.appendChild(extracted);

            // Clear original block content after cursor
            // Actually, range.extractContents already does this
            // Now insert image figure after current block
            const figure = createImageFigure(data.url);
            const newP = document.createElement("p");
            newP.innerHTML = "<br>";

            // Insert figure after current block
            if (currentBlock.nextSibling) {
              currentBlock.parentNode?.insertBefore(figure, currentBlock.nextSibling);
              currentBlock.parentNode?.insertBefore(newP, figure.nextSibling);
            } else {
              currentBlock.parentNode?.appendChild(figure);
              currentBlock.parentNode?.appendChild(newP);
            }

            // Move cursor to new paragraph
            const newRange = document.createRange();
            newRange.setStart(newP, 0);
            newRange.collapse(true);
            selection.removeAllRanges();
            selection.addRange(newRange);
          } else {
            // Insert at cursor position directly
            range.deleteContents();
            const figure = createImageFigure(data.url);
            const newP = document.createElement("p");
            newP.innerHTML = "<br>";
            range.insertNode(newP);
            range.insertNode(figure);

            const newRange = document.createRange();
            newRange.setStart(newP, 0);
            newRange.collapse(true);
            selection.removeAllRanges();
            selection.addRange(newRange);
          }
        }

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
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    for (const file of Array.from(files)) {
      await insertImage(file);
    }
    e.target.value = "";
  };

  const insertLink = useCallback(() => {
    const url = prompt("请输入链接地址：");
    if (url) {
      execCmd("createLink", url);
    }
  }, [execCmd]);

  const handleIndent = useCallback(() => {
    execCmd("indent");
  }, [execCmd]);

  const handleOutdent = useCallback(() => {
    execCmd("outdent");
  }, [execCmd]);

  const handleFirstLineIndent = useCallback(() => {
    const block = getCurrentBlock() as HTMLElement | null;
    if (block) {
      // Toggle: if already has 2em indent, remove it; otherwise apply
      if (block.style.textIndent === "2em") {
        block.style.textIndent = "";
      } else {
        block.style.textIndent = "2em";
      }
      handleInput();
    }
  }, []);

  // Handle click on images to show alignment toolbar
  const handleEditorClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
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
  }, []);

  const hideImgToolbar = useCallback(() => {
    setImgToolbar({ visible: false, x: 0, y: 0, figure: null });
  }, []);

  const alignImage = useCallback((align: "left" | "center" | "right") => {
    const el = imgToolbar.figure as HTMLElement | null;
    if (!el) return;
    if (el.tagName === "FIGURE") {
      el.style.textAlign = align;
      el.style.margin = align === "center"
        ? "12px auto"
        : align === "left"
          ? "12px 12px 12px 0"
          : "12px 0 12px 12px";
      el.style.display = align === "center" ? "block" : "inline-block";
      el.style.width = align === "center" ? "100%" : "auto";
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
        <ToolbarButton onClick={() => execCmd("formatBlock", "H2")} title="大标题">
          <Heading1 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => execCmd("formatBlock", "H3")} title="小标题">
          <Heading2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarDivider />
        <ToolbarButton onClick={() => execCmd("insertUnorderedList")} title="无序列表">
          <List className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => execCmd("formatBlock", "blockquote")} title="引用">
          <Quote className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => execCmd("justifyLeft")} title="左对齐">
          <AlignLeft className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => execCmd("justifyCenter")} title="居中">
          <AlignCenter className="h-4 w-4" />
        </ToolbarButton>
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
        >
          <span className="text-xs font-bold leading-none">↦2</span>
        </ToolbarButton>
        <ToolbarDivider />
        <ToolbarButton onClick={insertLink} title="插入链接">
          <LinkIcon className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarDivider />
        <ToolbarButton onClick={() => execCmd("undo")} title="撤销">
          <Undo className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => execCmd("redo")} title="重做">
          <Redo className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarDivider />
        <ToolbarButton
          onClick={() => fileInputRef.current?.click()}
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
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          multiple
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {/* Editor */}
      <div className="relative">
        <div
          ref={editorRef}
          contentEditable
          onInput={handleInput}
          onKeyDown={handleKeyDown}
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

function ToolbarDivider() {
  return <div className="w-px h-5 bg-slate-300 mx-1" />;
}

function createImageFigure(url: string): HTMLElement {
  const figure = document.createElement("figure");
  figure.style.margin = "12px 0";
  figure.style.textAlign = "center";
  figure.style.display = "block";

  const img = document.createElement("img");
  img.src = url;
  img.alt = "";
  img.style.maxWidth = "75%";
  img.style.width = "auto";
  img.style.borderRadius = "8px";
  img.style.display = "inline-block";
  img.style.boxShadow = "0 2px 8px rgba(0,0,0,0.08)";

  figure.appendChild(img);
  return figure;
}
