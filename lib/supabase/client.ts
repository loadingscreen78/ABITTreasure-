"use client";
import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser client — ONLY for the organiser login form. Teams never load this module.
 * URL and publishable key are fetched at runtime from /api/organiser/config, so the build
 * needs no env and nothing secret is ever inlined.
 */
export function browserClient(url: string, publishableKey: string) {
  return createBrowserClient(url, publishableKey);
}
