import { Link } from "react-router";
import { trpc } from "@/providers/trpc";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Check, Loader2, MessageCircleMore, X } from "lucide-react";
import InlineEmoticons from "@/components/InlineEmoticons";
import { getPostPreviewTitle } from "@contracts/post-title";

export default function AdminCommentReviews() {
  const utils = trpc.useUtils();
  const { data: comments, isLoading } = trpc.admin.comments.pending.useQuery();
  const review = trpc.admin.comments.review.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.admin.comments.pending.invalidate(),
        utils.comment.list.invalidate(),
        utils.admin.audit.logs.invalidate(),
      ]);
    },
  });

  const handleReject = (commentId: number) => {
    const rejectReason = window.prompt("请输入拒绝原因（可选）：") || undefined;
    review.mutate({ commentId, approve: false, rejectReason });
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircleMore className="h-5 w-5 text-primary" />
            评论审核
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!comments || comments.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">暂无待审核评论</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>用户</TableHead>
                  <TableHead>评论内容</TableHead>
                  <TableHead>关联帖子</TableHead>
                  <TableHead>提交时间</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {comments.map((comment) => (
                  <TableRow key={comment.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={comment.author?.avatar || undefined} />
                          <AvatarFallback>{(comment.author?.name || "用户").slice(0, 1)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="text-sm font-medium">{comment.author?.name || "匿名用户"}</div>
                          <div className="text-xs text-muted-foreground">ID {comment.author?.publicId || comment.authorId}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="max-w-md whitespace-pre-wrap text-sm leading-relaxed text-foreground/80">
                        <InlineEmoticons text={comment.content} />
                      </div>
                      {comment.parentId ? (
                        <Badge variant="outline" className="mt-2">
                          回复
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      {comment.post ? (
                        <Link to={`/post/${comment.postId}`} className="text-sm font-medium text-primary hover:underline">
                          {getPostPreviewTitle(comment.post.title, comment.post.content)}
                        </Link>
                      ) : (
                        <span className="text-sm text-muted-foreground">帖子不存在</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(comment.createdAt).toLocaleString("zh-CN")}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          onClick={() => review.mutate({ commentId: comment.id, approve: true })}
                          disabled={review.isPending}
                        >
                          <Check className="mr-1 h-4 w-4" />
                          通过
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleReject(comment.id)}
                          disabled={review.isPending}
                        >
                          <X className="mr-1 h-4 w-4" />
                          拒绝
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
