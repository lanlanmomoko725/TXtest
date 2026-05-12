import { useParams, Link, useNavigate } from "react-router";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import ImageGallery from "@/components/ImageGallery";
import TagContent from "@/components/TagContent";
import { CATEGORY_LABEL_MAP } from "@contracts/constants";
import {
  ArrowLeft,
  Calendar,
  Eye,
  MapPin,
  MessageCircle,
  Star,
  Send,
  Trash2,
  Loader2,
  User,
} from "lucide-react";
import { useState, useEffect } from "react";

export default function PostDetail() {
  const { id } = useParams<{ id: string }>();
  const postId = parseInt(id || "0");
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const [commentContent, setCommentContent] = useState("");

  // Scroll to top when entering a post
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [postId]);

  const { data: post, isLoading: postLoading } = trpc.post.byId.useQuery(
    { id: postId },
    { enabled: postId > 0 }
  );

  const { data: comments, isLoading: commentsLoading, refetch: refetchComments } =
    trpc.comment.list.useQuery(
      { postId },
      { enabled: postId > 0 }
    );

  const utils = trpc.useUtils();
  const createComment = trpc.comment.create.useMutation({
    onSuccess: () => {
      setCommentContent("");
      refetchComments();
    },
  });

  const setFeatured = trpc.post.setFeatured.useMutation({
    onSuccess: () => {
      utils.post.byId.invalidate({ id: postId });
      utils.post.featured.invalidate();
    },
  });

  const deletePost = trpc.post.delete.useMutation({
    onSuccess: () => {
      navigate("/");
    },
  });

  const isAdmin = user?.role === "admin";
  const isAuthor = post?.authorId === user?.id;
  const isSkyGallery = !!post?.skyGalleryCategory;

  if (postLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-sky-600" />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-bold text-slate-900 mb-2">帖子不存在</h2>
          <Button onClick={() => navigate("/")} variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            返回首页
          </Button>
        </div>
      </div>
    );
  }

  const categoryLabel =
    CATEGORY_LABEL_MAP[post.category as keyof typeof CATEGORY_LABEL_MAP] || post.category;
  const images = post.images && Array.isArray(post.images) ? post.images : [];

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-3 sm:py-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-2 sm:mb-4">
          <Link to="/" className="hover:text-sky-600">首页</Link>
          <span>/</span>
          {isSkyGallery ? (
            <>
              <Link to="/sky-gallery" className="hover:text-sky-600">天空图鉴</Link>
              <span>/</span>
            </>
          ) : (
            <>
              <Link to={`/category/${post.category}`} className="hover:text-sky-600">
                {categoryLabel}
              </Link>
              <span>/</span>
            </>
          )}
          <span className="text-slate-900">{post.title}</span>
        </div>

        {/* Post Header */}
        <div className="mb-4 sm:mb-6">
          {!isSkyGallery && (
            <div className="flex items-center gap-2 mb-3">
              <Badge variant="secondary" className="bg-sky-50 text-sky-700">
                {categoryLabel}
              </Badge>
              {post.isArticle && (
                <Badge variant="outline" className="text-amber-600 border-amber-200">
                  文章
                </Badge>
              )}
              {post.isFeatured && (
                <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">
                  <Star className="h-3 w-3 mr-1" />
                  精选
                </Badge>
              )}
            </div>
          )}
          {post.title && (
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mb-4">{post.title}</h1>
          )}

          <div className="flex items-center justify-between gap-3">
            {!isSkyGallery ? (
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={post.author?.avatar || undefined} />
                  <AvatarFallback className="bg-sky-100 text-sky-700">
                    {(post.author?.name || "用户").slice(0, 1)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <Link
                    to={`/profile/${post.authorId}`}
                    className="font-medium text-slate-900 hover:text-sky-600"
                  >
                    {post.author?.name || "匿名用户"}
                  </Link>
                  <div className="flex items-center gap-2 sm:gap-3 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      <span className="hidden sm:inline">
                        {new Date(post.createdAt).toLocaleString("zh-CN", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })}
                      </span>
                      <span className="sm:hidden">
                        {new Date(post.createdAt).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })}
                      </span>
                    </span>
                    <span className="flex items-center gap-1">
                      <Eye className="h-3 w-3" />
                      {post.viewCount}
                      <span className="hidden sm:inline">次浏览</span>
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              {isAdmin && !isSkyGallery && (
                <Button
                  size="icon"
                  variant={post.isFeatured ? "default" : "outline"}
                  onClick={() => setFeatured.mutate({ id: postId, featured: !post.isFeatured })}
                  className={`h-8 w-8 ${post.isFeatured ? "bg-amber-500 hover:bg-amber-600" : ""}`}
                  title={post.isFeatured ? "取消精选" : "设为精选"}
                >
                  <Star className="h-4 w-4" />
                </Button>
              )}
              {(isAuthor || isAdmin) && (
                <Button
                  size="icon"
                  variant="outline"
                  className="h-8 w-8 text-red-600 border-red-200 hover:bg-red-50"
                  onClick={() => {
                    if (confirm("确定要删除这条内容吗？删除后不可恢复。")) {
                      deletePost.mutate({ id: postId });
                    }
                  }}
                  title="删除"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        <TagContent
          html={post.content}
          className={`max-w-none mb-6 ${post.isArticle ? "article-content" : "prose prose-slate"}`}
        />

        {/* Images — only for non-article posts (articles have images inline) */}
        {!post.isArticle && images.length > 0 && (
          <div className="mb-4">
            <ImageGallery images={images} alt={post.title} />
          </div>
        )}

        {/* Location */}
        {!isSkyGallery && post.hasLocation && post.region && (
          <div className="flex items-center gap-2 p-3 bg-emerald-50 mb-6 text-sm text-emerald-700">
            <MapPin className="h-4 w-4" />
            拍摄地点：{post.region}
          </div>
        )}

        <Separator className="my-8" />

        {/* Comments */}
        <div className="mb-8">
          <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-sky-600" />
            评论 ({comments?.length || 0})
          </h3>

          {/* Comment Form */}
          {isAuthenticated ? (
            <div className="mb-6">
              <Textarea
                placeholder="写下你的评论..."
                value={commentContent}
                onChange={(e) => setCommentContent(e.target.value)}
                className="mb-2"
                rows={3}
              />
              <div className="flex justify-end">
                <Button
                  onClick={() => {
                    if (!commentContent.trim()) return;
                    createComment.mutate({ postId, content: commentContent.trim() });
                  }}
                  disabled={createComment.isPending || !commentContent.trim()}
                  className="bg-sky-600 hover:bg-sky-700"
                >
                  {createComment.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <Send className="h-4 w-4 mr-1" />
                  )}
                  发表评论
                </Button>
              </div>
            </div>
          ) : (
            <div className="mb-6 p-4 bg-slate-50 rounded-lg text-center text-sm text-slate-500">
              <Link to="/login" className="text-sky-600 hover:underline">
                登录
              </Link>
              后即可发表评论
            </div>
          )}

          {/* Comment List */}
          {commentsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-sky-600" />
            </div>
          ) : comments && comments.length > 0 ? (
            <div className="space-y-4">
              {comments.map((comment) => (
                <div key={comment.id} className="flex gap-3 p-4 bg-slate-50 rounded-lg">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={comment.author?.avatar || undefined} />
                    <AvatarFallback className="bg-sky-100 text-sky-700 text-xs">
                      <User className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm text-slate-900">
                        {comment.author?.name || "匿名用户"}
                      </span>
                      <span className="text-xs text-slate-400">
                        {new Date(comment.createdAt).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })}
                      </span>
                    </div>
                    <p className="text-sm text-slate-700">{comment.content}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-400 text-sm">
              暂无评论，来说两句吧
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
