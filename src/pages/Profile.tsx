import { Link, useParams } from "react-router";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PostCard from "@/components/PostCard";
import MasonryGrid, { MasonryItem } from "@/components/MasonryGrid";
import { Loader2, User, Cloud, MapPin, Star, Settings } from "lucide-react";

export default function Profile() {
  const { id } = useParams<{ id: string }>();
  const userId = parseInt(id || "0", 10);
  const { user: currentUser } = useAuth();
  const isMe = currentUser?.id === userId;

  const { data: posts, isLoading: postsLoading } = trpc.post.list.useQuery(
    { authorId: userId, limit: 24, offset: 0 },
    { enabled: userId > 0 },
  );

  const displayUser = isMe ? currentUser : posts?.[0]?.author;

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
        <div className="bg-card rounded-2xl border border-border/60 p-6 md:p-8 mb-8 shadow-card">
          <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
            <Avatar className="h-24 w-24">
              <AvatarImage src={displayUser.avatar || undefined} className="object-cover" />
              <AvatarFallback className="bg-primary/10 text-primary text-2xl">
                {(displayUser.name || "用户").slice(0, 1)}
              </AvatarFallback>
            </Avatar>

            <div className="text-center md:text-left flex-1">
              <div className="flex items-center justify-center md:justify-start gap-3 mb-2">
                <h1 className="text-2xl font-bold text-foreground">{displayUser.name || "匿名用户"}</h1>
                {(displayUser.role === "admin" || displayUser.role === "super_admin") && (
                  <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">
                    <Star className="h-3 w-3 mr-1" />
                    {displayUser.role === "super_admin" ? "超级管理员" : "管理员"}
                  </Badge>
                )}
              </div>
              {displayUser.publicId ? (
                <p className="text-xs text-muted-foreground mb-2">
                  用户 ID：{displayUser.publicId} · L{displayUser.level}
                </p>
              ) : null}
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

              {isMe ? (
                <div className="mt-4 flex items-center justify-center md:justify-start">
                  <Button asChild size="sm" variant="outline">
                    <Link to="/account">
                      <Settings className="h-4 w-4 mr-1" />
                      个人信息
                    </Link>
                  </Button>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <Tabs defaultValue="all" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="all">全部 ({posts?.length || 0})</TabsTrigger>
            <TabsTrigger value="articles">文章 ({articles.length})</TabsTrigger>
            <TabsTrigger value="posts">帖子 ({regularPosts.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="all">
            {posts && posts.length > 0 ? (
              <MasonryGrid>
                {posts.map((post) => (
                  <MasonryItem key={post.id}>
                    <PostCard post={post} />
                  </MasonryItem>
                ))}
              </MasonryGrid>
            ) : (
              <EmptyState label="暂无发布内容" />
            )}
          </TabsContent>

          <TabsContent value="articles">
            {articles.length > 0 ? (
              <MasonryGrid>
                {articles.map((post) => (
                  <MasonryItem key={post.id}>
                    <PostCard post={post} />
                  </MasonryItem>
                ))}
              </MasonryGrid>
            ) : (
              <EmptyState label="暂无文章" />
            )}
          </TabsContent>

          <TabsContent value="posts">
            {regularPosts.length > 0 ? (
              <MasonryGrid>
                {regularPosts.map((post) => (
                  <MasonryItem key={post.id}>
                    <PostCard post={post} />
                  </MasonryItem>
                ))}
              </MasonryGrid>
            ) : (
              <EmptyState label="暂无帖子" />
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="text-center py-16">
      <Cloud className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
      <p className="text-muted-foreground">{label}</p>
    </div>
  );
}
