"use client";

import { useSyncExternalStore } from "react";

function subscribe(cb: () => void) {
  window.addEventListener("hashchange", cb);
  window.addEventListener("popstate", cb);
  return () => {
    window.removeEventListener("hashchange", cb);
    window.removeEventListener("popstate", cb);
  };
}

/** Reads a parameter from the URL fragment (#t=…) or query without hydration mismatches. Null on the server. */
export function useUrlParam(name: string, where: "hash" | "query", pattern: RegExp): string | null {
  return useSyncExternalStore(
    subscribe,
    () => {
      const raw = where === "hash" ? window.location.hash.slice(1) : window.location.search;
      const v = new URLSearchParams(raw).get(name);
      return v && pattern.test(v) ? v : null;
    },
    () => null,
  );
}

export const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;
