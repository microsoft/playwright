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
import { ToolbarButton } from './toolbarButton';

export interface DialogProps {
  className?: string;
  style?: React.CSSProperties;
  open: boolean;
  isModal?: boolean;
  width?: number;
  verticalOffset?: number;
  requestClose?: () => void;
  anchor?: React.RefObject<HTMLElement>;
  dataTestId?: string;
}

export const Dialog: React.FC<React.PropsWithChildren<DialogProps>> = ({
  className,
  style: externalStyle,
  open,
  isModal,
  width,
  verticalOffset,
  requestClose,
  anchor,
  dataTestId,
  children,
}) => {
  const dialogRef = React.useRef<HTMLDialogElement>(null);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_, setRecalculateDimensionsCount] = React.useState(0);

  let style: React.CSSProperties | undefined = externalStyle;

  if (anchor?.current) {
    const bounds = anchor.current.getBoundingClientRect();

    style = {
      position: 'fixed',
      margin: 0,
      top: bounds.bottom + (verticalOffset ?? 0),
      left: buildTopLeftCoord(bounds, width ?? 0),
      width,
      zIndex: 100,
      ...externalStyle
    };
  }

  React.useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!dialogRef.current || !(event.target instanceof Node))
        return;

      if (!dialogRef.current.contains(event.target))
        requestClose?.();
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

  React.useLayoutEffect(() => {
    if (!dialogRef.current)
      return;

    if (open) {
      if (isModal)
        dialogRef.current.showModal();
      else
        dialogRef.current.show();
    } else {
      dialogRef.current.close();
    }
  }, [open, isModal]);

  return (
    <dialog ref={dialogRef} style={style} className={className} data-testid={dataTestId}>
      {children}
    </dialog>
  );
};

const buildTopLeftCoord = (bounds: DOMRect, width: number): number => {
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
      inBounds: value + width <= maxLeft,
    };
  } else {
    const value = bounds.right - width;

    return {
      value,
      inBounds: bounds.right - width >= 0,
    };
  }
};

export interface DialogToolbarButtonProps {
  title?: string;
  icon?: string;
  dialogDataTestId?: string;
}

export const DialogToolbarButton: React.FC<React.PropsWithChildren<DialogToolbarButtonProps>> = ({ title, icon, dialogDataTestId, children }) => {
  const hostingRef = React.useRef<HTMLButtonElement>(null);
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <ToolbarButton
        ref={hostingRef}
        icon={icon}
        title={title}
        onClick={() => setOpen(current => !current)}
      />
      <Dialog
        style={{
          backgroundColor: 'var(--vscode-sideBar-background)',
          padding: '4px 8px'
        }}
        open={open}
        width={200}
        // TODO: Temporary spacing until design of toolbar buttons is revisited
        verticalOffset={8}
        requestClose={() => setOpen(false)}
        anchor={hostingRef}
        dataTestId={dialogDataTestId}
      >
        {children}
      </Dialog>
    </>
  );
};
