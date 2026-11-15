import type { BuddySize } from "@/shared/types";

export const BUDDY_DIMENSIONS: Record<
  BuddySize,
  { width: number; height: number }
> = {
  small: { width: 48, height: 53 },
  medium: { width: 64, height: 70 },
  large: { width: 88, height: 96 },
};

export function panelOffset(
  size: BuddySize,
  margin: number,
  gap: number,
  menuHeight: number,
): number {
  return margin + BUDDY_DIMENSIONS[size].height + gap + menuHeight + gap;
}
