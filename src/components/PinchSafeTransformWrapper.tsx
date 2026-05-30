// src/components/PinchSafeTransformWrapper.tsx
import React from 'react';
import { TransformWrapper } from 'react-zoom-pan-pinch';

type Props = React.ComponentProps<typeof TransformWrapper>;

// Intercepts pinch touch events in the capture phase before react-zoom-pan-pinch
// sees them. When two fingers land at the same pixel (distance < 1px), the
// touchstart is stopped — preventing "Pinch touches distance was not provided".
const PinchSafeTransformWrapper: React.FC<Props> = (props) => {
  const handleTouchStartCapture = (e: React.TouchEvent) => {
    if (e.touches.length >= 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      if (Math.sqrt(dx * dx + dy * dy) < 1) {
        e.stopPropagation();
      }
    }
  };

  return (
    <div onTouchStartCapture={handleTouchStartCapture} style={{ display: 'contents' }}>
      <TransformWrapper {...props} />
    </div>
  );
};

export { PinchSafeTransformWrapper };
