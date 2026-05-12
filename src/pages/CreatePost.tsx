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
import { Cloud, PenLine, ImagePlus, Loader2, MapPin, Send, X, Upload, FileText, StickyNote } from "lucide-react";

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
  const isAdmin = user.role === "admin";

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



  // Persist imageUrls to sessionStorage to survive page refreshes / browser quirks
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
      // Clear sessionStorage after successful publish
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

  // Clear sessionStorage on unmount to avoid stale data
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
        <Loader2 className="h-8 w-8 animate-spin text-sky-600" />
      </div>
    );
  }

  const handleSubmit = () => {
    if (!title.trim() || !content.trim()) return;
    // 天象分类必选，但如果选了天空图鉴分类则可不选
    if (!skyGalleryCategory && !category) return;

    // For posts (not articles), wrap plain text in paragraphs
    const finalContent = isArticle
      ? content
      : `<p>${content.replace(/\n/g, "</p><p>")}</p>`;

    // Ensure we use the latest imageUrls (including sessionStorage fallback)
    let finalImages = imageUrls;
    if (finalImages.length === 0) {
      try {
        const saved = sessionStorage.getItem("createPost_imageUrls");
        if (saved) finalImages = JSON.parse(saved);
      } catch {
        // ignore
      }
    }

    // Auto-generate title from content if empty
    let finalTitle = title.trim();
    if (!finalTitle) {
      const plainText = finalContent.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
      finalTitle = plainText.slice(0, 30) + (plainText.length > 30 ? "..." : "");
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

    // Limit total images to 18
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
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-sky-100">
              <PenLine className="h-5 w-5 text-sky-600" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">发布天象</h1>
          </div>
          {/* Type Toggle —— compact segmented control */}
          <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => setIsArticle(false)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                !isArticle
                  ? "bg-white text-sky-700 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <StickyNote className="h-3.5 w-3.5" />
              帖子
            </button>
            <button
              type="button"
              onClick={() => setIsArticle(true)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                isArticle
                  ? "bg-white text-sky-700 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <FileText className="h-3.5 w-3.5" />
              文章
            </button>
          </div>
        </div>

        <div className="space-y-6">
          {/* Title */}
          <div>
            <Label htmlFor="title" className="text-sm font-medium">
              标题
            </Label>
            <Input
              id="title"
              placeholder="给你的天象起一个吸引人的标题"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1"
            />
          </div>

          {/* Content - different editors for post vs article */}
          <div>
            <Label className="text-sm font-medium mb-2 block">
              内容描述 {isArticle && "（支持富文本编辑，可在任意位置插入图片）"}
            </Label>
            {isArticle ? (
              <RichEditor
                value={content}
                onChange={setContent}
                placeholder="开始你的文章写作，支持加粗、标题、列表、引用，以及任意位置插入图片..."
                minHeight="400px"
              />
            ) : (
              <Textarea
                placeholder="描述你观察到的天象现象、时间、天气状况、拍摄设备等详细信息..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="min-h-[200px]"
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
                  onClick={() => setCategory(cat.id)}
                  className={`flex flex-col items-center gap-0.5 py-2 px-1 rounded-lg border transition-all ${
                    category === cat.id
                      ? "border-sky-500 bg-sky-50 text-sky-700"
                      : "border-slate-200 hover:border-sky-300 hover:bg-slate-50"
                  }`}
                >
                  <Cloud className="h-4 w-4" />
                  <span className="text-xs font-medium">{cat.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 天空图鉴分类 (仅管理员可见) */}
          {isAdmin && (
            <div>
              <Label className="text-sm font-medium">天空图鉴分类（可选）</Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
                {SKY_GALLERY_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSkyGalleryCategory(skyGalleryCategory === cat ? "" : cat)}
                    className={`py-2 px-3 rounded-lg border text-sm font-medium transition-all ${
                      skyGalleryCategory === cat
                        ? "border-purple-500 bg-purple-50 text-purple-700"
                        : "border-slate-200 hover:border-purple-300 hover:bg-slate-50 text-slate-600"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Location */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Switch
                id="location"
                checked={hasLocation}
                onCheckedChange={setHasLocation}
              />
              <Label htmlFor="location" className="cursor-pointer flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                附带位置信息
              </Label>
            </div>
            {hasLocation && (
              <Select value={region} onValueChange={setRegion}>
                <SelectTrigger className="w-full sm:w-64">
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

          {/* Cover Images (for posts only, articles insert inline) */}
          {!isArticle && (
            <div>
              <Label className="text-sm font-medium flex items-center gap-2 mb-2">
                <ImagePlus className="h-4 w-4" />
                图片上传
              </Label>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 px-4 py-2 rounded-lg border border-dashed border-slate-300 hover:border-sky-400 hover:bg-sky-50 cursor-pointer transition-colors text-sm text-slate-600">
                  <Upload className="h-4 w-4" />
                  {uploading ? "上传中..." : "选择图片"}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    multiple
                    className="hidden"
                    onChange={handleFileUpload}
                    disabled={uploading}
                  />
                </label>
                <span className="text-xs text-slate-400">支持 JPG、PNG、GIF，单张最大 10MB，最多 18 张</span>
              </div>
              {uploadError && (
                <p className="text-sm text-red-500 mt-3">{uploadError}</p>
              )}
              {uploading && (
                <div className="flex items-center gap-2 mt-3 text-sm text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  正在上传...
                </div>
              )}
              {imageUrls.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3">
                  {imageUrls.map((url, idx) => (
                    <div key={idx} className="relative group overflow-hidden bg-slate-100 border">
                      <img src={url} alt={`upload-${idx}`} className="w-full h-32 object-cover" />
                      <button
                        type="button"
                        onClick={() => removeImage(url)}
                        className="absolute top-1 right-1 p-1 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
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
          <div className="flex items-center justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => {
              try {
                sessionStorage.removeItem("createPost_imageUrls");
              } catch {
                // ignore
              }
              navigate("/");
            }}>
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
              className="bg-sky-600 hover:bg-sky-700"
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
