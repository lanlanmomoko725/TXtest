import { useState, useRef } from "react";
import { Link } from "react-router";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, ArrowLeft, Pencil, Check, X, Camera, Star } from "lucide-react";

export default function WeeklySky() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const { data: weeklySky, isLoading } = trpc.weeklySky.get.useQuery();
  const utils = trpc.useUtils();
  const updateMutation = trpc.weeklySky.update.useMutation({
    onSuccess: async () => {
      await utils.weeklySky.get.invalidate();
      setIsEditing(false);
    },
  });

  const [isEditing, setIsEditing] = useState(false);
  const [editImage, setEditImage] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleStartEdit = () => {
    setEditImage(weeklySky?.image || "");
    setEditTitle(weeklySky?.title || "");
    setEditContent(weeklySky?.content || "");
    setIsEditing(true);
  };

  const handleSave = () => {
    updateMutation.mutate({
      image: editImage.trim() || undefined,
      title: editTitle.trim() || undefined,
      content: editContent.trim() || undefined,
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (data.success && data.url) {
        setEditImage(data.url);
      }
    } catch (err) {
      console.error("Upload failed:", err);
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
          <Link to="/" className="hover:text-primary">首页</Link>
          <span>/</span>
          <span className="text-foreground font-medium">每周天象</span>
        </div>

        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="p-2 rounded-full hover:bg-muted transition-colors">
              <ArrowLeft className="h-5 w-5 text-muted-foreground" />
            </Link>
            <h1 className="text-2xl font-bold text-foreground">每周天象</h1>
          </div>
          {isAdmin && !isEditing && (
            <Button size="sm" variant="outline" onClick={handleStartEdit}>
              <Pencil className="h-4 w-4 mr-1" />
              编辑
            </Button>
          )}
          {isAdmin && isEditing && (
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={handleSave} disabled={updateMutation.isPending}>
                {updateMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <Check className="h-4 w-4 mr-1" />
                )}
                保存
              </Button>
              <Button size="sm" variant="outline" onClick={() => setIsEditing(false)}>
                <X className="h-4 w-4 mr-1" />
                取消
              </Button>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="bg-card rounded-2xl border border-border/60 p-6 md:p-8 shadow-card">
          {isEditing ? (
            <div className="space-y-6">
              {/* Image Upload */}
              <div>
                <label className="block text-sm font-medium text-foreground/80 mb-2">封面图片</label>
                <div className="relative w-full rounded-xl overflow-hidden bg-muted">
                  {editImage ? (
                    <img src={editImage} alt="封面" className="w-full h-auto object-contain" />
                  ) : (
                    <div className="flex items-center justify-center aspect-video text-muted-foreground/50">
                      <Camera className="h-12 w-12" />
                    </div>
                  )}
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="absolute bottom-3 right-3 px-3 py-1.5 bg-sky-600 text-white text-sm rounded-full shadow-sm hover:bg-sky-700 transition-colors flex items-center gap-1"
                  >
                    <Camera className="h-4 w-4" />
                    {uploading ? "上传中..." : "更换图片"}
                  </button>
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileUpload}
                  disabled={uploading}
                />
              </div>

              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-foreground/80 mb-2">标题</label>
                <Input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="输入标题"
                  className="text-lg font-bold"
                />
              </div>

              {/* Content */}
              <div>
                <label className="block text-sm font-medium text-foreground/80 mb-2">文字介绍</label>
                <Textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  placeholder="输入文字介绍"
                  rows={10}
                />
              </div>

              {updateMutation.error && (
                <p className="text-sm text-destructive">{updateMutation.error.message}</p>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {/* Image */}
              {weeklySky?.image ? (
                <div className="w-full rounded-xl overflow-hidden flex items-center justify-center">
                  <img
                    src={weeklySky.image}
                    alt={weeklySky.title || "每周天象"}
                    className="max-w-full max-h-[85vh] w-auto h-auto object-contain"
                  />
                </div>
              ) : (
                <div className="w-full aspect-video rounded-xl flex items-center justify-center">
                  <Star className="h-16 w-16 text-muted-foreground/40" />
                </div>
              )}

              {/* Title */}
              <h2 className="text-2xl md:text-3xl font-bold text-foreground text-center">
                {weeklySky?.title || "每周天象"}
              </h2>

              {/* Content */}
              {weeklySky?.content ? (
                <div className="prose prose-slate max-w-none">
                  <p className="text-foreground/80 leading-relaxed whitespace-pre-wrap">
                    {weeklySky.content}
                  </p>
                </div>
              ) : (
                <p className="text-muted-foreground/50 text-center">暂无内容，管理员可以编辑添加。</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
