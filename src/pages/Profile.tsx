import { useParams } from "react-router";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PostCard from "@/components/PostCard";
import { Loader2, User, Cloud, MapPin, Star, Pencil, Camera, X, Check } from "lucide-react";
import { useState, useRef } from "react";
import { uploadImage } from "@/lib/upload";

function calcDisplayLength(name: string): number {
  let len = 0;
  for (const char of name) {
    len += char.charCodeAt(0) > 127 ? 2 : 1;
  }
  return len;
}

function validateName(name: string): string | null {
  if (!name.trim()) return "昵称不能为空";
  if (calcDisplayLength(name) > 20) return "昵称过长：最多10个汉字或20个英文字母";
  return null;
}

export default function Profile() {
  const { id } = useParams<{ id: string }>();
  const userId = parseInt(id || "0");
  const { user: currentUser, refresh } = useAuth();

  const isMe = currentUser?.id === userId;

  const { data: posts, isLoading: postsLoading } = trpc.post.list.useQuery(
    { authorId: userId, limit: 24, offset: 0 },
    { enabled: userId > 0 }
  );

  const displayUser = isMe ? currentUser : posts?.[0]?.author;

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editAvatar, setEditAvatar] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const utils = trpc.useUtils();
  const updateProfile = trpc.auth.updateProfile.useMutation({
    onSuccess: async () => {
      await utils.post.list.invalidate();
      await refresh();
      setIsEditing(false);
    },
    onError: (err) => {
      setNameError(err.message);
    },
  });

  const handleStartEdit = () => {
    if (!displayUser) return;
    setEditName(displayUser.name || "");
    setEditAvatar(displayUser.avatar || "");
    setNameError(null);
    setIsEditing(true);
  };

  const handleSave = () => {
    const error = validateName(editName);
    if (error) {
      setNameError(error);
      return;
    }
    updateProfile.mutate({
      name: editName.trim(),
      avatar: editAvatar.trim() || undefined,
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setNameError("图片大小不能超过 5MB");
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    setUploading(true);
    try {
      setEditAvatar(await uploadImage(file));
    } catch (err) {
      console.error("Upload failed:", err);
      setNameError(err instanceof Error ? err.message : "图片上传失败");
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  if (postsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!displayUser) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <User className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
          <h2 className="text-xl font-bold text-foreground">用户不存在</h2>
        </div>
      </div>
    );
  }

  const articles = posts?.filter((p) => p.isArticle) || [];
  const regularPosts = posts?.filter((p) => !p.isArticle) || [];

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8">
        {/* Profile Header */}
        <div className="bg-card rounded-2xl border border-border/60 p-6 md:p-8 mb-8 shadow-card">
          <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
            <div className="relative">
              <Avatar className="h-24 w-24">
                <AvatarImage
                  src={isEditing ? editAvatar || undefined : displayUser.avatar || undefined}
                  className="object-cover"
                />
                <AvatarFallback className="bg-primary/10 text-primary text-2xl">
                  {(isEditing ? editName : displayUser.name || "用户").slice(0, 1)}
                </AvatarFallback>
              </Avatar>
              {isEditing && (
                <button
                  onClick={() => fileRef.current?.click()}
                  className="absolute -bottom-1 -right-1 p-1.5 bg-sky-600 text-white rounded-full shadow-sm hover:bg-sky-700 transition-colors"
                  title="更换头像"
                >
                  <Camera className="h-3.5 w-3.5" />
                </button>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileUpload}
                disabled={uploading}
              />
            </div>
            <div className="text-center md:text-left flex-1">
              <div className="flex items-center justify-center md:justify-start gap-3 mb-2">
                {isEditing ? (
                  <div className="w-full max-w-xs">
                    <Input
                      value={editName}
                      onChange={(e) => {
                        setEditName(e.target.value);
                        setNameError(validateName(e.target.value));
                      }}
                      placeholder="输入昵称"
                      className={`text-lg font-bold ${nameError ? "border-destructive" : ""}`}
                      maxLength={20}
                    />
                    {nameError && (
                      <p className="text-xs text-destructive mt-1 text-left">{nameError}</p>
                    )}
                    <p className="text-xs text-muted-foreground/60 mt-1 text-left">
                      最多10个汉字或20个英文字母
                    </p>
                  </div>
                ) : (
                  <>
                    <h1 className="text-2xl font-bold text-foreground">{displayUser.name || "匿名用户"}</h1>
                    {displayUser.role === "admin" && (
                      <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">
                        <Star className="h-3 w-3 mr-1" />
                        管理员
                      </Badge>
                    )}
                  </>
                )}
              </div>
              <p className="text-muted-foreground text-sm mb-3">
                注册于 {new Date(displayUser.createdAt).toLocaleDateString("zh-CN")}
              </p>
              <div className="flex items-center justify-center md:justify-start gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Cloud className="h-4 w-4" />
                  {posts?.length || 0} 条记录
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  {new Set(posts?.filter((p) => p.region).map((p) => p.region)).size || 0} 个地区
                </span>
              </div>

              {isEditing && uploading && (
                <p className="text-xs text-muted-foreground/60 mt-2">头像上传中...</p>
              )}

              {isMe && (
                <div className="mt-4 flex items-center justify-center md:justify-start gap-2">
                  {isEditing ? (
                    <>
                      <Button size="sm" onClick={handleSave} disabled={updateProfile.isPending || !!nameError}>
                        {updateProfile.isPending ? (
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
                    </>
                  ) : (
                    <Button size="sm" variant="outline" onClick={handleStartEdit}>
                      <Pencil className="h-4 w-4 mr-1" />
                      编辑资料
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Content Tabs */}
        <Tabs defaultValue="all" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="all">全部 ({posts?.length || 0})</TabsTrigger>
            <TabsTrigger value="articles">文章 ({articles.length})</TabsTrigger>
            <TabsTrigger value="posts">帖子 ({regularPosts.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="all">
            {posts && posts.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {posts.map((post) => (
                  <PostCard key={post.id} post={post} />
                ))}
              </div>
            ) : (
              <div className="text-center py-16">
                <Cloud className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
                <p className="text-muted-foreground">暂无发布内容</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="articles">
            {articles.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {articles.map((post) => (
                  <PostCard key={post.id} post={post} />
                ))}
              </div>
            ) : (
              <div className="text-center py-16">
                <Cloud className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
                <p className="text-muted-foreground">暂无文章</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="posts">
            {regularPosts.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {regularPosts.map((post) => (
                  <PostCard key={post.id} post={post} />
                ))}
              </div>
            ) : (
              <div className="text-center py-16">
                <Cloud className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
                <p className="text-muted-foreground">暂无帖子</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
