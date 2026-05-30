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
  PenLine,
  User,
  LogOut,
  Menu,
  X,
  ImageIcon,
  CalendarDays,
  Clock,
  Library,
  Info,
  Search,
  ChevronDown,
  UsersRound,
  Handshake,
  Sparkles,
} from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { lockBodyScroll } from "@/lib/body-scroll-lock";

type NavChild = {
  to: string;
  label: string;
  icon: typeof Library;
  accent?: string;
};

type NavGroup = {
  id: "gallery" | "community" | "about";
  label: string;
  icon: typeof Library;
  items: NavChild[];
};

const navGroups: NavGroup[] = [
  {
    id: "gallery",
    label: "天象展馆",
    icon: Library,
    items: [
      { to: "/sky-gallery", label: "天空图鉴", icon: Library, accent: "text-purple-600" },
      { to: "/sky-explanation", label: "天象解说图", icon: ImageIcon },
      { to: "/weekly-sky", label: "每周一图", icon: CalendarDays },
    ],
  },
  {
    id: "community",
    label: "天象社区",
    icon: UsersRound,
    items: [
      { to: "/sky-events", label: "实时天象", icon: Clock },
      { to: "/activities", label: "组织活动", icon: Sparkles },
    ],
  },
  {
    id: "about",
    label: "关于我们",
    icon: Info,
    items: [
      { to: "/about", label: "我们是谁", icon: Info },
      { to: "/join-us", label: "加入我们", icon: Handshake },
    ],
  },
];

function groupIsActive(group: NavGroup, pathname: string) {
  return group.items.some((item) => item.to === pathname);
}

function LogoLink({ className = "" }: { className?: string }) {
  return (
    <Link
      to="/"
      className={`flex items-center gap-2 font-bold text-foreground transition-colors hover:opacity-80 focus-visible:rounded-lg ${className}`}
      aria-label="返回首页"
    >
      <img
        src="/logo.png"
        alt="天象志"
        width={36}
        height={36}
        className="h-9 w-9 rounded-full object-contain shrink-0"
      />
      <span>天象志</span>
    </Link>
  );
}

export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [openDesktopGroup, setOpenDesktopGroup] = useState<NavGroup["id"] | null>(null);
  const [openMobileGroups, setOpenMobileGroups] = useState<Record<NavGroup["id"], boolean>>({
    gallery: true,
    community: false,
    about: false,
  });
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

  const handleNavClick = useCallback((to: string) => {
    if (to === "/sky-events" || to === "/sky-gallery") {
      sessionStorage.setItem("sidebar_auto_open", "1");
    }
    closeMenu();
    setOpenDesktopGroup(null);
  }, [closeMenu]);

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

  useEffect(() => {
    if (searchOpen) {
      requestAnimationFrame(() => {
        const desktopInput = desktopInputRef.current;
        const mobileInput = mobileInputRef.current;
        if (desktopInput && desktopInput.offsetParent !== null) {
          desktopInput.focus();
        } else if (mobileInput && mobileInput.offsetParent !== null) {
          mobileInput.focus();
        }
      });
    }
  }, [searchOpen]);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 8);
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (!mobileMenuOpen && !searchOpen && !openDesktopGroup) return;
    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (navRef.current && !navRef.current.contains(target)) {
        if (mobileMenuOpen) closeMenu();
        if (searchOpen) closeSearch();
        setOpenDesktopGroup(null);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [mobileMenuOpen, searchOpen, openDesktopGroup, closeMenu, closeSearch]);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const handleScroll = () => closeMenu();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [mobileMenuOpen, closeMenu]);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    return lockBodyScroll();
  }, [mobileMenuOpen]);

  useEffect(() => {
    closeMenu();
    closeSearch();
    setOpenDesktopGroup(null);
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

  const desktopSearchInput = (
    <div className="hidden md:block w-48 lg:w-56">
      <div className="relative w-48 lg:w-56">
        <input
          ref={desktopInputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={handleSearchKeyDown}
          placeholder="搜索文章..."
          className="w-full rounded-full border border-border bg-background px-4 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary/50"
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
          className="w-full rounded-full border border-border bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary/50"
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

  const renderDesktopGroup = (group: NavGroup) => {
    const active = groupIsActive(group, location.pathname);
    const open = openDesktopGroup === group.id;
    const Icon = group.icon;
    return (
      <div
        key={group.id}
        className="relative"
        onMouseEnter={() => setOpenDesktopGroup(group.id)}
        onMouseLeave={() => setOpenDesktopGroup(null)}
      >
        <div
          className={`relative flex items-center rounded-lg text-sm font-medium transition-all duration-200 focus-within:ring-2 focus-within:ring-ring ${
            active ? "text-primary bg-primary/8" : "text-muted-foreground hover:text-foreground hover:bg-accent"
          }`}
        >
          <button
            type="button"
            onClick={() => setOpenDesktopGroup(open ? null : group.id)}
            className="flex items-center gap-1.5 rounded-l-lg px-3 py-2"
            aria-expanded={open}
            aria-haspopup="menu"
          >
            <Icon className="h-4 w-4" />
            <span>{group.label}</span>
          </button>
          <button
            type="button"
            onClick={() => setOpenDesktopGroup(open ? null : group.id)}
            className="rounded-r-lg px-2 py-2"
            aria-label={`${group.label}展开列表`}
            aria-expanded={open}
          >
            <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
          </button>
          {active && (
            <span className="absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 w-4 rounded-full bg-primary" />
          )}
        </div>
        {open && (
          <div
            className="absolute left-0 top-full z-50 mt-2 w-48 rounded-xl border border-border/70 bg-background/95 p-1.5 shadow-elevated backdrop-blur-xl animate-fade-in"
            role="menu"
          >
            {group.items.map((item) => {
              const ChildIcon = item.icon;
              const childActive = location.pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => handleNavClick(item.to)}
                  aria-current={childActive ? "page" : undefined}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring ${
                    childActive
                      ? "bg-primary/8 text-primary"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  }`}
                  role="menuitem"
                >
                  <ChildIcon className={`h-4 w-4 ${item.accent && !childActive ? item.accent : ""}`} />
                  {item.label}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    );
  };

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
        <div className="hidden md:flex h-16 items-center justify-between">
          <LogoLink className="text-xl shrink-0" />

          <div className="flex items-center gap-1 flex-shrink-0">
            {navGroups.map(renderDesktopGroup)}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {desktopSearchInput}
            <Button
              size="sm"
              variant="ghost"
              onClick={handleSearch}
              className="text-muted-foreground hover:text-foreground hover:bg-accent transition-all duration-200 active:scale-[0.98]"
              aria-label="搜索"
            >
              <Search className="h-4 w-4" />
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

        <div className="flex md:hidden h-16 items-center justify-between gap-2">
          <button
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors focus-visible:ring-2 focus-visible:ring-ring shrink-0"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-expanded={mobileMenuOpen}
            aria-label={mobileMenuOpen ? "关闭菜单" : "打开菜单"}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          <div
            className={`flex-1 flex justify-center min-w-0 transition-opacity duration-300 ${
              searchOpen ? "opacity-0 pointer-events-none" : "opacity-100"
            }`}
          >
            <LogoLink className="text-lg truncate" />
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {mobileSearchInput}
            <button
              onClick={searchOpen ? handleSearch : () => setSearchOpen(true)}
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="搜索"
            >
              <Search className="h-5 w-5" />
            </button>
            {renderAvatar()}
          </div>
        </div>
      </div>

      {mobileMenuOpen && (
        <div
          className="md:hidden fixed top-16 left-0 z-50 w-72 max-w-[85vw] bg-background/95 backdrop-blur-xl border-r border-border shadow-elevated animate-slide-in-left"
          style={{ height: "calc(100dvh - 4rem)", maxHeight: "calc(100dvh - 4rem)", overscrollBehavior: "contain" }}
        >
          <div className="flex flex-col p-4 gap-2 overflow-y-auto h-full scrollbar-thin">
            {navGroups.map((group) => {
              const open = openMobileGroups[group.id];
              const active = groupIsActive(group, location.pathname);
              const Icon = group.icon;
              return (
                <div key={group.id} className="rounded-xl border border-border/40 bg-background/70">
                  <button
                    type="button"
                    onClick={() =>
                      setOpenMobileGroups((prev) => ({ ...prev, [group.id]: !prev[group.id] }))
                    }
                    className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring ${
                      active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                    }`}
                    aria-expanded={open}
                  >
                    <span className="flex items-center gap-2">
                      <Icon className="h-4 w-4" />
                      {group.label}
                    </span>
                    <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
                  </button>
                  {open && (
                    <div className="px-2 pb-2">
                      {group.items.map((item) => {
                        const childActive = location.pathname === item.to;
                        const ChildIcon = item.icon;
                        return (
                          <Link
                            key={item.to}
                            to={item.to}
                            onClick={() => handleNavClick(item.to)}
                            aria-current={childActive ? "page" : undefined}
                            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring ${
                              childActive
                                ? "text-primary bg-primary/8"
                                : "text-muted-foreground hover:text-foreground hover:bg-accent"
                            }`}
                          >
                            <ChildIcon className={`h-4 w-4 ${item.accent && !childActive ? item.accent : ""}`} />
                            {item.label}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </nav>
  );
}
