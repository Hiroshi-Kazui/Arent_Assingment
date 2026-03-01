'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { ViewerHit } from '@/app/components/viewer/use-viewer-interaction';

interface ElementInfoPanelProps {
  viewer: Autodesk.Viewing.GuiViewer3D | null;
  element: ViewerHit | null;
  onRegister: (element: ViewerHit) => void;
  onClose: () => void;
}

interface PanelPosition {
  x: number;
  y: number;
}

const DESKTOP_PANEL_WIDTH = 320;
const PANEL_MARGIN = 16;

export function ElementInfoPanel({
  viewer,
  element,
  onRegister,
  onClose,
}: ElementInfoPanelProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState<string>('');
  const [properties, setProperties] = useState<Autodesk.Viewing.PropertyItem[]>([]);
  const [desktopPosition, setDesktopPosition] = useState<PanelPosition | null>(null);

  useEffect(() => {
    if (!viewer || !element) {
      setLoading(false);
      setError(null);
      setName('');
      setProperties([]);
      return;
    }
    if (element.dbId === null) {
      setLoading(false);
      setError(null);
      setName('');
      setProperties([]);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setProperties([]);

    viewer.getProperties(
      element.dbId,
      (result) => {
        if (cancelled) {
          return;
        }
        setName(result.name ?? '');
        setProperties(result.properties ?? []);
        setLoading(false);
      },
      (loadError) => {
        if (cancelled) {
          return;
        }
        const message =
          loadError instanceof Error ? loadError.message : String(loadError);
        setError(message);
        setLoading(false);
      }
    );

    return () => {
      cancelled = true;
    };
  }, [viewer, element]);

  useEffect(() => {
    if (!viewer || !element) {
      setDesktopPosition(null);
      return;
    }

    const updateDesktopPosition = () => {
      const THREE = (window as any).THREE;
      if (!THREE) {
        return;
      }

      const point = new THREE.Vector3(
        element.worldPosition.x,
        element.worldPosition.y,
        element.worldPosition.z
      );
      const clientPoint = viewer.impl.worldToClient(point);
      if (!clientPoint) {
        setDesktopPosition(null);
        return;
      }

      const container = viewer.impl.canvas?.parentElement as HTMLElement | null;
      const containerWidth = container?.clientWidth ?? window.innerWidth;
      const nextX = clamp(
        clientPoint.x,
        PANEL_MARGIN + DESKTOP_PANEL_WIDTH / 2,
        Math.max(
          PANEL_MARGIN + DESKTOP_PANEL_WIDTH / 2,
          containerWidth - PANEL_MARGIN - DESKTOP_PANEL_WIDTH / 2
        )
      );

      setDesktopPosition({
        x: nextX,
        y: Math.max(PANEL_MARGIN, clientPoint.y),
      });
    };

    updateDesktopPosition();

    const cameraEventName =
      (Autodesk.Viewing as any).CAMERA_CHANGE_EVENT ?? 'camera.changed';
    viewer.addEventListener(cameraEventName, updateDesktopPosition);

    return () => {
      viewer.removeEventListener(cameraEventName, updateDesktopPosition);
    };
  }, [viewer, element]);

  const featuredProperties = useMemo(() => {
    return pickFeaturedProperties(properties);
  }, [properties]);

  if (!element) {
    return null;
  }

  const content = (
    <div className="space-y-3">
      <div className="rounded-md border bg-muted/40 p-3">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
          部材
        </p>
        <p className="text-sm font-semibold line-clamp-2">
          {name || '名称不明'}
        </p>
        <p className="text-xs text-muted-foreground font-mono mt-1">
          dbId: {element.dbId}
        </p>
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground">部材プロパティを取得中...</p>
      ) : error ? (
        <p className="text-xs text-destructive">プロパティ取得失敗: {error}</p>
      ) : featuredProperties.length > 0 ? (
        <div className="space-y-2">
          {featuredProperties.map((property) => (
            <div key={`${property.displayCategory}-${property.displayName}`}>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {property.displayCategory || 'Property'}
              </p>
              <p className="text-xs font-medium">
                {property.displayName}: {String(property.displayValue ?? '-')}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          表示可能な主要プロパティがありません
        </p>
      )}

      <div className="flex gap-2">
        <Button
          className="flex-1"
          onClick={() => onRegister(element)}
        >
          指摘登録
        </Button>
        <Button
          variant="outline"
          onClick={onClose}
        >
          閉じる
        </Button>
      </div>
    </div>
  );

  return (
    <>
      <div
        className="hidden sm:block absolute z-30 pointer-events-none"
        style={{
          left: desktopPosition?.x ?? PANEL_MARGIN + DESKTOP_PANEL_WIDTH / 2,
          top: desktopPosition?.y ?? PANEL_MARGIN,
          transform: 'translate(-50%, calc(-100% - 12px))',
        }}
      >
        <div className="pointer-events-auto w-80 rounded-lg border bg-background/95 shadow-xl p-4 backdrop-blur-sm">
          {content}
        </div>
      </div>

      <div className="sm:hidden">
        <Drawer
          open={!!element}
          onOpenChange={(open) => {
            if (!open) {
              onClose();
            }
          }}
        >
          <DrawerContent className="h-[40vh]">
            <DrawerHeader className="border-b pb-3">
              <DrawerTitle>部材情報</DrawerTitle>
            </DrawerHeader>
            <ScrollArea className="flex-1 p-4">{content}</ScrollArea>
          </DrawerContent>
        </Drawer>
      </div>
    </>
  );
}

function pickFeaturedProperties(
  properties: Autodesk.Viewing.PropertyItem[]
): Autodesk.Viewing.PropertyItem[] {
  if (properties.length === 0) {
    return [];
  }

  const keywords = ['category', 'level', 'material', 'family', 'type'];
  const seen = new Set<string>();
  const prioritized: Autodesk.Viewing.PropertyItem[] = [];

  for (const keyword of keywords) {
    const match = properties.find((property) =>
      property.displayName.toLowerCase().includes(keyword)
    );
    if (match) {
      const key = `${match.displayCategory}:${match.displayName}`;
      if (!seen.has(key)) {
        seen.add(key);
        prioritized.push(match);
      }
    }
  }

  for (const property of properties) {
    const key = `${property.displayCategory}:${property.displayName}`;
    if (!seen.has(key)) {
      prioritized.push(property);
      seen.add(key);
    }
    if (prioritized.length >= 5) {
      break;
    }
  }

  return prioritized.slice(0, 5);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
