import { Link, useParams } from "react-router";
import { trpc } from "@/providers/trpc";
import PostCard from "@/components/PostCard";
import { Hash, Loader2, ArrowLeft } from "lucide-react";

export default function TagPosts() {
  const { tag } = useParams<{ tag: string }>();
  const decodedTag = decodeURIComponent(tag || "");

  const { data: posts, isLoading } = trpc.post.byTag.useQuery(
    { tag: decodedTag, limit: 24, offset: 0 },
    { enabled: decodedTag.length > 0 }
  );

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
          <Link to="/" className="hover:text-primary">首页</Link>
          <span>/</span>
          <span className="text-foreground font-medium">标签</span>
        </div>

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Link to="/" className="p-2 rounded-full hover:bg-muted transition-colors">
              <ArrowLeft className="h-5 w-5 text-muted-foreground" />
            </Link>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Hash className="h-6 w-6 text-primary" />
              <span className="text-primary">#{decodedTag}#</span>
            </h1>
          </div>
          <p className="text-slate-600 ml-11">
            共 {posts?.length || 0} 条包含此标签的内容
          </p>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : posts && posts.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {posts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <Hash className="h-16 w-16 mx-auto mb-4 text-muted-foreground/40" />
            <h3 className="text-lg font-medium text-foreground/80 mb-2">暂无内容</h3>
            <p className="text-muted-foreground">还没有包含 #{decodedTag}# 标签的帖子或文章</p>
          </div>
        )}
      </div>
    </div>
  );
}
