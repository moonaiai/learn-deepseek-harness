import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Learn DeepSeek Harness",
  description: "深入 DeepSeek Harness 内部架构的双语课程",
};

/** Bare root layout — locale-specific `<html lang>`, theme boot script, and
 * chrome (Header/Sidebar) live in `app/[locale]/layout.tsx`. This file only
 * needs to exist because Next's App Router requires exactly one root layout
 * per app, and metadata/globals.css must be declared somewhere above it. */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
