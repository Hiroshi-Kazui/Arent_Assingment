'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface FloorLike {
  floorId: string;
  name: string;
  floorNumber: number;
  elevation: number | null;
}

interface UseFloorIsolationParams {
  viewer: Autodesk.Viewing.GuiViewer3D | null;
  selectedFloorNumber: number | null;
  floors: FloorLike[];
  buildingId: string | null;
}

interface UseFloorIsolationResult {
  isDbIdOnSelectedFloor: (dbId: number) => boolean;
  getFloorNumberForDbId: (dbId: number) => number | null;
  floorMappingReady: boolean;
  floorMappingError: string | null;
  floorsWithElements: Set<number>;
}

const BULK_SIZE = 500;

export function useFloorIsolation({
  viewer,
  selectedFloorNumber,
  floors,
  buildingId,
}: UseFloorIsolationParams): UseFloorIsolationResult {
  const floorDbIdsRef = useRef<Map<number, Set<number>>>(new Map());
  const [floorMappingReady, setFloorMappingReady] = useState(false);
  const [floorMappingError, setFloorMappingError] = useState<string | null>(null);
  const [floorsWithElements, setFloorsWithElements] = useState<Set<number>>(
    new Set()
  );
  const persistingRef = useRef(false);

  useEffect(() => {
    if (!viewer || !buildingId || floors.length === 0) {
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
        // 1. バックエンドに永続化済みか確認
        const backendMappings = await tryLoadFromBackend(buildingId);
        if (backendMappings !== null) {
          console.log('[useFloorIsolation] Using persisted mappings from backend');
          floorDbIdsRef.current = backendMappings;
          if (!cancelled) {
            setFloorsWithElements(new Set(backendMappings.keys()));
            setFloorMappingReady(true);
          }
          return;
        }

        // 2. バックエンドにデータなし → Viewer から構築
        const model = viewer.model;
        if (!model) {
          throw new Error('Viewer model is not ready');
        }

        const tree = model.getInstanceTree();
        if (!tree) return;

        const allDbIds = getLeafDbIds(tree);
        if (allDbIds.length === 0) {
          floorDbIdsRef.current = new Map();
          if (!cancelled) {
            setFloorsWithElements(new Set());
            setFloorMappingReady(true);
          }
          return;
        }

        console.log(`[useFloorIsolation] Building mapping from ${allDbIds.length} leaf nodes...`);

        // フロア名 → FloorLike のマップ
        const floorByName = new Map<string, FloorLike>();
        for (const f of floors) {
          floorByName.set(f.name, f);
        }

        // Step A: 全要素の BoundingBox min Z を取得
        const dbIdToMinZ = new Map<number, number>();

        for (let i = 0; i < allDbIds.length; i += BULK_SIZE) {
          const batch = allDbIds.slice(i, i + BULK_SIZE);
          const bboxes = getFragmentBoundingBoxes(model, batch, tree);
          for (const { dbId, minZ } of bboxes) {
            dbIdToMinZ.set(dbId, minZ);
          }
        }

        // Step B: 全要素の BoundingBox min Z 分布からフロアごとの elevation を推定
        //   フロアは floorNumber 昇順でソート済み。
        //   全要素の Z 値を等分割してフロアに割り当て、各区間の 25th パーセンタイルを elevation とする。
        const allMinZValues = [...dbIdToMinZ.values()].sort((a, b) => a - b);

        if (allMinZValues.length === 0) {
          floorDbIdsRef.current = new Map();
          if (!cancelled) {
            setFloorsWithElements(new Set());
            setFloorMappingReady(true);
          }
          return;
        }

        // フロアを floorNumber 昇順にソート
        const sortedFloors = [...floors].sort((a, b) => a.floorNumber - b.floorNumber);

        // Z 値の範囲を均等分割して各フロアの初期 elevation を推定
        const zMin = allMinZValues[0];
        const zMax = allMinZValues[allMinZValues.length - 1];
        const zRange = zMax - zMin;
        const floorCount = sortedFloors.length;

        const floorElevations = new Map<string, number>();
        for (let i = 0; i < floorCount; i++) {
          const elevation = zMin + (zRange * i) / floorCount;
          floorElevations.set(sortedFloors[i].name, elevation);
        }

        console.log(
          '[useFloorIsolation] Estimated elevations:',
          [...floorElevations.entries()]
            .map(([name, elev]) => `${name}=${elev.toFixed(1)}`)
            .join(', ')
        );

        // elevation を持つフロアでソートして割り当てに使用
        const floorsWithElevation = sortedFloors
          .map((f) => ({ ...f, elevation: floorElevations.get(f.name)! }));

        const elevations = floorsWithElevation.map((f) => f.elevation);

        // Step C: 全要素を BoundingBox min Z のみでフロアにマッピング
        const mapping = new Map<number, Set<number>>();
        const dbIdToFloorData = new Map<number, { floorId: string; boundingBoxMinZ: number }>();

        for (const dbId of allDbIds) {
          const minZ = dbIdToMinZ.get(dbId);
          if (minZ === undefined) continue;

          const floorIndex = findFloorIndex(minZ, elevations);
          if (floorIndex === -1) continue;

          const floor = floorsWithElevation[floorIndex];

          const floorSet = mapping.get(floor.floorNumber) ?? new Set<number>();
          floorSet.add(dbId);
          mapping.set(floor.floorNumber, floorSet);
          dbIdToFloorData.set(dbId, { floorId: floor.floorId, boundingBoxMinZ: minZ });
        }

        // 即座に UI に適用
        floorDbIdsRef.current = mapping;
        if (!cancelled) {
          setFloorsWithElements(new Set(mapping.keys()));
          setFloorMappingReady(true);
        }

        const totalMapped = [...mapping.values()].reduce((sum, s) => sum + s.size, 0);
        console.log(
          `[useFloorIsolation] Mapping complete: ${totalMapped} elements across ${mapping.size} floors (total leaf nodes: ${allDbIds.length})`
        );

        // Step D: バックエンドに永続化（非同期、UI ブロックしない）
        if (!persistingRef.current && (dbIdToFloorData.size > 0 || floorElevations.size > 0)) {
          persistingRef.current = true;
          (async () => {
            try {
              // elevation を更新
              if (floorElevations.size > 0) {
                const elevationUpdates = [...floorElevations.entries()]
                  .map(([name, elevation]) => {
                    const f = floorByName.get(name);
                    return f ? { floorId: f.floorId, elevation } : null;
                  })
                  .filter((e): e is { floorId: string; elevation: number } => e !== null);

                if (elevationUpdates.length > 0) {
                  await fetch(`/api/buildings/${buildingId}/floors`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ elevations: elevationUpdates }),
                  });
                  console.log(`[useFloorIsolation] Updated ${elevationUpdates.length} floor elevations`);
                }
              }

              // element_floor_mapping を永続化
              if (dbIdToFloorData.size > 0) {
                const count = await persistMappings(buildingId, dbIdToFloorData);
                console.log(`[useFloorIsolation] Persisted ${count} element-floor mappings`);
              }
            } catch (e) {
              console.warn('[useFloorIsolation] Failed to persist:', e);
            } finally {
              persistingRef.current = false;
            }
          })();
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
  }, [viewer, floors, buildingId]);

  useEffect(() => {
    if (!viewer) return;

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
      showAllWithGhosting(viewer, false);
      return;
    }

    console.log(
      `[FloorIsolation] フロア ${selectedFloorNumber}: ${dbIds.size} 個の要素を表示します。`
    );

    isolateWithGhosting(viewer, Array.from(dbIds), true);
  }, [viewer, selectedFloorNumber, floorMappingReady]);

  const isDbIdOnSelectedFloor = useCallback(
    (dbId: number) => {
      if (selectedFloorNumber === null) return true;
      if (!floorMappingReady) return true;

      const dbIds = floorDbIdsRef.current.get(selectedFloorNumber);
      if (!dbIds || dbIds.size === 0) return true;

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

// ─── Backend communication ───────────────────────────────────────

async function tryLoadFromBackend(
  buildingId: string
): Promise<Map<number, Set<number>> | null> {
  try {
    const countRes = await fetch(
      `/api/buildings/${buildingId}/element-floor-mapping?count=true`
    );
    if (!countRes.ok) return null;

    const countData = await countRes.json();
    if (!countData.count || countData.count === 0) return null;

    const res = await fetch(
      `/api/buildings/${buildingId}/element-floor-mapping`
    );
    if (!res.ok) return null;

    const data = await res.json();
    const raw: Record<string, number[]> = data.mappings || {};

    const mapping = new Map<number, Set<number>>();
    for (const [floorNumStr, dbIdList] of Object.entries(raw)) {
      const floorNumber = parseInt(floorNumStr, 10);
      if (!isNaN(floorNumber)) {
        mapping.set(floorNumber, new Set(dbIdList as number[]));
      }
    }

    return mapping.size > 0 ? mapping : null;
  } catch {
    return null;
  }
}

async function persistMappings(
  buildingId: string,
  dbIdToFloorData: Map<number, { floorId: string; boundingBoxMinZ: number }>
): Promise<number> {
  const mappings = [...dbIdToFloorData.entries()].map(([dbId, data]) => ({
    dbId,
    floorId: data.floorId,
    boundingBoxMinZ: data.boundingBoxMinZ,
  }));

  const res = await fetch(
    `/api/buildings/${buildingId}/element-floor-mapping`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mappings }),
    }
  );

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `POST failed: ${res.status}`);
  }

  const result = await res.json();
  return result.mappingsCreated || 0;
}

// ─── Viewer helpers ──────────────────────────────────────────────

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

interface FragmentBBox {
  dbId: number;
  minZ: number;
}

function getFragmentBoundingBoxes(
  model: Autodesk.Viewing.Model,
  dbIds: number[],
  tree: Autodesk.Viewing.InstanceTree
): FragmentBBox[] {
  const THREE = (window as any).THREE;
  if (!THREE) return [];

  const frags = model.getFragmentList();
  const results: FragmentBBox[] = [];

  for (const dbId of dbIds) {
    const box = new THREE.Box3();
    const fragBox = new THREE.Box3();
    let hasFragment = false;

    tree.enumNodeFragments(dbId, (fragId: number) => {
      frags.getWorldBounds(fragId, fragBox);
      if (!fragBox.isEmpty()) {
        box.union(fragBox);
        hasFragment = true;
      }
    });

    if (hasFragment && !box.isEmpty()) {
      results.push({ dbId, minZ: box.min.z });
    }
  }

  return results;
}

function findFloorIndex(
  boundingBoxMinZ: number,
  elevations: number[]
): number {
  if (elevations.length === 0) return -1;

  if (boundingBoxMinZ < elevations[0]) {
    return 0;
  }

  if (boundingBoxMinZ >= elevations[elevations.length - 1]) {
    return elevations.length - 1;
  }

  for (let i = 0; i < elevations.length - 1; i++) {
    if (boundingBoxMinZ >= elevations[i] && boundingBoxMinZ < elevations[i + 1]) {
      return i;
    }
  }

  return -1;
}

// ─── Viewer isolation helpers ────────────────────────────────────

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
