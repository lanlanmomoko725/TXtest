import { useParams, Link, useNavigate } from "react-router";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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
  ChevronRight,
} from "lucide-react";
import { useState } from "react";

export default function PostDetail() {
  const { id } = useParams<{ id: string }>();
  const postId = parseInt(id || "0");
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const [commentContent, setCommentContent] = useState("");

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
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-bold text-foreground mb-2">帖子不存在</h2>
          <Button onClick={() => navigate("/")} variant="outline" className="mt-2">
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
    <TooltipProvider>
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-3 sm:py-8">
          {/* Breadcrumb */}
          <nav aria-label="面包屑" className="flex items-center gap-1.5 text-sm text-muted-foreground mb-4 sm:mb-6">
            <Link to="/" className="hover:text-primary transition-colors rounded focus-visible:ring-2 focus-visible:ring-ring px-1 -ml-1">
              首页
            </Link>
            <ChevronRight className="h-3.5 w-3.5" />
            {isSkyGallery ? (
              <>
                <Link to="/sky-gallery" className="hover:text-primary transition-colors rounded focus-visible:ring-2 focus-visible:ring-ring px-1">
                  天空图鉴
                </Link>
                <ChevronRight className="h-3.5 w-3.5" />
              </>
            ) : (
              <>
                <Link to={`/category/${post.category}`} className="hover:text-primary transition-colors rounded focus-visible:ring-2 focus-visible:ring-ring px-1">
                  {categoryLabel}
                </Link>
                <ChevronRight className="h-3.5 w-3.5" />
              </>
            )}
            <span className="text-foreground truncate max-w-[200px] sm:max-w-sm">{post.title}</span>
          </nav>

          {/* Post Header */}
          <header className="mb-6 sm:mb-8">
            {!isSkyGallery && (
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <Badge variant="secondary" className="bg-primary/8 text-primary">
                  {categoryLabel}
                </Badge>
                {post.isArticle && (
                  <Badge variant="outline" className="text-amber-600 border-amber-200/60">
                    文章
                  </Badge>
                )}
                {post.isFeatured && (
                  <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">
                    <Star className="h-3 w-3 mr-1 fill-amber-500" />
                    精选
                  </Badge>
                )}
              </div>
            )}
            {post.title && (
              <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-5 text-wrap:balance">
                {post.title}
              </h1>
            )}

            <div className="flex items-center justify-between gap-3">
              {!isSkyGallery ? (
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10 border border-border/50">
                    <AvatarImage src={post.author?.avatar || undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {(post.author?.name || "用户").slice(0, 1)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <Link
                      to={`/profile/${post.authorId}`}
                      className="font-medium text-foreground hover:text-primary transition-colors"
                    >
                      {post.author?.name || "匿名用户"}
                    </Link>
                    <div className="flex items-center gap-2 sm:gap-3 text-xs text-muted-foreground tabular-nums">
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
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon"
                        variant={post.isFeatured ? "default" : "outline"}
                        onClick={() => setFeatured.mutate({ id: postId, featured: !post.isFeatured })}
                        className={`h-9 w-9 rounded-lg ${post.isFeatured ? "bg-amber-500 hover:bg-amber-600 text-white" : ""}`}
                      >
                        <Star className={`h-4 w-4 ${post.isFeatured ? "fill-white" : ""}`} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{post.isFeatured ? "取消精选" : "设为精选"}</p>
                    </TooltipContent>
                  </Tooltip>
                )}
                {(isAuthor || isAdmin) && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-9 w-9 rounded-lg text-destructive border-destructive/20 hover:bg-destructive/5"
                        onClick={() => {
                          if (confirm("确定要删除这条内容吗？删除后不可恢复。")) {
                            deletePost.mutate({ id: postId });
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>删除</p>
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
            </div>
          </header>

          {/* Content */}
          <article className="max-w-none mb-6">
            <TagContent
              html={post.content}
              className={`max-w-none ${post.isArticle ? "article-content" : "prose prose-slate dark:prose-invert"}`}
            />
          </article>

          {/* Images */}
          {!post.isArticle && images.length > 0 && (
            <div className="mb-6">
              <ImageGallery images={images} alt={post.title} />
            </div>
          )}

          {/* Location */}
          {!isSkyGallery && post.hasLocation && post.region && (
            <div className="flex items-center gap-2 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/50 mb-8 text-sm text-emerald-700 dark:text-emerald-400">
              <div className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-900/50">
                <MapPin className="h-4 w-4" />
              </div>
              <span>拍摄地点：{post.region}</span>
            </div>
          )}

          <Separator className="my-8 bg-gradient-to-r from-transparent via-border to-transparent" />

          {/* Comments */}
          <section className="mb-8">
            <h3 className="text-lg font-bold text-foreground mb-5 flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-primary" />
              评论 ({comments?.length || 0})
            </h3>

            {/* Comment Form */}
            {isAuthenticated ? (
              <div className="mb-8 p-4 sm:p-5 rounded-xl bg-muted/40 border border-border/50">
                <Textarea
                  placeholder="写下你的评论…"
                  value={commentContent}
                  onChange={(e) => setCommentContent(e.target.value)}
                  className="mb-3 bg-background border-border/60 focus-visible:ring-2 focus-visible:ring-primary/30 resize-none"
                  rows={3}
                />
                <div className="flex justify-end">
                  <Button
                    onClick={() => {
                      if (!commentContent.trim()) return;
                      createComment.mutate({ postId, content: commentContent.trim() });
                    }}
                    disabled={createComment.isPending || !commentContent.trim()}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-soft transition-all duration-200 hover:shadow-card-hover active:scale-[0.98]"
                  >
                    {createComment.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                    ) : (
                      <Send className="h-4 w-4 mr-1.5" />
                    )}
                    发表评论
                  </Button>
                </div>
              </div>
            ) : (
              <div className="mb-8 p-5 rounded-xl bg-muted/40 border border-border/50 text-center text-sm text-muted-foreground">
                <Link to="/login" className="text-primary hover:underline font-medium">
                  登录
                </Link>
                后即可发表评论
              </div>
            )}

            {/* Comment List */}
            {commentsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : comments && comments.length > 0 ? (
              <div className="space-y-3">
                {comments.map((comment) => (
                  <div key={comment.id} className="flex gap-3 p-4 rounded-xl bg-muted/30 border border-border/40 hover:bg-muted/50 transition-colors">
                    <Avatar className="h-9 w-9 flex-shrink-0 border border-border/50">
                      <AvatarImage src={comment.author?.avatar || undefined} />
                      <AvatarFallback className="bg-primary/10 text-primary text-xs">
                        <User className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm text-foreground">
                          {comment.author?.name || "匿名用户"}
                        </span>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {new Date(comment.createdAt).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })}
                        </span>
                      </div>
                      <p className="text-sm text-foreground/80 leading-relaxed">{comment.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-10 text-muted-foreground">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted mb-3">
                  <MessageCircle className="h-6 w-6 text-muted-foreground/40" />
                </div>
                <p className="text-sm">暂无评论，来说两句吧</p>
              </div>
            )}
          </section>
        </div>
      </div>
    </TooltipProvider>
  );
}
