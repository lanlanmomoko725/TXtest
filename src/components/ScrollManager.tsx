import { useEffect, useRef } from "react";
import { useLocation } from "react-router";

const LIST_PAGE_PREFIXES = [
  "/",
  "/category/",
  "/region/",
  "/sky-events",
  "/sky-gallery",
  "/sky-explanation",
  "/featured",
  "/tag/",
];

function isListPage(path: string): boolean {
  if (path === "/") return true;
  return LIST_PAGE_PREFIXES.some((p) => p !== "/" && path.startsWith(p));
}

function isTopPage(path: string): boolean {
  if (path.startsWith("/post/")) return true;
  if (path.startsWith("/profile/")) return true;
  if (path === "/create") return true;
  if (path === "/login") return true;
  if (path === "/register") return true;
  if (path === "/weekly-sky") return true;
  if (path === "/about") return true;
  return false;
}

export default function ScrollManager() {
  const { pathname } = useLocation();
  const prevPathRef = useRef(pathname);
  const scrollYRef = useRef(0);

  // Track current scroll position
  useEffect(() => {
    const handleScroll = () => {
      scrollYRef.current = window.scrollY;
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Handle route change scroll behavior
  useEffect(() => {
    const prevPath = prevPathRef.current;
    prevPathRef.current = pathname;

    const wasListPage = isListPage(prevPath);
    const isListPageNow = isListPage(pathname);
    const isTopPageNow = isTopPage(pathname);

    // Disable smooth scrolling for programmatic position adjustments
    const html = document.documentElement;
    const originalBehavior = html.style.scrollBehavior;
    html.style.scrollBehavior = "auto";

    if (wasListPage && isTopPageNow) {
      // List page -> detail/create/profile/auth: save list position, scroll to top
      sessionStorage.setItem(`scroll:${prevPath}`, String(scrollYRef.current));
      window.scrollTo(0, 0);
    } else if (isTopPageNow) {
      // Any other -> top page: scroll to top
      window.scrollTo(0, 0);
    } else if (isListPageNow) {
      // Any page -> list page: restore saved position if available
      const saved = sessionStorage.getItem(`scroll:${pathname}`);
      if (saved) {
        window.scrollTo(0, parseInt(saved, 10));
        sessionStorage.removeItem(`scroll:${pathname}`);
      } else {
        window.scrollTo(0, 0);
      }
    }

    // Restore smooth scrolling after the current frame
    requestAnimationFrame(() => {
      html.style.scrollBehavior = originalBehavior;
    });
  }, [pathname]);

  return null;
}
