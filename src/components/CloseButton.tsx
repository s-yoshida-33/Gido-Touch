import React from "react";

interface CloseButtonProps {
  onClick?: (e?: React.MouseEvent<HTMLButtonElement>) => void;
  onMouseDown?: () => void;
  onMouseUp?: () => void;
  onMouseLeave?: () => void;
  onTouchStart?: () => void;
  onTouchEnd?: () => void;
  onTouchCancel?: () => void;
  isPressed?: boolean;
  style?: React.CSSProperties;
  className?: string;
}

export const CloseButton: React.FC<CloseButtonProps> = ({
  onClick,
  onMouseDown,
  onMouseUp,
  onMouseLeave,
  onTouchStart,
  onTouchEnd,
  onTouchCancel,
  isPressed = false,
  style,
  className,
}) => {
  const buttonStyle: React.CSSProperties = {
    position: "relative",
    width: style?.width || "50px",
    height: style?.height || "50px",
    borderRadius: "50%",
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    border: "none",
    cursor: "pointer",
    padding: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "background-color 0.1s ease-in-out",
    ...style,
  };

  const highlightStyle: React.CSSProperties = {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    borderRadius: "50%",
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    opacity: isPressed ? 1 : 0,
    transition: "opacity 0.1s ease-in-out",
    pointerEvents: "none",
  };

  const xMarkPath =
    "M31.7257 31.7257C31.5742 31.8772 31.3286 31.8772 31.1772 31.7257L18.2743 18.8228C18.1228 18.6713 18.1228 18.4258 18.2743 18.2743C18.4258 18.1228 18.6713 18.1228 18.8228 18.2743L31.7257 31.1772C31.8772 31.3287 31.8772 31.5742 31.7257 31.7257ZM18.8228 31.7257C18.6713 31.8772 18.4258 31.8772 18.2743 31.7257C18.1228 31.5742 18.1228 31.3287 18.2743 31.1772L31.1772 18.2743C31.3286 18.1228 31.5742 18.1228 31.7257 18.2743C31.8772 18.4258 31.8772 18.6713 31.7257 18.8228L18.8228 31.7257Z";

  return (
    <button
      className={className}
      style={buttonStyle}
      onClick={onClick}
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseLeave}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchCancel}
      type="button"
    >
      <div style={highlightStyle} />
      <svg
        width="50"
        height="50"
        viewBox="0 0 50 50"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ position: "relative", zIndex: 1, width: "100%", height: "100%" }}
      >
        <path d={xMarkPath} fill="white" />
      </svg>
    </button>
  );
};
