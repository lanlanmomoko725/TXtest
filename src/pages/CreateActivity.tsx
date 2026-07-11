import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { CalendarDays, Check, ImagePlus, Loader2, Send } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { LOGIN_PATH } from "@/const";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import RichEditor from "@/components/RichEditor";
import { formatActivityMonth } from "@/components/ActivityCard";

function extractImageUrlsFromHtml(html: string): string[] {
  const urls: string[] = [];
  const regex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null) {
    if (match[1]) urls.push(match[1]);
  }
  return [...new Set(urls)];
}

function hasVisibleContent(html: string) {
  const text = html.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
  return text.length > 0 || /<img\b|<iframe\b|<video\b/i.test(html);
}

function shanghaiYearMonth() {
  const local = new Date(Date.now() + 8 * 60 * 60 * 1000);
  return {
    year: local.getUTCFullYear(),
    month: local.getUTCMonth() + 1,
  };
}

const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1);

export default function CreateActivity() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth({
    redirectOnUnauthenticated: true,
    redirectPath: LOGIN_PATH,
  });
  const now = useMemo(() => shanghaiYearMonth(), []);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [activityYear, setActivityYear] = useState(now.year);
  const [activityMonth, setActivityMonth] = useState(now.month);
  const [coverImage, setCoverImage] = useState("");
  const [formError, setFormError] = useState("");
  const coverCandidates = useMemo(() => extractImageUrlsFromHtml(content), [content]);
  const canManage = !!user && user.level >= 99;

  useEffect(() => {
    if (coverCandidates.length === 0) {
      if (coverImage) setCoverImage("");
      return;
    }
    if (!coverImage || !coverCandidates.includes(coverImage)) {
      setCoverImage(coverCandidates[0]);
    }
  }, [coverCandidates, coverImage]);

  const utils = trpc.useUtils();
  const createActivity = trpc.activity.create.useMutation({
    onSuccess: async (activity) => {
      await Promise.all([
        utils.activity.list.invalidate(),
        utils.activity.archive.invalidate(),
      ]);
      if (activity) navigate(`/activities/detail/${activity.id}`);
    },
    onError: (error) => {
      setFormError(error.message);
    },
  });

  if (!isAuthenticated || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!canManage) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="max-w-sm text-center">
          <h1 className="mb-2 text-xl font-bold text-foreground">暂无发布权限</h1>
          <p className="text-sm text-muted-foreground">组织活动仅管理员可以发布。</p>
        </div>
      </div>
    );
  }

  const handleSubmit = () => {
    const finalTitle = title.trim();
    if (!finalTitle) {
      setFormError("请输入活动标题。");
      return;
    }
    if (!hasVisibleContent(content)) {
      setFormError("请输入活动正文。");
      return;
    }
    if (!Number.isInteger(activityYear) || activityYear < 1900 || activityYear > 2200) {
      setFormError("请选择有效年份。");
      return;
    }
    setFormError("");
    const finalCoverImage = coverCandidates.includes(coverImage)
      ? coverImage
      : coverCandidates[0] || "";
    createActivity.mutate({
      title: finalTitle,
      content,
      coverImage: finalCoverImage || undefined,
      activityYear,
      activityMonth,
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
              <CalendarDays className="h-6 w-6 text-primary" />
              发布组织活动
            </h1>
          </div>
        </div>

        <div className="space-y-7">
          <div>
            <Label htmlFor="activity-title" className="text-sm font-medium">标题</Label>
            <Input
              id="activity-title"
              placeholder="请输入活动标题"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="mt-1.5 bg-background"
            />
          </div>

          <div>
            <Label className="mb-2 block text-sm font-medium">活动年月</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button type="button" variant="outline" className="h-10 justify-start gap-2">
                  <CalendarDays className="h-4 w-4 text-muted-foreground" />
                  {formatActivityMonth(activityYear, activityMonth)}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-80 p-4">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="activity-year" className="text-xs text-muted-foreground">年份</Label>
                    <Input
                      id="activity-year"
                      type="number"
                      min={1900}
                      max={2200}
                      value={activityYear}
                      onChange={(event) => setActivityYear(Number(event.target.value))}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">月份</Label>
                    <div className="mt-2 grid grid-cols-4 gap-2">
                      {MONTHS.map((month) => (
                        <button
                          key={month}
                          type="button"
                          onClick={() => setActivityMonth(month)}
                          className={`h-9 rounded-lg border text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring ${
                            activityMonth === month
                              ? "border-primary bg-primary/10 font-medium text-primary"
                              : "border-border/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                          }`}
                        >
                          {month}月
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <div>
            <Label className="mb-2 block text-sm font-medium">正文</Label>
            <RichEditor
              value={content}
              onChange={setContent}
              placeholder="编辑组织活动正文，可插入图片并选择其中一张作为封面。"
              minHeight="420px"
            />
          </div>

          {coverCandidates.length > 0 && (
            <div className="rounded-xl border border-border/60 bg-card/70 p-4">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <Label className="flex items-center gap-2 text-sm font-medium">
                    <ImagePlus className="h-4 w-4 text-primary" />
                    封面展示
                  </Label>
                  <p className="mt-1 text-xs text-muted-foreground">活动列表只展示选中的这一张图片。</p>
                </div>
                <span className="text-xs text-muted-foreground">{coverCandidates.length} 张可选</span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-5">
                {coverCandidates.map((url, index) => {
                  const selected = coverImage === url;
                  return (
                    <button
                      key={`${url}-${index}`}
                      type="button"
                      onClick={() => setCoverImage(url)}
                      aria-pressed={selected}
                      className={`group relative overflow-hidden rounded-xl border bg-muted text-left transition-all duration-200 focus-visible:ring-2 focus-visible:ring-ring ${
                        selected
                          ? "border-primary shadow-soft ring-2 ring-primary/20"
                          : "border-border/50 hover:border-primary/40"
                      }`}
                    >
                      <img
                        src={url}
                        alt={`封面候选 ${index + 1}`}
                        className="aspect-square w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                        loading="lazy"
                      />
                      {selected && (
                        <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[11px] font-medium text-primary-foreground shadow-soft">
                          <Check className="h-3 w-3" />
                          封面
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {formError && <p className="text-sm text-destructive">{formError}</p>}

          <div className="flex items-center justify-end gap-3 border-t border-border/40 pt-4">
            <Button variant="outline" asChild>
              <Link to="/activities">取消</Link>
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={createActivity.isPending || !title.trim() || !hasVisibleContent(content)}
            >
              {createActivity.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              发布
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
