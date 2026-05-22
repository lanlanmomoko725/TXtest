import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "@/hooks/useAuth";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  SKY_CATEGORIES,
  REGIONS,
  SKY_GALLERY_CATEGORIES,
} from "@contracts/constants";
import { LOGIN_PATH } from "@/const";
import RichEditor from "@/components/RichEditor";
import { Cloud, PenLine, ImagePlus, Loader2, MapPin, Send, X, Upload, FileText, StickyNote, Check } from "lucide-react";

/** Convert rich HTML content to plain text for the simple textarea */
function stripHtml(html: string): string {
  if (!html || html === "<p><br></p>" || html === "<br>") return "";
  return html
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .trim();
}

/** Convert plain text to simple HTML paragraphs for the rich editor */
function plainTextToHtml(text: string): string {
  if (!text.trim()) return "<p><br></p>";
  const escape = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return text
    .split("\n")
    .map((line) => `<p>${escape(line)}</p>`)
    .join("");
}

export default function CreatePost() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth({
    redirectOnUnauthenticated: true,
    redirectPath: LOGIN_PATH,
  });

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("");
  const [hasLocation, setHasLocation] = useState(false);
  const [region, setRegion] = useState("");
  const [isArticle, setIsArticle] = useState(false);
  const [skyGalleryCategory, setSkyGalleryCategory] = useState("");
  const isAdmin = user?.role === "admin";

  const [imageUrls, setImageUrls] = useState<string[]>(() => {
    try {
      const saved = sessionStorage.getItem("createPost_imageUrls");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const persistImageUrls = (urls: string[]) => {
    try {
      sessionStorage.setItem("createPost_imageUrls", JSON.stringify(urls));
    } catch {
      // ignore
    }
  };

  const utils = trpc.useUtils();
  const createPost = trpc.post.create.useMutation({
    onSuccess: (data) => {
      utils.post.list.invalidate();
      utils.post.featured.invalidate();
      try {
        sessionStorage.removeItem("createPost_imageUrls");
      } catch {
        // ignore
      }
      if (data) {
        navigate(`/post/${data.id}`);
      }
    },
  });

  useEffect(() => {
    return () => {
      try {
        sessionStorage.removeItem("createPost_imageUrls");
      } catch {
        // ignore
      }
    };
  }, []);

  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const handleSubmit = () => {
    if (!title.trim() || !content.trim()) return;
    if (!skyGalleryCategory && !category) return;

    const finalContent = isArticle
      ? content
      : `<p>${content.replace(/\n/g, "</p><p>")}</p>`;

    let finalImages = imageUrls;
    if (finalImages.length === 0) {
      try {
        const saved = sessionStorage.getItem("createPost_imageUrls");
        if (saved) finalImages = JSON.parse(saved);
      } catch {
        // ignore
      }
    }

    let finalTitle = title.trim();
    if (!finalTitle) {
      const plainText = finalContent.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
      finalTitle = plainText.slice(0, 30) + (plainText.length > 30 ? "…" : "");
    }

    createPost.mutate({
      title: finalTitle,
      content: finalContent,
      category: (category || (skyGalleryCategory ? "other" : "")) as "cloud" | "halo" | "glory" | "rainbow" | "other",
      hasLocation,
      region: hasLocation ? region : undefined,
      images: finalImages.length > 0 ? finalImages : undefined,
      isArticle,
      skyGalleryCategory: skyGalleryCategory || undefined,
    });
  };

  const removeImage = (url: string) => {
    const next = imageUrls.filter((u) => u !== url);
    setImageUrls(next);
    persistImageUrls(next);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (imageUrls.length + files.length > 18) {
      setUploadError("每个帖子最多上传 18 张图片，当前已有 " + imageUrls.length + " 张");
      e.target.value = "";
      return;
    }

    setUploading(true);
    setUploadError(null);
    const newUrls: string[] = [];

    for (const file of Array.from(files)) {
      const formData = new FormData();
      formData.append("file", file);

      try {
        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });
        const contentType = res.headers.get("content-type") ?? "";
        if (!contentType.includes("application/json")) {
          const text = await res.text();
          throw new Error(text || `服务器返回了非预期的响应 (${res.status})`);
        }
        const data = await res.json();
        if (data.success && data.url) {
          newUrls.push(data.url);
        } else {
          setUploadError(data.error || "上传失败");
        }
      } catch (err) {
        console.error("Upload failed:", err);
        setUploadError(err instanceof Error ? err.message : "网络错误，上传失败");
      }
    }

    if (newUrls.length > 0) {
      setImageUrls((prev) => {
        const next = [...prev, ...newUrls];
        persistImageUrls(next);
        return next;
      });
    }
    setUploading(false);
    e.target.value = "";
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10">
              <PenLine className="h-5 w-5 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">发布天象</h1>
          </div>
          {/* Type Toggle */}
          <div className="flex items-center bg-muted rounded-xl p-1 relative">
            <div
              className={`absolute top-1 bottom-1 w-[calc(50%-2px)] rounded-lg bg-background shadow-sm transition-all duration-300 ease-out-quart ${
                isArticle ? "left-[calc(50%+1px)]" : "left-1"
              }`}
            />
            <button
              type="button"
              onClick={() => {
                if (isArticle) {
                  setContent(stripHtml(content));
                }
                setIsArticle(false);
              }}
              className={`relative z-10 flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                !isArticle ? "text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <StickyNote className="h-3.5 w-3.5" />
              帖子
            </button>
            <button
              type="button"
              onClick={() => {
                if (!isArticle) {
                  setContent(plainTextToHtml(content));
                }
                setIsArticle(true);
              }}
              className={`relative z-10 flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                isArticle ? "text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <FileText className="h-3.5 w-3.5" />
              文章
            </button>
          </div>
        </div>

        <div className="space-y-7">
          {/* Title */}
          <div>
            <Label htmlFor="title" className="text-sm font-medium">
              标题
            </Label>
            <Input
              id="title"
              placeholder="给你的天象起一个吸引人的标题…"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1.5 bg-background"
            />
          </div>

          {/* Content */}
          <div>
            <Label className="text-sm font-medium mb-2 block">
              内容描述 {isArticle && "（支持富文本编辑，可在任意位置插入图片）"}
            </Label>
            {isArticle ? (
              <RichEditor
                value={content}
                onChange={setContent}
                placeholder="开始你的文章写作，支持加粗、标题、列表、引用，以及任意位置插入图片…"
                minHeight="400px"
              />
            ) : (
              <Textarea
                placeholder="描述你观察到的天象现象、时间、天气状况、拍摄设备等详细信息…"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="min-h-[200px] bg-background resize-none"
              />
            )}
          </div>

          {/* Category */}
          <div>
            <Label className="text-sm font-medium">天象分类</Label>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mt-2">
              {SKY_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategory(cat.id)}
                  className={`relative flex flex-col items-center gap-1 py-3 px-1 rounded-xl border transition-all duration-200 focus-visible:ring-2 focus-visible:ring-ring ${
                    category === cat.id
                      ? "border-primary bg-primary/5 text-primary shadow-soft"
                      : "border-border/60 hover:border-primary/30 hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {category === cat.id && (
                    <Check className="absolute top-1.5 right-1.5 h-3.5 w-3.5 text-primary" />
                  )}
                  <Cloud className="h-4 w-4" />
                  <span className="text-xs font-medium">{cat.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Sky Gallery Category (admin only) */}
          {isAdmin && (
            <div>
              <Label className="text-sm font-medium">天空图鉴分类（可选）</Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
                {SKY_GALLERY_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSkyGalleryCategory(skyGalleryCategory === cat ? "" : cat)}
                    className={`relative py-2.5 px-3 rounded-xl border text-sm font-medium transition-all duration-200 focus-visible:ring-2 focus-visible:ring-ring ${
                      skyGalleryCategory === cat
                        ? "border-purple-500 bg-purple-50 dark:bg-purple-950/20 text-purple-700 dark:text-purple-400 shadow-soft"
                        : "border-border/60 hover:border-purple-300 hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {skyGalleryCategory === cat && (
                      <Check className="absolute top-1.5 right-1.5 h-3 w-3 text-purple-500" />
                    )}
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Location */}
          <div className="space-y-3">
            <div className="flex items-center space-x-3">
              <Switch
                id="location"
                checked={hasLocation}
                onCheckedChange={setHasLocation}
              />
              <Label htmlFor="location" className="cursor-pointer flex items-center gap-1.5 text-sm font-medium">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                附带位置信息
              </Label>
            </div>
            {hasLocation && (
              <Select value={region} onValueChange={setRegion}>
                <SelectTrigger className="w-full sm:w-64 bg-background">
                  <SelectValue placeholder="选择地区" />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {REGIONS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Cover Images */}
          {!isArticle && (
            <div>
              <Label className="text-sm font-medium flex items-center gap-2 mb-2">
                <ImagePlus className="h-4 w-4" />
                图片上传
              </Label>
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <label className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border-2 border-dashed border-border/80 hover:border-primary/40 hover:bg-primary/5 cursor-pointer transition-all duration-200 text-sm text-muted-foreground hover:text-primary focus-visible:ring-2 focus-visible:ring-ring">
                  <Upload className="h-4 w-4" />
                  {uploading ? "上传中…" : "选择图片"}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    multiple
                    className="hidden"
                    onChange={handleFileUpload}
                    disabled={uploading}
                  />
                </label>
                <span className="text-xs text-muted-foreground">支持 JPG、PNG、GIF，单张最大 10MB，最多 18 张</span>
              </div>
              {uploadError && (
                <p className="text-sm text-destructive mt-3 animate-shake">{uploadError}</p>
              )}
              {uploading && (
                <div className="flex items-center gap-2 mt-3 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  正在上传…
                </div>
              )}
              {imageUrls.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4">
                  {imageUrls.map((url, idx) => (
                    <div key={idx} className="relative group overflow-hidden rounded-xl bg-muted border border-border/40">
                      <img src={url} alt={`upload-${idx}`} className="w-full h-32 object-cover" loading="lazy" />
                      <button
                        type="button"
                        onClick={() => removeImage(url)}
                        className="absolute top-2 right-2 p-1.5 bg-black/60 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-black/80 hover:scale-110 focus-visible:opacity-100"
                        aria-label="删除图片"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Submit */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border/40">
            <Button
              variant="outline"
              onClick={() => {
                try {
                  sessionStorage.removeItem("createPost_imageUrls");
                } catch {
                  // ignore
                }
                navigate("/");
              }}
              className="transition-all duration-200 active:scale-[0.98]"
            >
              取消
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={
                createPost.isPending ||
                !content.trim() ||
                (!skyGalleryCategory && !category) ||
                (hasLocation && !region)
              }
              className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-soft transition-all duration-200 hover:shadow-card-hover active:scale-[0.98]"
            >
              {createPost.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              发布
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
