'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export interface ViewerHit {
  dbId: number | null;
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
const DOUBLE_TAP_THRESHOLD_MS = 300;

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
  const lastTapRef = useRef<number>(0);

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
      if (typeof hit?.dbId === 'number') {
        const passesFilter =
          !dbIdFilterRef.current || dbIdFilterRef.current(hit.dbId);
        if (passesFilter) {
          const worldPosition = hit.point
            ? {
                x: hit.point.x,
                y: hit.point.y,
                z: hit.point.z,
              }
            : getDbIdWorldPosition(viewer, hit.dbId);
          if (worldPosition) {
            return {
              dbId: hit.dbId,
              worldPosition,
            };
          }
        }
      }

      const spatialPosition = getSpatialPosition(viewer, x, y);
      if (spatialPosition) {
        return {
          dbId: null,
          worldPosition: spatialPosition,
        };
      }

      return null;
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
        const latestPointer = latestPointerRef.current;
        if (latestPointer) {
          const spatialHit = performHitTest(
            latestPointer.clientX,
            latestPointer.clientY
          );
          if (spatialHit && spatialHit.dbId === null) {
            setSelectedElement(spatialHit);
            return;
          }
        }

        setSelectedElement(null);
        return;
      }

      if (dbIdFilterRef.current && !dbIdFilterRef.current(selectedDbId)) {
        const latestPointer = latestPointerRef.current;
        if (latestPointer) {
          const spatialHit = performHitTest(
            latestPointer.clientX,
            latestPointer.clientY
          );
          if (spatialHit && spatialHit.dbId === null) {
            setSelectedElement(spatialHit);
            return;
          }
        }

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
      if (isIssueMarkerTarget(event.target)) {
        return;
      }
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
      if (isIssueMarkerTarget(event.target)) {
        return;
      }

      const now = Date.now();
      const isDoubleTap = now - lastTapRef.current < DOUBLE_TAP_THRESHOLD_MS;
      lastTapRef.current = now;

      latestPointerRef.current = { clientX: event.clientX, clientY: event.clientY };
      clearLongPressTimer();

      if (isDoubleTap) {
        const hit = performHitTest(event.clientX, event.clientY);
        if (hit) {
          clearPendingSelection();
          setSelectedElement(null);
          onQuickRegisterRef.current?.(hit);
          pointerDownRef.current = null;
          lastTapRef.current = 0;
          return;
        }
      }

      pointerDownRef.current = { clientX: event.clientX, clientY: event.clientY };
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
      if (isIssueMarkerTarget(event.target)) {
        return;
      }
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

    const onPointerUp = (event: PointerEvent) => {
      if (isIssueMarkerTarget(event.target)) {
        pointerDownRef.current = null;
        clearLongPressTimer();
        return;
      }
      const downPos = pointerDownRef.current;
      pointerDownRef.current = null;
      clearLongPressTimer();

      if (!downPos) {
        return;
      }

      const dx = event.clientX - downPos.clientX;
      const dy = event.clientY - downPos.clientY;
      if (Math.hypot(dx, dy) > LONG_PRESS_MOVE_THRESHOLD_PX) {
        return;
      }

      const hit = performHitTest(event.clientX, event.clientY);
      if (hit && hit.dbId === null) {
        setSelectedElement(hit);
      }
    };

    const onPointerCancel = () => {
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
    viewerContainer.addEventListener('pointercancel', onPointerCancel);
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
      viewerContainer.removeEventListener('pointercancel', onPointerCancel);
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

    const THREE = (window as any).THREE;
    if (!THREE) {
      return null;
    }
    const bbox = new THREE.Box3();
    fragmentList.getWorldBounds(targetFragmentId, bbox);

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

function getSpatialPosition(
  viewer: Autodesk.Viewing.GuiViewer3D,
  canvasX: number,
  canvasY: number
): { x: number; y: number; z: number } | null {
  try {
    const THREE = (window as any).THREE;
    if (!THREE) {
      return getPivotPosition(viewer);
    }

    const canvas = viewer.impl.canvas as HTMLCanvasElement | null;
    if (!canvas) {
      return getPivotPosition(viewer);
    }

    const width = canvas.clientWidth || canvas.width;
    const height = canvas.clientHeight || canvas.height;
    if (!width || !height) {
      return getPivotPosition(viewer);
    }

    const modelBox = viewer.model?.getBoundingBox();
    const pivot = getPivotPosition(viewer);
    const planePoint = new THREE.Vector3(
      modelBox ? (modelBox.min.x + modelBox.max.x) / 2 : (pivot?.x ?? 0),
      modelBox ? (modelBox.min.y + modelBox.max.y) / 2 : (pivot?.y ?? 0),
      modelBox ? (modelBox.min.z + modelBox.max.z) / 2 : (pivot?.z ?? 0)
    );

    const worldUpRaw = (viewer as any).navigation?.getWorldUpVector?.();
    const planeNormal = Array.isArray(worldUpRaw)
      ? new THREE.Vector3(worldUpRaw[0], worldUpRaw[1], worldUpRaw[2])
      : worldUpRaw?.clone?.() ?? new THREE.Vector3(0, 1, 0);

    if (planeNormal.lengthSq() === 0) {
      return getPivotPosition(viewer);
    }

    planeNormal.normalize();

    const ndcX = (canvasX / width) * 2 - 1;
    const ndcY = -(canvasY / height) * 2 + 1;
    const camera = viewer.impl.camera;
    const origin = camera.position.clone();
    const direction = new THREE.Vector3(ndcX, ndcY, 0.5)
      .unproject(camera)
      .sub(origin)
      .normalize();
    const raycaster = new THREE.Raycaster(origin, direction);

    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(
      planeNormal,
      planePoint
    );
    const intersection = new THREE.Vector3();
    const hasIntersection = raycaster.ray.intersectPlane(plane, intersection);
    if (!hasIntersection) {
      return getPivotPosition(viewer);
    }

    return { x: intersection.x, y: intersection.y, z: intersection.z };
  } catch (error) {
    console.warn(
      '[useViewerInteraction] Failed to resolve spatial world position:',
      error
    );
    return getPivotPosition(viewer);
  }
}

function getPivotPosition(
  viewer: Autodesk.Viewing.GuiViewer3D
): { x: number; y: number; z: number } | null {
  try {
    const pivot = (viewer as any).navigation?.getPivotPoint?.();
    if (pivot) {
      return { x: pivot.x, y: pivot.y, z: pivot.z };
    }

    const box = viewer.model?.getBoundingBox();
    if (!box) {
      return null;
    }

    return {
      x: (box.min.x + box.max.x) / 2,
      y: (box.min.y + box.max.y) / 2,
      z: (box.min.z + box.max.z) / 2,
    };
  } catch (error) {
    console.warn('[useViewerInteraction] Failed to resolve pivot position:', error);
    return null;
  }
}

function isIssueMarkerTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) {
    return false;
  }
  return target.closest('[data-issue-id]') !== null;
}
