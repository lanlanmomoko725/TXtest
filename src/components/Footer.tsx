import { Link } from "react-router";
import { ArrowUpRight } from "lucide-react";
import { SKY_CATEGORIES } from "@contracts/constants";

const quickLinks = [
  { to: "/sky-gallery", label: "天空图鉴" },
  { to: "/sky-explanation", label: "天象解说图" },
  { to: "/weekly-sky", label: "每周一图" },
  { to: "/sky-events", label: "实时天象" },
  { to: "/activities", label: "组织活动" },
  { to: "/about", label: "我们是谁" },
  { to: "/join-us", label: "加入我们" },
];

export default function Footer() {
  return (
    <footer className="w-full border-t bg-muted/30 mt-auto">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-2 gap-x-8 gap-y-10 md:grid-cols-3">
          {/* Brand */}
          <div className="col-span-2 space-y-4 md:col-span-1">
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-lg font-bold text-foreground transition-opacity hover:opacity-80 focus-visible:rounded-lg"
              aria-label="返回首页"
            >
              <img src="/logo.png" alt="天象志" width={28} height={28} className="h-7 w-7 rounded-full object-contain" />
              <span>天象志</span>
            </Link>
            <p className="text-sm text-muted-foreground leading-relaxed">
              记录天空的每一种奇迹！
            </p>
          </div>

          {/* Quick Links */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground uppercase">
              快速导航
            </h3>
            <ul className="space-y-2">
              {quickLinks.map((link) => (
                <li key={link.to}>
                  <Link
                    to={link.to}
                    className="group inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:rounded"
                  >
                    {link.label}
                    <ArrowUpRight className="h-3 w-3 opacity-0 -translate-y-0.5 translate-x-0.5 transition-all group-hover:opacity-100 group-hover:translate-y-0 group-hover:translate-x-0" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Categories */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground uppercase">
              天象分类
            </h3>
            <ul className="space-y-2">
              {SKY_CATEGORIES.map((cat) => (
                <li key={cat.id}>
                  <Link
                    to={`/category/${cat.id}`}
                    className="group inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:rounded"
                  >
                    {cat.label}
                    <ArrowUpRight className="h-3 w-3 opacity-0 -translate-y-0.5 translate-x-0.5 transition-all group-hover:opacity-100 group-hover:translate-y-0 group-hover:translate-x-0" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-10 pt-6 border-t border-border/60 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} 天象志. 保留所有权利.
          </p>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <Link to="/about" className="hover:text-foreground transition-colors">
              我们是谁
            </Link>
            <span className="text-border">·</span>
            <Link to="/" className="hover:text-foreground transition-colors">
              使用条款
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
