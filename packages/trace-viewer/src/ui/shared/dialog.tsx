/*
  Copyright (c) Microsoft Corporation.

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

      http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/

import * as React from 'react';

export interface DialogProps {
  className?: string;

  open: boolean;
  width: number;

  requestClose?: () => void;

  hostingElement?: React.RefObject<HTMLElement>;
}

export const Dialog: React.FC<React.PropsWithChildren<DialogProps>> = ({
  className,
  open,
  width,
  requestClose,
  hostingElement,
  children,
}) => {
  const dialogRef = React.useRef<HTMLDialogElement>(null);

  // Allow window dimension changes to force a rerender
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_, setRecalculateDimensionsCount] = React.useState(0);

  let style: React.CSSProperties | undefined = undefined;

  if (hostingElement?.current) {
    // For now, always place dialog below hosting element
    const bounds = hostingElement.current.getBoundingClientRect();

    style = {
      // Override default `<dialog>` positioning
      margin: 0,
      top: bounds.bottom,
      left: buildTopLeftCoord(bounds, width),
      width,
      // For some reason the dialog is placed behind the timeline, but there's a stacking context that allows the dialog to be placed above
      zIndex: 1,
    };
  }

  React.useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!dialogRef.current || !(event.target instanceof Node))
        return;

      if (!dialogRef.current.contains(event.target)) {
        // Click outside of dialog bounds
        requestClose?.();
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape')
        requestClose?.();
    };

    if (open) {
      document.addEventListener('mousedown', onClick);
      document.addEventListener('keydown', onKeyDown);

      return () => {
        document.removeEventListener('mousedown', onClick);
        document.removeEventListener('keydown', onKeyDown);
      };
    }

    return () => {};
  }, [open, requestClose]);

  React.useEffect(() => {
    const onResize = () => setRecalculateDimensionsCount(count => count + 1);

    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return (
    open && (
      <dialog ref={dialogRef} style={style} className={className} open>
        {children}
      </dialog>
    )
  );
};

const buildTopLeftCoord = (bounds: DOMRect, width: number): number => {
  // Default to left aligned
  const leftAlignCoord = buildTopLeftCoordWithAlignment(bounds, width, 'left');

  if (leftAlignCoord.inBounds)
    return leftAlignCoord.value;

  const rightAlignCoord = buildTopLeftCoordWithAlignment(
      bounds,
      width,
      'right'
  );

  if (rightAlignCoord.inBounds)
    return rightAlignCoord.value;

  // Fallback to left align, even if it will go off screen
  return leftAlignCoord.value;
};

const buildTopLeftCoordWithAlignment = (
  bounds: DOMRect,
  width: number,
  alignment: 'left' | 'right'
): {
  value: number;
  inBounds: boolean;
} => {
  const maxLeft = document.documentElement.clientWidth;

  if (alignment === 'left') {
    const value = bounds.left;

    return {
      value,
      // Would extend off of right side of screen
      inBounds: value + width <= maxLeft,
    };
  } else {
    const value = bounds.right - width;

    return {
      value,
      // Would extend off of left side of screen
      inBounds: bounds.right - width >= 0,
    };
  }
};
