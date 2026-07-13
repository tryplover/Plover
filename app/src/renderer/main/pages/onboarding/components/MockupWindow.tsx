import React from 'react';

interface MockupWindowProps {
  children: React.ReactNode;
  brand?: string;
  showTitlebar?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export const MockupWindow: React.FC<MockupWindowProps> = ({
  children,
  brand = 'Plover',
  showTitlebar = true,
  className = '',
  style = {},
}) => {
  return (
    <div className={`plover-onboarding__mockup-window ${className}`} style={style}>
      {showTitlebar && (
        <div className="plover-onboarding__mockup-titlebar">
          <div className="plover-onboarding__mockup-dots">
            <span className="plover-onboarding__mockup-dot" />
            <span className="plover-onboarding__mockup-dot" />
            <span className="plover-onboarding__mockup-dot" />
          </div>
          <div className="plover-onboarding__mockup-brand">{brand.toUpperCase()}</div>
          <div className="plover-onboarding__mockup-right-dots">
            <span className="plover-onboarding__mockup-right-dot" />
            <span className="plover-onboarding__mockup-right-dot" />
            <span className="plover-onboarding__mockup-right-dot" />
          </div>
        </div>
      )}
      {children}
    </div>
  );
};
