import type { BuddyAnimationState } from "@/shared/types";
import "./Buddy.css";

export function Buddy({
  state,
  onClick,
}: {
  state: BuddyAnimationState;
  onClick?: () => void;
}) {
  return (
    <div className={"plover-buddy plover-buddy--" + state} onClick={onClick} />
  );
}
