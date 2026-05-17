import { useLayoutEffect, useRef } from "react";
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

  // Track current scroll position continuously
  useLayoutEffect(() => {
    const handleScroll = () => {
      scrollYRef.current = window.scrollY;
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Handle route change scroll behavior synchronously before paint
  useLayoutEffect(() => {
    const prevPath = prevPathRef.current;
    prevPathRef.current = pathname;

    const wasListPage = isListPage(prevPath);
    const isListPageNow = isListPage(pathname);
    const isTopPageNow = isTopPage(pathname);

    // Always force scroll to top immediately on route change.
    // This prevents the browser from inheriting the previous page's scroll position.
    window.scrollTo(0, 0);

    if (wasListPage && isTopPageNow) {
      // List page -> detail/create/profile/auth: save list position
      sessionStorage.setItem(`scroll:${prevPath}`, String(scrollYRef.current));
    } else if (isListPageNow) {
      // Any page -> list page: restore saved position if available
      const saved = sessionStorage.getItem(`scroll:${pathname}`);
      if (saved) {
        // Use rAF to ensure the DOM has settled before restoring
        requestAnimationFrame(() => {
          window.scrollTo(0, parseInt(saved, 10));
        });
        sessionStorage.removeItem(`scroll:${pathname}`);
      }
    }
  }, [pathname]);

  return null;
}
