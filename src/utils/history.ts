import { HistoryItem } from '../types';

export function createSnapshot(item: HistoryItem): HistoryItem {
  return {
    placement: { ...item.placement },
    background: { ...item.background },
    typography: { ...item.typography },
    badges: item.badges.map((b) => ({ ...b })),
    badgesPosition: item.badgesPosition ? { ...item.badgesPosition } : undefined,
    promoBadge: { ...item.promoBadge },
    floatingElements: item.floatingElements.map((f) => ({ ...f })),
    aspectRatio: item.aspectRatio,
    layers: item.layers ? item.layers.map((l) => ({ ...l })) : undefined,
    brandWatermark: item.brandWatermark ? { ...item.brandWatermark } : undefined,
  };
}

export function pushUndoPast(
  past: HistoryItem[],
  snapshot: HistoryItem,
  maxItems = 30
): HistoryItem[] {
  const next = [...past, createSnapshot(snapshot)];
  return next.length > maxItems ? next.slice(next.length - maxItems) : next;
}

export function applyUndo(
  past: HistoryItem[],
  future: HistoryItem[],
  current: HistoryItem
): {
  nextPast: HistoryItem[];
  nextFuture: HistoryItem[];
  restored: HistoryItem | null;
} {
  if (past.length === 0) {
    return { nextPast: past, nextFuture: future, restored: null };
  }
  const restored = past[past.length - 1];
  return {
    nextPast: past.slice(0, -1),
    nextFuture: [createSnapshot(current), ...future],
    restored: createSnapshot(restored),
  };
}

export function applyRedo(
  past: HistoryItem[],
  future: HistoryItem[],
  current: HistoryItem
): {
  nextPast: HistoryItem[];
  nextFuture: HistoryItem[];
  restored: HistoryItem | null;
} {
  if (future.length === 0) {
    return { nextPast: past, nextFuture: future, restored: null };
  }
  const restored = future[0];
  return {
    nextPast: [...past, createSnapshot(current)],
    nextFuture: future.slice(1),
    restored: createSnapshot(restored),
  };
}
