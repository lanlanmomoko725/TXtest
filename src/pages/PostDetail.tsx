import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import ImageGallery from "@/components/ImageGallery";
import TagContent from "@/components/TagContent";
import { formatShortDateTime } from "@/lib/date-format";
import { CATEGORY_LABEL_MAP } from "@contracts/constants";
import {
  ArrowLeft,
  Calendar,
  ChevronDown,
  ChevronRight,
  Eye,
  Heart,
  Loader2,
  MapPin,
  MessageCircle,
  Reply,
  Send,
  Star,
  Trash2,
  User,
} from "lucide-react";

const INITIAL_REPLY_LIMIT = 3;
const REPLY_PAGE_SIZE = 10;
const COMMENT_MAX_LENGTH = 300;

export default function PostDetail() {
  const { id } = useParams<{ id: string }>();
  const postId = parseInt(id || "0", 10);
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const [commentContent, setCommentContent] = useState("");
  const [replyContent, setReplyContent] = useState("");
  const [replyTarget, setReplyTarget] = useState<{ id: number; name: string } | null>(null);
  const [commentError, setCommentError] = useState("");
  const [commentMessage, setCommentMessage] = useState("");
  const [expandedReplies, setExpandedReplies] = useState<Record<number, number>>({});

  const { data: post, isLoading: postLoading } = trpc.post.byId.useQuery(
    { id: postId },
    { enabled: postId > 0 },
  );

  const { data: comments, isLoading: commentsLoading, refetch: refetchComments } =
    trpc.comment.list.useQuery({ postId }, { enabled: postId > 0 });

  const utils = trpc.useUtils();
  const createComment = trpc.comment.create.useMutation({
    onSuccess: (data) => {
      setCommentContent("");
      setReplyContent("");
      setReplyTarget(null);
      setCommentError("");
      setCommentMessage(data.pendingReview ? "评论已提交审核，通过后公开。" : "评论已发布。");
      refetchComments();
    },
    onError: (err) => {
      setCommentError(err.message);
      setCommentMessage("");
    },
  });

  const deleteComment = trpc.comment.delete.useMutation({
    onSuccess: () => {
      setCommentError("");
      refetchComments();
    },
    onError: (err) => {
      setCommentError(err.message);
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

  const toggleLike = trpc.post.toggleLike.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.post.byId.invalidate({ id: postId }),
        utils.post.list.invalidate(),
        utils.post.featured.invalidate(),
        utils.post.byTag.invalidate(),
        utils.post.search.invalidate(),
      ]);
    },
  });

  const isAdmin = !!user && user.level >= 99;
  const isAuthor = post?.authorId === user?.id;
  const isSkyGallery = !!post?.skyGalleryCategory;
  const commentTotal = comments?.reduce((total, comment) => total + 1 + comment.replies.length, 0) ?? 0;

  const handleCreateComment = (content: string, replyToCommentId?: number) => {
    const trimmed = content.trim();
    if (!trimmed) return;
    if (trimmed.length > COMMENT_MAX_LENGTH) {
      setCommentError(`评论最多 ${COMMENT_MAX_LENGTH} 个字符。`);
      setCommentMessage("");
      return;
    }
    setCommentError("");
    setCommentMessage("");
    createComment.mutate({ postId, content: trimmed, replyToCommentId });
  };

  const openReply = (target: { id: number; name: string }) => {
    setReplyTarget(target);
    setReplyContent("");
    setCommentError("");
    setCommentMessage("");
  };

  const closeReply = () => {
    setReplyTarget(null);
    setReplyContent("");
    setCommentError("");
  };

  const expandReplies = (commentId: number, total: number) => {
    setExpandedReplies((prev) => {
      const current = prev[commentId] ?? INITIAL_REPLY_LIMIT;
      return {
        ...prev,
        [commentId]: Math.min(total, current + REPLY_PAGE_SIZE),
      };
    });
  };

  const handleDeleteComment = (id: number, hasReplies: boolean) => {
    const message = hasReplies
      ? "确定删除这条评论及其所有回复吗？删除后不可恢复。"
      : "确定删除这条评论吗？删除后不可恢复。";
    if (confirm(message)) {
      deleteComment.mutate({ id });
    }
  };

  const handleToggleLike = () => {
    if (!post || post.skyGalleryCategory || post.likedByMe || toggleLike.isPending) return;
    toggleLike.mutate({ postId });
  };

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
  const weeklyLikeCount = post.weeklyLikeCount ?? post.likeCount ?? 0;
  const commentContentLength = commentContent.trim().length;
  const replyContentLength = replyContent.trim().length;

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-3 sm:py-8">
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
                        {formatShortDateTime(post.createdAt)}
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

          <article className="max-w-none mb-6">
            <TagContent
              html={post.content}
              className={`max-w-none ${post.isArticle ? "article-content" : "prose prose-slate dark:prose-invert"}`}
            />
          </article>

          {!post.isArticle && images.length > 0 && (
            <div className="mb-6">
              <ImageGallery images={images} alt={post.title} />
            </div>
          )}

          {!isSkyGallery && post.hasLocation && post.region && (
            <div className="flex items-center gap-2 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/50 mb-8 text-sm text-emerald-700 dark:text-emerald-400">
              <div className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-900/50">
                <MapPin className="h-4 w-4" />
              </div>
              <span>拍摄地点：{post.region}</span>
            </div>
          )}

          <Separator className="my-8 bg-gradient-to-r from-transparent via-border to-transparent" />

          <section className="mb-8">
            <div className="mb-5 flex items-center justify-between gap-3">
              <h3 className="text-lg font-bold text-foreground">
                评论（{commentTotal}）
              </h3>
              {isAuthenticated && !isSkyGallery && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleToggleLike}
                      disabled={toggleLike.isPending}
                      aria-label={post.likedByMe ? "已点赞" : "点赞"}
                      aria-pressed={Boolean(post.likedByMe)}
                      aria-disabled={post.likedByMe || toggleLike.isPending}
                      className={`h-9 rounded-lg px-3 gap-1.5 ${
                        post.likedByMe
                          ? "cursor-default border-red-200 bg-red-50 text-red-600"
                          : "border-border text-muted-foreground hover:border-red-200 hover:text-red-600"
                      }`}
                    >
                      {toggleLike.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Heart className={`h-4 w-4 ${post.likedByMe ? "fill-current" : ""}`} />
                      )}
                      <span className="tabular-nums">{weeklyLikeCount}</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{post.likedByMe ? "已点赞" : "点赞"}</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>

            {isAuthenticated ? (
              <div className="mb-8 p-4 sm:p-5 rounded-xl bg-muted/40 border border-border/50">
                <Textarea
                  placeholder="写下你的评论..."
                  value={commentContent}
                  onChange={(e) => setCommentContent(e.target.value)}
                  maxLength={COMMENT_MAX_LENGTH}
                  className="mb-3 bg-background border-border/60 focus-visible:ring-2 focus-visible:ring-primary/30 resize-none"
                  rows={3}
                />
                <div className="flex items-center justify-between gap-3">
                  <span className={`text-xs tabular-nums ${commentContentLength > COMMENT_MAX_LENGTH ? "text-destructive" : "text-muted-foreground"}`}>
                    {commentContentLength}/{COMMENT_MAX_LENGTH}
                  </span>
                  <Button
                    onClick={() => handleCreateComment(commentContent)}
                    disabled={createComment.isPending || !commentContent.trim() || commentContentLength > COMMENT_MAX_LENGTH}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-soft transition-all duration-200 hover:shadow-card-hover active:scale-[0.98]"
                  >
                    {createComment.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                    ) : (
                      <Send className="h-4 w-4 mr-1.5" />
                    )}
                    {isAdmin ? "发表评论" : "提交审核"}
                  </Button>
                </div>
                {commentMessage && !replyTarget && (
                  <p className="mt-3 text-sm text-emerald-600">{commentMessage}</p>
                )}
                {commentError && !replyTarget && (
                  <p className="mt-3 text-sm text-destructive">{commentError}</p>
                )}
              </div>
            ) : (
              <div className="mb-8 p-5 rounded-xl bg-muted/40 border border-border/50 text-center text-sm text-muted-foreground">
                <Link to="/login" className="text-primary hover:underline font-medium">
                  登录
                </Link>
                后即可发表评论
              </div>
            )}

            {commentsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : comments && comments.length > 0 ? (
              <div className="space-y-4">
                {comments.map((comment) => {
                  const authorName = comment.author?.name || "匿名用户";
                  const replyLimit = Math.min(comment.replies.length, expandedReplies[comment.id] ?? INITIAL_REPLY_LIMIT);
                  const visibleReplies = comment.replies.slice(0, replyLimit);
                  const hiddenReplyCount = comment.replies.length - visibleReplies.length;

                  return (
                    <div key={comment.id} className="rounded-xl border border-border/40 bg-background p-4 transition-colors hover:bg-muted/20">
                      <div className="flex gap-3">
                        <div className="flex flex-shrink-0 pt-0.5">
                          <Avatar className="h-9 w-9 flex-shrink-0 border border-border/50">
                            <AvatarImage src={comment.author?.avatar || undefined} />
                            <AvatarFallback className="bg-primary/10 text-primary text-xs">
                              <User className="h-4 w-4" />
                            </AvatarFallback>
                          </Avatar>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="break-words text-sm leading-relaxed text-foreground/85">
                            <span className="font-medium text-primary">{authorName}</span>
                            <span>：</span>
                            <span className="whitespace-pre-wrap break-words">{comment.content}</span>
                          </p>
                          <div className="mt-1 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                            <span className="tabular-nums">{formatShortDateTime(comment.createdAt)}</span>
                            <div className="flex items-center gap-2">
                              {isAuthenticated ? (
                                <Popover
                                  open={replyTarget?.id === comment.id}
                                  onOpenChange={(open) => {
                                    if (open) openReply({ id: comment.id, name: authorName });
                                    else if (replyTarget?.id === comment.id) closeReply();
                                  }}
                                >
                                  <PopoverTrigger asChild>
                                    <button
                                      type="button"
                                      className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-muted-foreground transition-colors hover:bg-accent hover:text-primary"
                                    >
                                      <Reply className="h-3.5 w-3.5" />
                                      回复
                                    </button>
                                  </PopoverTrigger>
                                  <PopoverContent align="end" className="w-[min(22rem,calc(100vw-2rem))] p-3">
                                    <Textarea
                                      autoFocus
                                      placeholder={`回复 ${authorName}...`}
                                      value={replyContent}
                                      onChange={(e) => setReplyContent(e.target.value)}
                                      maxLength={COMMENT_MAX_LENGTH}
                                      className="mb-2 min-h-24 resize-none bg-background"
                                    />
                                    <div className="flex items-center justify-between gap-2">
                                      <span className={`text-xs tabular-nums ${replyContentLength > COMMENT_MAX_LENGTH ? "text-destructive" : "text-muted-foreground"}`}>
                                        {replyContentLength}/{COMMENT_MAX_LENGTH}
                                      </span>
                                      <div className="flex items-center gap-2">
                                        <Button variant="ghost" size="sm" onClick={closeReply}>
                                          取消
                                        </Button>
                                        <Button
                                          size="sm"
                                          onClick={() => handleCreateComment(replyContent, comment.id)}
                                          disabled={createComment.isPending || !replyContent.trim() || replyContentLength > COMMENT_MAX_LENGTH}
                                        >
                                          {createComment.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
                                          {isAdmin ? "回复" : "提交审核"}
                                        </Button>
                                      </div>
                                    </div>
                                    {commentError && replyTarget?.id === comment.id ? (
                                      <p className="mt-2 text-sm text-destructive">{commentError}</p>
                                    ) : null}
                                  </PopoverContent>
                                </Popover>
                              ) : null}
                              {isAdmin || comment.authorId === user?.id ? (
                                <button
                                  type="button"
                                  className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-muted-foreground transition-colors hover:bg-destructive/5 hover:text-destructive"
                                  onClick={() => handleDeleteComment(comment.id, comment.replies.length > 0)}
                                  disabled={deleteComment.isPending}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  删除
                                </button>
                              ) : null}
                            </div>
                          </div>

                          {visibleReplies.length > 0 ? (
                            <div className="mt-3 space-y-2 rounded-lg bg-muted/30 px-3 py-2">
                              {visibleReplies.map((reply) => {
                                const replyAuthorName = reply.author?.name || "匿名用户";
                                const replyToName = reply.replyToUser?.name || null;

                                return (
                                  <div key={reply.id} className="rounded-md py-1.5">
                                    <p className="break-words text-sm leading-relaxed text-foreground/85">
                                      <span className="font-medium text-primary">{replyAuthorName}</span>
                                      <span>：</span>
                                      {replyToName ? (
                                        <>
                                          <span>回复</span>
                                          <span className="text-primary">@{replyToName}</span>
                                          <span>：</span>
                                        </>
                                      ) : null}
                                      <span className="whitespace-pre-wrap break-words">{reply.content}</span>
                                    </p>
                                    <div className="mt-1 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                                      <span className="tabular-nums">{formatShortDateTime(reply.createdAt)}</span>
                                      <div className="flex items-center gap-2">
                                        {isAuthenticated ? (
                                          <Popover
                                            open={replyTarget?.id === reply.id}
                                            onOpenChange={(open) => {
                                              if (open) openReply({ id: reply.id, name: replyAuthorName });
                                              else if (replyTarget?.id === reply.id) closeReply();
                                            }}
                                          >
                                            <PopoverTrigger asChild>
                                              <button
                                                type="button"
                                                className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-muted-foreground transition-colors hover:bg-accent hover:text-primary"
                                              >
                                                <Reply className="h-3.5 w-3.5" />
                                                回复
                                              </button>
                                            </PopoverTrigger>
                                            <PopoverContent align="end" className="w-[min(22rem,calc(100vw-2rem))] p-3">
                                              <Textarea
                                                autoFocus
                                                placeholder={`回复 ${replyAuthorName}...`}
                                                value={replyContent}
                                                onChange={(e) => setReplyContent(e.target.value)}
                                                maxLength={COMMENT_MAX_LENGTH}
                                                className="mb-2 min-h-24 resize-none bg-background"
                                              />
                                              <div className="flex items-center justify-between gap-2">
                                                <span className={`text-xs tabular-nums ${replyContentLength > COMMENT_MAX_LENGTH ? "text-destructive" : "text-muted-foreground"}`}>
                                                  {replyContentLength}/{COMMENT_MAX_LENGTH}
                                                </span>
                                                <div className="flex items-center gap-2">
                                                  <Button variant="ghost" size="sm" onClick={closeReply}>
                                                    取消
                                                  </Button>
                                                  <Button
                                                    size="sm"
                                                    onClick={() => handleCreateComment(replyContent, reply.id)}
                                                    disabled={createComment.isPending || !replyContent.trim() || replyContentLength > COMMENT_MAX_LENGTH}
                                                  >
                                                    {createComment.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
                                                    {isAdmin ? "回复" : "提交审核"}
                                                  </Button>
                                                </div>
                                              </div>
                                              {commentError && replyTarget?.id === reply.id ? (
                                                <p className="mt-2 text-sm text-destructive">{commentError}</p>
                                              ) : null}
                                            </PopoverContent>
                                          </Popover>
                                        ) : null}
                                        {isAdmin || reply.authorId === user?.id ? (
                                          <button
                                            type="button"
                                            className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-muted-foreground transition-colors hover:bg-destructive/5 hover:text-destructive"
                                            onClick={() => handleDeleteComment(reply.id, false)}
                                            disabled={deleteComment.isPending}
                                          >
                                            <Trash2 className="h-3.5 w-3.5" />
                                            删除
                                          </button>
                                        ) : null}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                              {hiddenReplyCount > 0 ? (
                                <button
                                  type="button"
                                  className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-sm text-primary transition-colors hover:bg-primary/8"
                                  onClick={() => expandReplies(comment.id, comment.replies.length)}
                                >
                                  展开 {Math.min(REPLY_PAGE_SIZE, hiddenReplyCount)} 条回复
                                  <ChevronDown className="h-3.5 w-3.5" />
                                </button>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
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
