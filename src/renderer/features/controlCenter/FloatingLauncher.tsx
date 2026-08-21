import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { ControlCenterState, FloatingPosition } from '@shared/types';
import { t } from '../../i18n';

interface DragState {
  pointerId: number;
  moved: boolean;
  started: boolean;
}

export default function FloatingLauncher() {
  const shell = window.rookiedsh?.shell;
  const [controlCenterState, setControlCenterState] = useState<ControlCenterState>('CLOSED');
  const dragRef = useRef<DragState | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!shell) return;
    let disposed = false;
    const unsubscribe = shell.onControlCenterStateChanged((state) => {
      if (!disposed) setControlCenterState(state);
    });
    void shell.getControlCenterState().then((state) => {
      if (!disposed) setControlCenterState(state);
    });
    return () => {
      disposed = true;
      unsubscribe();
    };
  }, [shell]);

  function handlePointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { pointerId: event.pointerId, moved: false, started: false };
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (Math.abs(event.movementX) > 1 || Math.abs(event.movementY) > 1) drag.moved = true;
    if (drag.moved && !drag.started) {
      drag.started = true;
      shell?.beginFloatingDrag();
    }
  }

  function handlePointerEnd(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (buttonRef.current?.hasPointerCapture(event.pointerId)) {
      buttonRef.current.releasePointerCapture(event.pointerId);
    }
    dragRef.current = null;

    if (drag.started) {
      shell?.endFloatingDrag();
      void shell?.getFloatingPosition().then((position: FloatingPosition) => {
        try {
          localStorage.setItem('rookiedsh.floatingActionButton.position', JSON.stringify(position));
        } catch {
          // Best effort persistence for the floating control position.
        }
      });
    } else {
      shell?.toggleControlCenter();
    }
  }

  const active = controlCenterState === 'OPEN';
  return (
    <button
      ref={buttonRef}
      className={active ? 'floating-launcher active' : 'floating-launcher'}
      type="button"
      aria-label={t('controlCenter.title')}
      aria-pressed={active}
      title={t('controlCenter.title')}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          shell?.toggleControlCenter();
        }
      }}
    >
      ⚙
    </button>
  );
}
