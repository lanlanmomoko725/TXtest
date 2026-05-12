import { Link, useNavigate } from "react-router";
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
  Home,
  ImageIcon,
  CalendarDays,
  Clock,
  Library,
  Info,
} from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";

export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);

  const closeMenu = useCallback(() => {
    setMobileMenuOpen(false);
  }, []);

  // Close on click outside (event passes through to clicked element)
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

  // Close on touchmove (swipe gesture) outside the navbar
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const handleTouchMove = (e: TouchEvent) => {
      const target = e.target as Node;
      // Only close if touch is outside the navbar (including menu panel)
      if (navRef.current && !navRef.current.contains(target)) {
        closeMenu();
      }
    };
    document.addEventListener("touchmove", handleTouchMove, { passive: true });
    return () => document.removeEventListener("touchmove", handleTouchMove);
  }, [mobileMenuOpen, closeMenu]);

  // Close on browser back gesture (Android back button / iOS swipe-back)
  useEffect(() => {
    if (!mobileMenuOpen) return;
    // Push a dummy state so back button closes menu instead of navigating away
    window.history.pushState({ menuOpen: true }, "");

    const handlePopState = (e: PopStateEvent) => {
      if (e.state?.menuOpen) {
        closeMenu();
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
      // If menu is still in history state, pop it
      if (window.history.state?.menuOpen) {
        window.history.back();
      }
    };
  }, [mobileMenuOpen, closeMenu]);

  return (
    <nav ref={navRef} className="sticky top-0 z-50 w-full border-b bg-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 text-xl font-bold text-slate-900">
            <Cloud className="h-6 w-6 text-sky-600" />
            <span>天象志</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-6">
            <Link to="/" className="text-sm font-medium text-slate-700 hover:text-sky-600 transition-colors">
              首页
            </Link>

            <Link
              to="/sky-events"
              className="flex items-center gap-1 text-sm font-medium text-slate-700 hover:text-sky-600 transition-colors"
            >
              <Clock className="h-4 w-4" />
              实时天象
            </Link>

            <Link
              to="/sky-gallery"
              className="flex items-center gap-1 text-sm font-medium text-slate-700 hover:text-purple-600 transition-colors"
            >
              <Library className="h-4 w-4" />
              天空图鉴
            </Link>

            <Link
              to="/weekly-sky"
              className="flex items-center gap-1 text-sm font-medium text-slate-700 hover:text-sky-600 transition-colors"
            >
              <CalendarDays className="h-4 w-4" />
              每周天象
            </Link>

            <Link
              to="/sky-explanation"
              className="flex items-center gap-1 text-sm font-medium text-slate-700 hover:text-sky-600 transition-colors"
            >
              <ImageIcon className="h-4 w-4" />
              天象解说图
            </Link>

            <Link
              to="/about"
              className="flex items-center gap-1 text-sm font-medium text-slate-700 hover:text-sky-600 transition-colors"
            >
              <Info className="h-4 w-4" />
              关于我们
            </Link>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3">
            {isAuthenticated && (
              <Button
                size="sm"
                onClick={() => navigate("/create")}
                className="hidden md:flex bg-sky-600 hover:bg-sky-700"
              >
                <PenLine className="h-4 w-4 mr-1" />
                发布
              </Button>
            )}

            {isAuthenticated && user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 outline-none">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={user.avatar || undefined} />
                      <AvatarFallback className="bg-sky-100 text-sky-700 text-xs">
                        {(user.name || "用户").slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="hidden md:inline text-sm font-medium text-slate-700">
                      {user.name || "用户"}
                    </span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => navigate(`/profile/${user.id}`)} className="cursor-pointer">
                    <User className="h-4 w-4 mr-2" />
                    个人主页
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/create")} className="cursor-pointer md:hidden">
                    <PenLine className="h-4 w-4 mr-2" />
                    发布
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={logout} className="cursor-pointer text-red-600">
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
                className="border-sky-600 text-sky-600 hover:bg-sky-50"
              >
                登录
              </Button>
            )}

            {/* Mobile menu button */}
            <button
              className="md:hidden p-2 text-slate-700"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu —— absolute dropdown overlay below navbar */}
      {mobileMenuOpen && (
        <div className="md:hidden absolute top-full left-0 right-0 z-50 animate-in slide-in-from-top-2 fade-in duration-200">
          <div className="bg-white shadow-xl border-b rounded-b-2xl mx-2 overscroll-contain">
            <div className="px-4 py-3 space-y-1">
              <Link
                to="/"
                className="flex items-center gap-2 py-2 text-sm font-medium text-slate-700"
                onClick={closeMenu}
              >
                <Home className="h-4 w-4" />
                首页
              </Link>

              <Link
                to="/sky-events"
                className="flex items-center gap-2 py-2 text-sm font-medium text-slate-700"
                onClick={() => { sessionStorage.setItem("sidebar_auto_open", "1"); closeMenu(); }}
              >
                <Clock className="h-4 w-4 text-sky-600" />
                实时天象
              </Link>

              <Link
                to="/sky-gallery"
                className="flex items-center gap-2 py-2 text-sm font-medium text-slate-700"
                onClick={() => { sessionStorage.setItem("sidebar_auto_open", "1"); closeMenu(); }}
              >
                <Library className="h-4 w-4 text-purple-600" />
                天空图鉴
              </Link>

              <Link
                to="/weekly-sky"
                className="flex items-center gap-2 py-2 text-sm font-medium text-slate-700"
                onClick={closeMenu}
              >
                <CalendarDays className="h-4 w-4 text-sky-600" />
                每周天象
              </Link>

              <Link
                to="/sky-explanation"
                className="flex items-center gap-2 py-2 text-sm font-medium text-slate-700"
                onClick={closeMenu}
              >
                <ImageIcon className="h-4 w-4 text-sky-600" />
                天象解说图
              </Link>

              <Link
                to="/about"
                className="flex items-center gap-2 py-2 text-sm font-medium text-slate-700"
                onClick={closeMenu}
              >
                <Info className="h-4 w-4 text-sky-600" />
                关于我们
              </Link>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
