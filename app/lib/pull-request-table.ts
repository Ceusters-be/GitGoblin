import type { PullRequest } from "./types";

export const prColumns = [
  ["title", "Pull request"], ["author", "Created by"], ["source", "Source branch"],
  ["target", "Target branch"], ["createdAt", "Created"],
] as const;
export type PrColumn = typeof prColumns[number][0];
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

export function compareRequests(a: PullRequest, b: PullRequest, column: PrColumn, ascending: boolean) {
  let order: number;
  if (column === "createdAt") {
    const left = Date.parse(a.createdAt ?? "");
    const right = Date.parse(b.createdAt ?? "");
    if (!Number.isFinite(left) || !Number.isFinite(right))
      return Number(!Number.isFinite(left)) - Number(!Number.isFinite(right));
    order = left - right;
  } else {
    order = collator.compare(a[column], b[column]);
  }
  return ascending ? order : -order;
}

export function creationAge(value: string, today = new Date()) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Unknown";
  const day = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  const days = (day(today) - day(date)) / 86_400_000;
  if (days < 0) return date.toLocaleDateString();
  if (days === 0) return "Today";
  return days === 1 ? "Yesterday" : days + " days ago";
}

export function authorColor(name: string) {
  const colors = ["#345b98", "#795093", "#226a65", "#86512e", "#864561", "#4a6338"];
  let hash = 0;
  for (const char of name) hash = (Math.imul(hash, 31) + char.charCodeAt(0)) >>> 0;
  return colors[hash % colors.length];
}
