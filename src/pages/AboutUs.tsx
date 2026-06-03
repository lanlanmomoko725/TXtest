import { useState } from "react";
import { Link } from "react-router";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import RichEditor from "@/components/RichEditor";
import { Loader2, ArrowLeft, Pencil, Check, X, Info } from "lucide-react";
import { sanitizeHtml } from "@contracts/html-sanitizer";

export default function AboutUs() {
  const { user } = useAuth();
  const isAdmin = !!user && user.level >= 99;

  const { data: about, isLoading } = trpc.about.get.useQuery();
  const utils = trpc.useUtils();
  const updateMutation = trpc.about.update.useMutation({
    onSuccess: async () => {
      await utils.about.get.invalidate();
      setIsEditing(false);
    },
  });

  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState("");

  const handleStartEdit = () => {
    setEditContent(about?.content || "");
    setIsEditing(true);
  };

  const handleSave = () => {
    updateMutation.mutate({
      content: editContent,
    });
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
      <div className="mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-none">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4 max-w-5xl mx-auto">
          <Link to="/" className="hover:text-primary">首页</Link>
          <span>/</span>
          <span className="text-foreground font-medium">我们是谁</span>
        </div>

        {/* Header */}
        <div className="mb-8 max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="p-2 rounded-full hover:bg-muted transition-colors">
              <ArrowLeft className="h-5 w-5 text-muted-foreground" />
            </Link>
            <h1 className="text-2xl font-bold text-foreground">我们是谁</h1>
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
        <div className="max-w-5xl mx-auto">
          {isEditing ? (
            <div className="space-y-4">
              <RichEditor
                value={editContent}
                onChange={setEditContent}
                placeholder="输入我们是谁的内容，支持富文本编辑，可在任意位置插入图片..."
                minHeight="500px"
              />
              {updateMutation.error && (
                <p className="text-sm text-destructive">{updateMutation.error.message}</p>
              )}
            </div>
          ) : about?.content ? (
            <div
              className="prose prose-slate max-w-none"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(about.content) }}
            />
          ) : (
            <div className="text-center py-20">
              <Info className="h-16 w-16 mx-auto mb-4 text-muted-foreground/40" />
              <h3 className="text-lg font-medium text-foreground/80 mb-2">暂无内容</h3>
              <p className="text-muted-foreground">管理员可以编辑添加内容。</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
