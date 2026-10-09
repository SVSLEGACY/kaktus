import { useMemo } from "react";
import { useRouter as useTsRouter, useRouterState } from "@tanstack/react-router";

// Stand-ins for next/navigation hooks used by the original kaktus pages.
export function useRouter() {
  const router = useTsRouter();
  return useMemo(
    () => ({
      push: (href: string) => router.history.push(href),
      replace: (href: string) => router.history.replace(href),
      back: () => router.history.back(),
      refresh: () => router.invalidate(),
    }),
    [router],
  );
}

export function usePathname() {
  return useRouterState({ select: (s) => s.location.pathname });
}

export function useSearchParams() {
  const search = useRouterState({ select: (s) => s.location.searchStr });
  return useMemo(() => new URLSearchParams(search), [search]);
}
