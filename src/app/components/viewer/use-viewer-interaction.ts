'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export interface ViewerHit {
  dbId: number;
  worldPosition: { x: number; y: number; z: number };
}

interface UseViewerInteractionParams {
  viewer: Autodesk.Viewing.GuiViewer3D | null;
  viewerContainer: HTMLElement | null;
  dbIdFilter?: (dbId: number) => boolean;
  onQuickRegister?: (hit: ViewerHit) => void;
}

interface UseViewerInteractionResult {
  selectedElement: ViewerHit | null;
  clearSelection: () => void;
}

const SINGLE_CLICK_DEBOUNCE_MS = 200;
const LONG_PRESS_MS = 500;
const LONG_PRESS_MOVE_THRESHOLD_PX = 5;

export function useViewerInteraction({
  viewer,
  viewerContainer,
  dbIdFilter,
  onQuickRegister,
}: UseViewerInteractionParams): UseViewerInteractionResult {
  const [selectedElement, setSelectedElement] = useState<ViewerHit | null>(null);

  const dbIdFilterRef = useRef(dbIdFilter);
  const onQuickRegisterRef = useRef(onQuickRegister);
  const pendingSelectionTimerRef = useRef<number | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const pointerDownRef = useRef<{ clientX: number; clientY: number } | null>(
    null
  );
  const latestPointerRef = useRef<{ clientX: number; clientY: number } | null>(
    null
  );

  useEffect(() => {
    dbIdFilterRef.current = dbIdFilter;
  }, [dbIdFilter]);

  useEffect(() => {
    onQuickRegisterRef.current = onQuickRegister;
  }, [onQuickRegister]);

  const clearPendingSelection = useCallback(() => {
    if (pendingSelectionTimerRef.current !== null) {
      window.clearTimeout(pendingSelectionTimerRef.current);
      pendingSelectionTimerRef.current = null;
    }
  }, []);

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const performHitTest = useCallback(
    (clientX: number, clientY: number): ViewerHit | null => {
      if (!viewer || !viewerContainer) {
        return null;
      }

      const rect = viewerContainer.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;

      if (x < 0 || y < 0 || x > rect.width || y > rect.height) {
        return null;
      }

      const hit = viewer.impl.hitTest(x, y, true);
      if (!hit?.dbId) {
        return null;
      }

      if (dbIdFilterRef.current && !dbIdFilterRef.current(hit.dbId)) {
        return null;
      }

      if (hit.point) {
        return {
          dbId: hit.dbId,
          worldPosition: {
            x: hit.point.x,
            y: hit.point.y,
            z: hit.point.z,
          },
        };
      }

      const fallbackWorldPosition = getDbIdWorldPosition(viewer, hit.dbId);
      if (!fallbackWorldPosition) {
        return null;
      }

      return {
        dbId: hit.dbId,
        worldPosition: fallbackWorldPosition,
      };
    },
    [viewer, viewerContainer]
  );

  const clearSelection = useCallback(() => {
    clearPendingSelection();
    setSelectedElement(null);
  }, [clearPendingSelection]);

  useEffect(() => {
    if (!viewer || !viewerContainer) {
      clearPendingSelection();
      clearLongPressTimer();
      setSelectedElement(null);
      return;
    }

    const selectionEventName =
      (Autodesk.Viewing as any).SELECTION_CHANGED_EVENT ??
      Autodesk.Viewing.SELECTION_CHANGED ??
      'selection';

    const onSelectionChanged = (event: Autodesk.Viewing.SelectionChangeEvent) => {
      clearPendingSelection();

      const selectedDbId = event.dbIdArray?.[0];
      if (!selectedDbId) {
        setSelectedElement(null);
        return;
      }

      if (dbIdFilterRef.current && !dbIdFilterRef.current(selectedDbId)) {
        setSelectedElement(null);
        return;
      }

      pendingSelectionTimerRef.current = window.setTimeout(() => {
        pendingSelectionTimerRef.current = null;

        const latestPointer = latestPointerRef.current;
        const fromPointer = latestPointer
          ? performHitTest(latestPointer.clientX, latestPointer.clientY)
          : null;
        if (fromPointer && fromPointer.dbId === selectedDbId) {
          setSelectedElement(fromPointer);
          return;
        }

        const worldPosition = getDbIdWorldPosition(viewer, selectedDbId);
        if (!worldPosition) {
          setSelectedElement(null);
          return;
        }

        setSelectedElement({ dbId: selectedDbId, worldPosition });
      }, SINGLE_CLICK_DEBOUNCE_MS);
    };

    const onDoubleClick = (event: MouseEvent) => {
      clearPendingSelection();
      latestPointerRef.current = { clientX: event.clientX, clientY: event.clientY };

      const hit = performHitTest(event.clientX, event.clientY);
      if (!hit) {
        return;
      }

      setSelectedElement(null);
      onQuickRegisterRef.current?.(hit);
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) {
        return;
      }

      pointerDownRef.current = { clientX: event.clientX, clientY: event.clientY };
      latestPointerRef.current = { clientX: event.clientX, clientY: event.clientY };
      clearLongPressTimer();

      longPressTimerRef.current = window.setTimeout(() => {
        longPressTimerRef.current = null;
        if (!pointerDownRef.current) {
          return;
        }

        const hit = performHitTest(
          pointerDownRef.current.clientX,
          pointerDownRef.current.clientY
        );
        if (!hit) {
          return;
        }

        clearPendingSelection();
        setSelectedElement(null);
        onQuickRegisterRef.current?.(hit);
      }, LONG_PRESS_MS);
    };

    const onPointerMove = (event: PointerEvent) => {
      latestPointerRef.current = { clientX: event.clientX, clientY: event.clientY };

      if (!pointerDownRef.current) {
        return;
      }

      const dx = event.clientX - pointerDownRef.current.clientX;
      const dy = event.clientY - pointerDownRef.current.clientY;
      if (Math.hypot(dx, dy) > LONG_PRESS_MOVE_THRESHOLD_PX) {
        clearLongPressTimer();
      }
    };

    const onPointerUp = () => {
      pointerDownRef.current = null;
      clearLongPressTimer();
    };

    const onContextMenu = (event: MouseEvent) => {
      event.preventDefault();
    };

    viewer.addEventListener(selectionEventName, onSelectionChanged);
    viewerContainer.addEventListener('dblclick', onDoubleClick);
    viewerContainer.addEventListener('pointerdown', onPointerDown);
    viewerContainer.addEventListener('pointermove', onPointerMove);
    viewerContainer.addEventListener('pointerup', onPointerUp);
    viewerContainer.addEventListener('pointercancel', onPointerUp);
    viewerContainer.addEventListener('contextmenu', onContextMenu);

    return () => {
      clearPendingSelection();
      clearLongPressTimer();
      pointerDownRef.current = null;
      viewer.removeEventListener(selectionEventName, onSelectionChanged);
      viewerContainer.removeEventListener('dblclick', onDoubleClick);
      viewerContainer.removeEventListener('pointerdown', onPointerDown);
      viewerContainer.removeEventListener('pointermove', onPointerMove);
      viewerContainer.removeEventListener('pointerup', onPointerUp);
      viewerContainer.removeEventListener('pointercancel', onPointerUp);
      viewerContainer.removeEventListener('contextmenu', onContextMenu);
    };
  }, [
    clearLongPressTimer,
    clearPendingSelection,
    performHitTest,
    viewer,
    viewerContainer,
  ]);

  return { selectedElement, clearSelection };
}

function getDbIdWorldPosition(
  viewer: Autodesk.Viewing.GuiViewer3D,
  dbId: number
): { x: number; y: number; z: number } | null {
  try {
    const tree = viewer.model?.getInstanceTree();
    const fragmentList = viewer.model?.getFragmentList();
    if (!tree || !fragmentList) {
      return null;
    }

    let targetFragmentId = -1;
    tree.enumNodeFragments(dbId, (fragmentId: number) => {
      if (targetFragmentId === -1) {
        targetFragmentId = fragmentId;
      }
    });

    if (targetFragmentId < 0) {
      return null;
    }

    const bbox = fragmentList.getWorldBoundingBox(targetFragmentId);
    if (!bbox) {
      return null;
    }

    return {
      x: (bbox.min.x + bbox.max.x) / 2,
      y: (bbox.min.y + bbox.max.y) / 2,
      z: (bbox.min.z + bbox.max.z) / 2,
    };
  } catch (error) {
    console.warn('[useViewerInteraction] Failed to resolve world position:', error);
    return null;
  }
}
