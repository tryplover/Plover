import type { BuddyAnimationState } from "@/shared/types";
import "./Buddy.css";

const LABEL: Record<BuddyAnimationState, string> = {
  idle: "Plover is resting",
  working: "Plover is working with you",
  focus: "Plover is focusing",
  break: "Plover is on a break",
  nudging: "Plover has something for you",
  celebrating: "Plover is celebrating",
  inviting: "Plover wants to start with you",
};

const CREAM = "#F3EEE1";
const INK = "#2F4236";
const SAND = "#D9CFB4";
const AMBER = "#E3B55B";
const EDGE = { stroke: INK, strokeOpacity: 0.28, strokeWidth: 3 } as const;

export function Buddy({
  state,
  onClick,
}: {
  state: BuddyAnimationState;
  onClick?: () => void;
}) {
  return (
    <div
      className={"plover-buddy plover-buddy--" + state}
      onClick={onClick}
      role="img"
      aria-label={LABEL[state]}
      title={LABEL[state]}
    >
      <svg
        viewBox="0 0 256 280"
        width="100%"
        height="100%"
        aria-hidden="true"
        focusable="false"
      >
        <ellipse
          className="plover-buddy__shadow"
          cx="128"
          cy="256"
          rx="70"
          ry="9"
          fill={SAND}
          opacity={0.75}
        />
        <g className="plover-buddy__extras">
          <g className="plover-buddy__x-z">
            <path
              d="M196 34 H218 L196 60 H218"
              fill="none"
              stroke="#5E7F6B"
              strokeWidth={7}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
          <g className="plover-buddy__x-dots">
            <circle cx="180" cy="30" r="6" fill="#5E7F6B" opacity={0.45} />
            <circle cx="200" cy="30" r="6" fill="#5E7F6B" opacity={0.7} />
            <circle cx="220" cy="30" r="6" fill="#5E7F6B" opacity={1} />
          </g>
          <g className="plover-buddy__x-spark">
            <path
              d="M214 22 L219 36 L233 41 L219 46 L214 60 L209 46 L195 41 L209 36 Z"
              fill={AMBER}
            />
            <path
              d="M40 40 L43 48 L51 51 L43 54 L40 62 L37 54 L29 51 L37 48 Z"
              fill={AMBER}
            />
          </g>
        </g>
        <g className="plover-buddy__body">
          <ellipse cx="108" cy="244" rx="11" ry="6" fill={SAND} {...EDGE} />
          <ellipse cx="148" cy="244" rx="11" ry="6" fill={SAND} {...EDGE} />
          <g className="plover-buddy__wings" fill={SAND}>
            <g className="plover-buddy__wing plover-buddy__wl">
              <ellipse
                cx="25"
                cy="176"
                rx="18"
                ry="35"
                transform="rotate(22 25 176)"
                {...EDGE}
              />
            </g>
            <g className="plover-buddy__wing plover-buddy__wr">
              <ellipse
                cx="231"
                cy="176"
                rx="18"
                ry="35"
                transform="rotate(-22 231 176)"
                {...EDGE}
              />
            </g>
          </g>
          <g className="plover-buddy__headg">
            <circle
              cx="128"
              cy="142"
              r="100"
              fill={CREAM}
              stroke={SAND}
              strokeWidth={5}
            />
            <g className="plover-buddy__face">
              <g className="plover-buddy__e-pill">
                <rect
                  x="91.5"
                  y="111"
                  width="13"
                  height="23"
                  rx="6.5"
                  fill={INK}
                />
                <rect
                  x="151.5"
                  y="111"
                  width="13"
                  height="23"
                  rx="6.5"
                  fill={INK}
                />
              </g>
              <g className="plover-buddy__e-arc">
                <path
                  d="M87 120 Q98 132 109 120"
                  fill="none"
                  stroke={INK}
                  strokeWidth={7}
                  strokeLinecap="round"
                />
                <path
                  d="M147 120 Q158 132 169 120"
                  fill="none"
                  stroke={INK}
                  strokeWidth={7}
                  strokeLinecap="round"
                />
              </g>
              <g className="plover-buddy__e-happy">
                <path
                  d="M87 128 Q98 115 109 128"
                  fill="none"
                  stroke={INK}
                  strokeWidth={7}
                  strokeLinecap="round"
                />
                <path
                  d="M147 128 Q158 115 169 128"
                  fill="none"
                  stroke={INK}
                  strokeWidth={7}
                  strokeLinecap="round"
                />
              </g>
              <g className="plover-buddy__e-sleepy">
                <rect
                  x="91.5"
                  y="121"
                  width="13"
                  height="10"
                  rx="5"
                  fill={INK}
                />
                <rect
                  x="151.5"
                  y="121"
                  width="13"
                  height="10"
                  rx="5"
                  fill={INK}
                />
              </g>
              <path
                d="M113 146 H143 L128 168 Z"
                fill={AMBER}
                stroke={AMBER}
                strokeWidth={8}
                strokeLinejoin="round"
              />
            </g>
          </g>
        </g>
      </svg>
    </div>
  );
}
