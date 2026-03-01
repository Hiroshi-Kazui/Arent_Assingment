'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface FloorLike {
  name: string;
  floorNumber: number;
}

interface UseFloorIsolationParams {
  viewer: Autodesk.Viewing.GuiViewer3D | null;
  selectedFloorNumber: number | null;
  floors: FloorLike[];
}

interface UseFloorIsolationResult {
  isDbIdOnSelectedFloor: (dbId: number) => boolean;
  getFloorNumberForDbId: (dbId: number) => number | null;
  floorMappingReady: boolean;
  floorMappingError: string | null;
  floorsWithElements: Set<number>;
}

const LEVEL_PROPERTY_NAMES = new Set([
  'level',
  'building storey',
  'base constraint',
]);

const BULK_SIZE = 500;

export function useFloorIsolation({
  viewer,
  selectedFloorNumber,
  floors,
}: UseFloorIsolationParams): UseFloorIsolationResult {
  const floorDbIdsRef = useRef<Map<number, Set<number>>>(new Map());
  const [floorMappingReady, setFloorMappingReady] = useState(false);
  const [floorMappingError, setFloorMappingError] = useState<string | null>(null);
  const [floorsWithElements, setFloorsWithElements] = useState<Set<number>>(
    new Set()
  );

  useEffect(() => {
    if (!viewer) {
      floorDbIdsRef.current = new Map();
      setFloorMappingReady(false);
      setFloorMappingError(null);
      setFloorsWithElements(new Set());
      return;
    }

    let cancelled = false;

    const buildMapping = async () => {
      setFloorMappingReady(false);
      setFloorMappingError(null);

      try {
        const model = viewer.model;
        if (!model) {
          throw new Error('Viewer model is not ready');
        }

        const tree = model.getInstanceTree();
        if (!tree) {
          return;
        }

        const dbIds = getLeafDbIds(tree);
        if (dbIds.length === 0) {
          floorDbIdsRef.current = new Map();
          if (!cancelled) {
            setFloorsWithElements(new Set());
            setFloorMappingReady(true);
          }
          return;
        }

        const mapping = new Map<number, Set<number>>();
        let noLevelProperty = 0;
        let matchedToFloor = 0;
        let unmatchedWithLevel = 0;
        const unmatchedValues = new Map<string, number>();

        for (let i = 0; i < dbIds.length; i += BULK_SIZE) {
          const batch = dbIds.slice(i, i + BULK_SIZE);
          const results = await getBulkProperties(model, batch);

          for (const result of results) {
            const levelValue = getLevelValue(result);
            if (levelValue === null) {
              noLevelProperty++;
              continue;
            }
            const matchedFloor = matchFloorNumber(levelValue, floors);
            if (matchedFloor === null) {
              unmatchedWithLevel++;
              const key = String(levelValue);
              unmatchedValues.set(key, (unmatchedValues.get(key) ?? 0) + 1);
              continue;
            }

            matchedToFloor++;
            const floorSet = mapping.get(matchedFloor) ?? new Set<number>();
            floorSet.add(result.dbId);
            mapping.set(matchedFloor, floorSet);
          }
        }

        // 診断レポート（一時的）
        console.group('[FloorMapping] 診断レポート');
        console.log(`全リーフ要素数: ${dbIds.length}`);
        console.log(`フロア特定成功: ${matchedToFloor}`);
        console.log(`Levelプロパティなし: ${noLevelProperty}`);
        console.log(`Levelあり・フロア不一致: ${unmatchedWithLevel}`);
        if (unmatchedValues.size > 0) {
          console.log('不一致のLevel値:');
          console.table(Object.fromEntries(unmatchedValues));
        }
        console.log(`マッピング済みフロア: ${[...mapping.keys()].sort((a, b) => a - b).join(', ')}`);
        for (const [floorNum, ids] of [...mapping.entries()].sort((a, b) => a[0] - b[0])) {
          console.log(`  フロア ${floorNum}: ${ids.size} 要素`);
        }
        console.groupEnd();

        floorDbIdsRef.current = mapping;
        if (!cancelled) {
          setFloorsWithElements(new Set(mapping.keys()));
          setFloorMappingReady(true);
        }
      } catch (error) {
        console.warn('[useFloorIsolation] Failed to build floor mapping:', error);
        floorDbIdsRef.current = new Map();
        if (!cancelled) {
          setFloorsWithElements(new Set());
          setFloorMappingError(error instanceof Error ? error.message : String(error));
          setFloorMappingReady(true);
        }
      }
    };

    const eventName =
      (Autodesk.Viewing as any).GEOMETRY_LOADED_EVENT ?? 'geometryLoaded';

    const onGeometryLoaded = () => {
      void buildMapping();
    };

    viewer.addEventListener(eventName, onGeometryLoaded);
    if (viewer.model) {
      void buildMapping();
    }

    return () => {
      cancelled = true;
      viewer.removeEventListener(eventName, onGeometryLoaded);
    };
  }, [viewer, floors]);

  useEffect(() => {
    if (!viewer) {
      return;
    }

    if (selectedFloorNumber === null) {
      showAllWithGhosting(viewer, false);
      return;
    }

    if (!floorMappingReady) {
      showAllWithGhosting(viewer, false);
      return;
    }

    const dbIds = floorDbIdsRef.current.get(selectedFloorNumber);
    if (!dbIds || dbIds.size === 0) {
      // Level mapping is unavailable for this floor: keep permissive behavior.
      showAllWithGhosting(viewer, false);
      return;
    }

    console.log(`[FloorIsolation] フロア ${selectedFloorNumber}: ${dbIds.size} 個の要素を表示します。`);

    isolateWithGhosting(viewer, Array.from(dbIds), true);
  }, [viewer, selectedFloorNumber, floorMappingReady]);

  const isDbIdOnSelectedFloor = useCallback(
    (dbId: number) => {
      if (selectedFloorNumber === null) {
        return true;
      }

      if (!floorMappingReady) {
        return true;
      }

      const dbIds = floorDbIdsRef.current.get(selectedFloorNumber);
      if (!dbIds || dbIds.size === 0) {
        return true;
      }

      return dbIds.has(dbId);
    },
    [selectedFloorNumber, floorMappingReady]
  );

  const getFloorNumberForDbId = useCallback((dbId: number): number | null => {
    for (const [floorNumber, dbIds] of floorDbIdsRef.current.entries()) {
      if (dbIds.has(dbId)) {
        return floorNumber;
      }
    }
    return null;
  }, []);

  return {
    isDbIdOnSelectedFloor,
    getFloorNumberForDbId,
    floorMappingReady,
    floorMappingError,
    floorsWithElements,
  };
}

function getLeafDbIds(tree: Autodesk.Viewing.InstanceTree): number[] {
  const leafDbIds: number[] = [];
  const rootId = tree.getRootId();

  tree.enumNodeChildren(
    rootId,
    (nodeId: number) => {
      if (tree.getChildCount(nodeId) === 0) {
        leafDbIds.push(nodeId);
      }
    },
    true
  );

  return leafDbIds;
}

function getBulkProperties(
  model: Autodesk.Viewing.Model,
  dbIds: number[]
): Promise<Autodesk.Viewing.PropertyResult[]> {
  return new Promise((resolve, reject) => {
    model.getBulkProperties(
      dbIds,
      { propFilter: ['Level', 'Building Storey', 'Base Constraint'] },
      (results) => resolve(results),
      (error) => reject(error)
    );
  });
}

function getLevelValue(
  result: Autodesk.Viewing.PropertyResult
): string | number | boolean | null {
  const target = result.properties.find((prop) =>
    LEVEL_PROPERTY_NAMES.has(prop.displayName.toLowerCase())
  );
  return target?.displayValue ?? null;
}

function matchFloorNumber(
  levelValue: string | number | boolean | null,
  floors: FloorLike[]
): number | null {
  if (levelValue === null || levelValue === undefined) {
    return null;
  }

  if (typeof levelValue === 'number') {
    const directMatch = floors.find((floor) => floor.floorNumber === levelValue);
    return directMatch ? directMatch.floorNumber : null;
  }

  if (typeof levelValue === 'boolean') {
    return null;
  }

  const normalized = levelValue.trim().toLowerCase();
  const byName = floors.find(
    (floor) => floor.name.trim().toLowerCase() === normalized
  );
  if (byName) {
    return byName.floorNumber;
  }

  const numeric = normalized.match(/-?\d+/);
  if (numeric) {
    const parsed = Number.parseInt(numeric[0], 10);
    if (!Number.isNaN(parsed)) {
      const match = floors.find((floor) => floor.floorNumber === parsed);
      return match ? match.floorNumber : null;
    }
  }

  return null;
}

function showAllWithGhosting(
  viewer: Autodesk.Viewing.GuiViewer3D,
  ghosting: boolean
) {
  const anyViewer = viewer as any;
  try {
    if (typeof anyViewer.showAll === 'function') {
      anyViewer.showAll();
    } else if (typeof anyViewer.isolate === 'function') {
      anyViewer.isolate();
    }
    if (typeof anyViewer.setGhosting === 'function') {
      anyViewer.setGhosting(ghosting);
    }
  } catch (error) {
    console.warn('[useFloorIsolation] Failed to apply showAll state:', error);
  }
}

function isolateWithGhosting(
  viewer: Autodesk.Viewing.GuiViewer3D,
  dbIds: number[],
  ghosting: boolean
) {
  const anyViewer = viewer as any;
  try {
    if (typeof anyViewer.isolate === 'function') {
      anyViewer.isolate(dbIds);
    }
    if (typeof anyViewer.setGhosting === 'function') {
      anyViewer.setGhosting(ghosting);
    }
  } catch (error) {
    console.warn('[useFloorIsolation] Failed to apply isolate state:', error);
  }
}
