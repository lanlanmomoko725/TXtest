import { Link, useNavigate, useLocation } from "react-router";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Cloud,
  PenLine,
  User,
  LogOut,
  Menu,
  X,
  Home,
  ImageIcon,
  CalendarDays,
  Clock,
  Library,
  Info,
  Search,
} from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";

const navItems = [
  { to: "/", label: "首页", icon: Home },
  { to: "/sky-events", label: "实时天象", icon: Clock },
  { to: "/sky-gallery", label: "天空图鉴", icon: Library, accent: "text-purple-600" },
  { to: "/weekly-sky", label: "每周天象", icon: CalendarDays },
  { to: "/sky-explanation", label: "天象解说图", icon: ImageIcon },
  { to: "/about", label: "关于我们", icon: Info },
];

const searchItem = { to: "/search", label: "搜索", icon: Search, accent: undefined as string | undefined };

export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const navRef = useRef<HTMLElement>(null);

  const closeMenu = useCallback(() => {
    setMobileMenuOpen(false);
  }, []);

  // Scroll detection
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 8);
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Close on click outside
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (navRef.current && !navRef.current.contains(target)) {
        closeMenu();
      }
    };
    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [mobileMenuOpen, closeMenu]);

  // Close on page scroll
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const handleScroll = () => closeMenu();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [mobileMenuOpen, closeMenu]);

  // Lock body scroll when mobile menu open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen]);

  return (
    <nav
      ref={navRef}
      className={`sticky top-0 z-50 w-full transition-all duration-300 ease-out-quart ${
        scrolled
          ? "border-b border-border/60 bg-background/80 shadow-sm backdrop-blur-xl"
          : "border-b border-transparent bg-background"
      }`}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link
            to="/"
            className="flex items-center gap-2 text-xl font-bold text-foreground transition-colors hover:opacity-80 focus-visible:rounded-lg"
          >
            <Cloud className="h-6 w-6 text-primary" />
            <span>天象志</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.to;
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  aria-current={isActive ? "page" : undefined}
                  className={`relative flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 focus-visible:ring-2 focus-visible:ring-ring ${
                    isActive
                      ? "text-primary bg-primary/8"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent"
                  }`}
                >
                  <Icon className={`h-4 w-4 ${item.accent && !isActive ? item.accent : ""}`} />
                  <span>{item.label}</span>
                  {isActive && (
                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 w-4 rounded-full bg-primary" />
                  )}
                </Link>
              );
            })}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => navigate("/search")}
              className="hidden md:flex text-muted-foreground hover:text-foreground hover:bg-accent transition-all duration-200 active:scale-[0.98]"
            >
              <Search className="h-4 w-4" />
            </Button>

            {isAuthenticated && (
              <Button
                size="sm"
                onClick={() => navigate("/create")}
                className="hidden md:flex bg-primary hover:bg-primary/90 text-primary-foreground shadow-soft transition-all duration-200 hover:shadow-card-hover active:scale-[0.98]"
              >
                <PenLine className="h-4 w-4 mr-1.5" />
                发布
              </Button>
            )}

            {isAuthenticated && user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 rounded-lg p-1 transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring">
                    <Avatar className="h-8 w-8 border border-border">
                      <AvatarImage src={user.avatar || undefined} />
                      <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
                        {(user.name || "用户").slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="hidden md:inline text-sm font-medium text-foreground">
                      {user.name || "用户"}
                    </span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem
                    onClick={() => navigate(`/profile/${user.id}`)}
                    className="cursor-pointer focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <User className="h-4 w-4 mr-2" />
                    个人主页
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => navigate("/create")}
                    className="cursor-pointer md:hidden focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <PenLine className="h-4 w-4 mr-2" />
                    发布
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={logout}
                    className="cursor-pointer text-destructive focus:text-destructive focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    退出登录
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigate("/login")}
                className="border-primary/30 text-primary hover:bg-primary/5 hover:border-primary/50 transition-all duration-200 active:scale-[0.98]"
              >
                登录
              </Button>
            )}

            {/* Mobile menu button */}
            <button
              className="md:hidden p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-expanded={mobileMenuOpen}
              aria-label={mobileMenuOpen ? "关闭菜单" : "打开菜单"}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Panel -- no overlay, click-outside handled by useEffect */}
      {mobileMenuOpen && (
        <div
          className="md:hidden fixed top-16 right-0 z-50 w-72 max-w-[85vw] bg-background/95 backdrop-blur-xl border-l border-border shadow-elevated animate-slide-in-right"
          style={{ height: "calc(100dvh - 4rem)", maxHeight: "calc(100dvh - 4rem)", overscrollBehavior: "contain" }}
        >
          <div className="flex flex-col p-4 gap-1 overflow-y-auto h-full scrollbar-thin">
            {[...navItems, searchItem].map((item) => {
              const isActive = location.pathname === item.to;
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => {
                    if (item.to === "/sky-events" || item.to === "/sky-gallery") {
                      sessionStorage.setItem("sidebar_auto_open", "1");
                    }
                    closeMenu();
                  }}
                  aria-current={isActive ? "page" : undefined}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring ${
                    isActive
                      ? "text-primary bg-primary/8"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent"
                  }`}
                >
                  <Icon className={`h-4 w-4 ${item.accent && !isActive ? item.accent : ""}`} />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </nav>
  );
}
