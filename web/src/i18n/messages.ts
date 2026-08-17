import zh from "./messages/zh.json";
import en from "./messages/en.json";
import type { Locale } from "@/lib/types";

export const MESSAGES: Record<Locale, typeof zh> = { zh, en };

export type Messages = typeof zh;

/** Resolves a dot-path (e.g. "chapter.prev") against a messages object, used
 * identically by the client hook and the server helper below so both
 * resolve missing keys the same way (fall back to the path itself). */
export function resolveKey(messages: Messages, key: string): string {
  const parts = key.split(".");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- traversing an arbitrary-depth JSON tree
  let node: any = messages;
  for (const part of parts) {
    if (node == null || typeof node !== "object") return key;
    node = node[part];
  }
  return typeof node === "string" ? node : key;
}
