import { useId } from "react";
import type { BuddyAnimationState } from "@/shared/types";
import "./Buddy.css";

const LABEL: Record<BuddyAnimationState, string> = {
  idle: "Plover is resting",
  working: "Plover is working with you",
  focus: "Plover is focusing",
  break: "Plover is on a break",
  nudging: "Plover has something for you",
  celebrating: "Plover is celebrating",
};

export function Buddy({
  state,
  onClick,
}: {
  state: BuddyAnimationState;
  onClick?: () => void;
}) {
  const clipId = `plover-buddy-${useId().replace(/:/g, "")}`;
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
        <defs>
          <clipPath id={clipId}>
            <circle cx="128" cy="142" r="100" />
          </clipPath>
        </defs>
        <ellipse
          className="plover-buddy__shadow"
          cx="128"
          cy="256"
          rx="70"
          ry="9"
          fill="#2F4236"
          opacity={0.12}
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
              fill="#E3B55B"
            />
            <path
              d="M40 40 L43 48 L51 51 L43 54 L40 62 L37 54 L29 51 L37 48 Z"
              fill="#E3B55B"
            />
          </g>
        </g>
        <g className="plover-buddy__body">
          <ellipse cx="108" cy="244" rx="11" ry="6" fill="#E3B55B" />
          <ellipse cx="148" cy="244" rx="11" ry="6" fill="#E3B55B" />
          <g className="plover-buddy__headg">
            <circle cx="128" cy="142" r="100" fill="#F3EEE1" />
            <path
              clipPath={`url(#${clipId})`}
              d="M0 0 H256 V70 Q96 88 0 54 Z"
              fill="#D9CFB4"
            />
            <circle
              cx="128"
              cy="142"
              r="100"
              fill="none"
              stroke="#DCD2BB"
              strokeWidth={4}
            />
            <g className="plover-buddy__face">
              <g className="plover-buddy__e-pill">
                <g transform="translate(80 124) scale(0.8 1) translate(-80 -124)">
                  <rect
                    x="73.5"
                    y="111"
                    width="13"
                    height="23"
                    rx="6.5"
                    fill="#2F4236"
                  />
                </g>
                <g transform="translate(144 124) scale(1 1) translate(-144 -124)">
                  <rect
                    x="137.5"
                    y="111"
                    width="13"
                    height="23"
                    rx="6.5"
                    fill="#2F4236"
                  />
                </g>
              </g>
              <g className="plover-buddy__e-arc">
                <g transform="translate(80 124) scale(0.8 1) translate(-80 -124)">
                  <path
                    d="M69 120 Q80 132 91 120"
                    fill="none"
                    stroke="#2F4236"
                    strokeWidth={7}
                    strokeLinecap="round"
                  />
                </g>
                <g transform="translate(144 124) scale(1 1) translate(-144 -124)">
                  <path
                    d="M133 120 Q144 132 155 120"
                    fill="none"
                    stroke="#2F4236"
                    strokeWidth={7}
                    strokeLinecap="round"
                  />
                </g>
              </g>
              <g className="plover-buddy__e-happy">
                <g transform="translate(80 124) scale(0.8 1) translate(-80 -124)">
                  <path
                    d="M69 128 Q80 115 91 128"
                    fill="none"
                    stroke="#2F4236"
                    strokeWidth={7}
                    strokeLinecap="round"
                  />
                </g>
                <g transform="translate(144 124) scale(1 1) translate(-144 -124)">
                  <path
                    d="M133 128 Q144 115 155 128"
                    fill="none"
                    stroke="#2F4236"
                    strokeWidth={7}
                    strokeLinecap="round"
                  />
                </g>
              </g>
              <path
                d="M96 146 H130 L106 171 Z"
                fill="#E3B55B"
                stroke="#E3B55B"
                strokeWidth={8}
                strokeLinejoin="round"
              />
            </g>
          </g>
          <path
            className="plover-buddy__wing plover-buddy__wl"
            style={{ transformOrigin: "46px 202px" }}
            d="M28 200 C20 174 22 150 36 126 C52 144 62 170 62 198 Q46 212 28 200 Z"
            fill="#D9CFB4"
            stroke="#C9BD9F"
            strokeWidth={3}
            strokeLinejoin="round"
          />
          <path
            className="plover-buddy__wing plover-buddy__wr"
            style={{ transformOrigin: "210px 202px" }}
            d="M228 200 C236 174 234 150 220 126 C204 144 194 170 194 198 Q210 212 228 200 Z"
            fill="#D9CFB4"
            stroke="#C9BD9F"
            strokeWidth={3}
            strokeLinejoin="round"
          />
        </g>
      </svg>
    </div>
  );
}
