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
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const navRef = useRef<HTMLElement>(null);
  const desktopInputRef = useRef<HTMLInputElement>(null);
  const mobileInputRef = useRef<HTMLInputElement>(null);

  const closeMenu = useCallback(() => {
    setMobileMenuOpen(false);
  }, []);

  const closeSearch = useCallback(() => {
    setSearchOpen(false);
    setSearchQuery("");
  }, []);

  const handleSearch = useCallback(() => {
    const q = searchQuery.trim();
    if (q) {
      navigate(`/search?q=${encodeURIComponent(q)}`);
      closeSearch();
    }
  }, [searchQuery, navigate, closeSearch]);

  const handleSearchKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        handleSearch();
      } else if (e.key === "Escape") {
        closeSearch();
      }
    },
    [handleSearch, closeSearch]
  );

  // Auto-focus the visible search input when opened
  useEffect(() => {
    if (searchOpen) {
      requestAnimationFrame(() => {
        const desktopInput = desktopInputRef.current;
        const mobileInput = mobileInputRef.current;
        // offsetParent is null when element is hidden (display:none)
        if (desktopInput && desktopInput.offsetParent !== null) {
          desktopInput.focus();
        } else if (mobileInput && mobileInput.offsetParent !== null) {
          mobileInput.focus();
        }
      });
    }
  }, [searchOpen]);

  // Scroll detection
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 8);
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Close on click outside (mobile menu or search)
  useEffect(() => {
    if (!mobileMenuOpen && !searchOpen) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (navRef.current && !navRef.current.contains(target)) {
        closeMenu();
        closeSearch();
      }
    };
    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [mobileMenuOpen, searchOpen, closeMenu, closeSearch]);

  // Close on page scroll (mobile menu only)
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

  // Close search/menu on route change
  useEffect(() => {
    closeMenu();
    closeSearch();
  }, [location.pathname, closeMenu, closeSearch]);

  const renderAvatar = () =>
    isAuthenticated && user ? (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2 rounded-lg p-1 transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring shrink-0">
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
        className="border-primary/30 text-primary hover:bg-primary/5 hover:border-primary/50 transition-all duration-200 active:scale-[0.98] shrink-0"
      >
        登录
      </Button>
    );

  // Desktop search input: expands left from the search button
  const desktopSearchInput = (
    <div
      className={`hidden md:block overflow-hidden transition-all duration-300 ease-out-quart ${
        searchOpen ? "w-48 lg:w-56" : "w-0"
      }`}
    >
      <div className="relative w-48 lg:w-56">
        <input
          ref={desktopInputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={handleSearchKeyDown}
          placeholder="搜索文章..."
          className="w-full rounded-full border border-border bg-background px-4 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-accent transition-colors"
            aria-label="清除"
          >
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        )}
      </div>
    </div>
  );

  // Mobile search input: expands left from the search button
  const mobileSearchInput = (
    <div
      className={`md:hidden overflow-hidden transition-all duration-300 ease-out-quart ${
        searchOpen ? "w-32 sm:w-40" : "w-0"
      }`}
    >
      <div className="relative w-32 sm:w-40">
        <input
          ref={mobileInputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={handleSearchKeyDown}
          placeholder="搜索..."
          className="w-full rounded-full border border-border bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-accent transition-colors"
            aria-label="清除"
          >
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        )}
      </div>
    </div>
  );

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
        {/* Desktop Layout */}
        <div className="hidden md:flex h-16 items-center justify-between">
          {/* Logo */}
          <Link
            to="/"
            className="flex items-center gap-2 text-xl font-bold text-foreground transition-colors hover:opacity-80 focus-visible:rounded-lg shrink-0"
          >
            <Cloud className="h-6 w-6 text-primary" />
            <span>天象志</span>
          </Link>

          {/* Desktop Navigation — always visible */}
          <div className="flex items-center gap-1">
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

          {/* Right side: search expands from button to the left */}
          <div className="flex items-center gap-2 shrink-0">
            {desktopSearchInput}

            <Button
              size="sm"
              variant="ghost"
              onClick={searchOpen ? closeSearch : () => setSearchOpen(true)}
              className="text-muted-foreground hover:text-foreground hover:bg-accent transition-all duration-200 active:scale-[0.98]"
              aria-label={searchOpen ? "取消搜索" : "搜索"}
            >
              {searchOpen ? <X className="h-4 w-4" /> : <Search className="h-4 w-4" />}
            </Button>

            {isAuthenticated && (
              <Button
                size="sm"
                onClick={() => navigate("/create")}
                className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-soft transition-all duration-200 hover:shadow-card-hover active:scale-[0.98]"
              >
                <PenLine className="h-4 w-4 mr-1.5" />
                发布
              </Button>
            )}

            {renderAvatar()}
          </div>
        </div>

        {/* Mobile Layout */}
        <div className="flex md:hidden h-16 items-center justify-between gap-2">
          {/* Left - Hamburger */}
          <button
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors focus-visible:ring-2 focus-visible:ring-ring shrink-0"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-expanded={mobileMenuOpen}
            aria-label={mobileMenuOpen ? "关闭菜单" : "打开菜单"}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          {/* Center - Logo (fades out when search is open) */}
          <div
            className={`flex-1 flex justify-center min-w-0 transition-opacity duration-300 ${
              searchOpen ? "opacity-0 pointer-events-none" : "opacity-100"
            }`}
          >
            <Link
              to="/"
              className="flex items-center gap-2 text-lg font-bold text-foreground transition-colors hover:opacity-80 focus-visible:rounded-lg truncate"
            >
              <Cloud className="h-5 w-5 text-primary shrink-0" />
              <span className="truncate">天象志</span>
            </Link>
          </div>

          {/* Right - search expands from button to the left, then avatar */}
          <div className="flex items-center gap-1 shrink-0">
            {mobileSearchInput}

            <button
              onClick={searchOpen ? closeSearch : () => setSearchOpen(true)}
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={searchOpen ? "取消搜索" : "搜索"}
            >
              {searchOpen ? <X className="h-5 w-5" /> : <Search className="h-5 w-5" />}
            </button>

            {renderAvatar()}
          </div>
        </div>
      </div>

      {/* Mobile Menu Panel — slides in from top-left */}
      {mobileMenuOpen && (
        <div
          className="md:hidden fixed top-16 left-0 z-50 w-72 max-w-[85vw] bg-background/95 backdrop-blur-xl border-r border-border shadow-elevated animate-slide-in-left"
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
