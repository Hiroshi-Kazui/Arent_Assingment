'use client';

import { useEffect, useState } from 'react';

export interface IssueMarker {
  issueId: string;
  title: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'DONE';
  dbId?: number;
  position?: { x: number; y: number };
  worldPosition?: { x: number; y: number; z: number };
  highlighted?: boolean;
}

interface IssueMarkersProps {
  markers: IssueMarker[];
  viewerContainer: HTMLElement | null;
  viewer: Autodesk.Viewing.GuiViewer3D | null;
  onMarkerClick?: (issueId: string) => void;
  hoveredIssueId?: string | null;
  onMarkerHover?: (issueId: string | null) => void;
}

/**
 * Issue マーカーをViewer上に表示するコンポーネント
 * カスタムオーバーレイ方式を使用
 */
export function IssueMarkers({
  markers,
  viewerContainer,
  viewer,
  onMarkerClick,
  hoveredIssueId,
  onMarkerHover,
}: IssueMarkersProps) {
  const [overlayContainer, setOverlayContainer] = useState<HTMLElement | null>(null);

  // オーバーレイコンテナ作成
  useEffect(() => {
    if (!viewerContainer) return;

    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.top = '0';
    container.style.left = '0';
    container.style.width = '100%';
    container.style.height = '100%';
    container.style.pointerEvents = 'none';
    container.style.zIndex = '5';

    viewerContainer.appendChild(container);
    setOverlayContainer(container);

    return () => {
      if (container.parentElement) {
        container.parentElement.removeChild(container);
      }
    };
  }, [viewerContainer]);

  // マーカー描画
  useEffect(() => {
    if (!overlayContainer || !viewer) return;

    overlayContainer.innerHTML = '';

    const colors: Record<string, string> = {
      OPEN: '#ef4444', // Tailwind red-500
      IN_PROGRESS: '#eab308', // Safety Yellow
      DONE: '#22c55e', // Tailwind green-500
    };

    markers.forEach((marker) => {
      const color = colors[marker.status] || '#007bff';
      const isHighlighted = hoveredIssueId === marker.issueId;

      const markerDiv = document.createElement('div');
      markerDiv.style.position = 'absolute';
      markerDiv.style.pointerEvents = 'auto';
      markerDiv.style.cursor = 'pointer';
      markerDiv.style.width = isHighlighted ? '40px' : '32px';
      markerDiv.style.height = isHighlighted ? '40px' : '32px';
      markerDiv.style.transform = 'translate(-50%, -50%)';
      markerDiv.style.transition = 'width 0.15s, height 0.15s';
      markerDiv.style.zIndex = isHighlighted ? '10' : '5';
      markerDiv.setAttribute('data-issue-id', marker.issueId);

      markerDiv.innerHTML = `
        <div style="
          width: 100%;
          height: 100%;
          background-color: ${color};
          border: ${isHighlighted ? '3px' : '2px'} solid white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          font-size: ${isHighlighted ? '14px' : '12px'};
          color: white;
          box-shadow: ${isHighlighted ? '0 0 0 3px ' + color + '66, 0 4px 12px rgba(0,0,0,0.4)' : '0 2px 8px rgba(0,0,0,0.3)'};
        ">
          ${marker.status === 'OPEN' ? '!' : marker.status === 'IN_PROGRESS' ? '◐' : '✓'}
        </div>
        <div style="
          position: absolute;
          top: 100%;
          left: 50%;
          transform: translateX(-50%);
          background-color: rgba(0,0,0,0.85);
          color: white;
          padding: 4px 8px;
          border-radius: 4px;
          white-space: nowrap;
          font-size: 11px;
          margin-top: 6px;
          pointer-events: none;
          opacity: ${isHighlighted ? '1' : '0'};
          transition: opacity 0.15s;
        ">
          ${marker.title}
        </div>
      `;

      // マウスホバー
      markerDiv.addEventListener('mouseenter', () => {
        const tooltip = markerDiv.querySelector('div:last-child') as HTMLElement;
        if (tooltip) tooltip.style.opacity = '1';
        if (onMarkerHover) onMarkerHover(marker.issueId);
      });

      markerDiv.addEventListener('mouseleave', () => {
        const tooltip = markerDiv.querySelector('div:last-child') as HTMLElement;
        if (tooltip) tooltip.style.opacity = '0';
        if (onMarkerHover) onMarkerHover(null);
      });

      // Viewer 側のダブルクリック/長押し登録ハンドラへ伝播させない
      markerDiv.addEventListener('pointerdown', (event) => {
        event.stopPropagation();
      });
      markerDiv.addEventListener('pointerup', (event) => {
        event.stopPropagation();
      });
      markerDiv.addEventListener('dblclick', (event) => {
        event.stopPropagation();
        event.preventDefault();
      });

      // クリック
      markerDiv.addEventListener('click', (event) => {
        event.stopPropagation();
        if (onMarkerClick) onMarkerClick(marker.issueId);
      });

      overlayContainer.appendChild(markerDiv);

      // 3D→2D 座標変換
      updateMarkerPosition(marker, markerDiv, viewer);
    });

    // カメラ移動時にマーカー位置を再計算
    const updatePositions = () => {
      markers.forEach((marker) => {
        const markerDiv = overlayContainer.querySelector(
          `[data-issue-id="${marker.issueId}"]`
        ) as HTMLElement | null;
        if (markerDiv) updateMarkerPosition(marker, markerDiv, viewer);
      });
    };

    const cameraEvent =
      (Autodesk.Viewing as any).CAMERA_CHANGE_EVENT ?? 'camera.changed';

    viewer.addEventListener(cameraEvent, updatePositions);
    return () => {
      viewer.removeEventListener(cameraEvent, updatePositions);
    };
  }, [markers, overlayContainer, viewer, onMarkerClick, onMarkerHover, hoveredIssueId]);

  return null;
}

/**
 * マーカーの2D画面座標を更新
 */
function updateMarkerPosition(
  marker: IssueMarker,
  markerDiv: HTMLElement,
  viewer: Autodesk.Viewing.GuiViewer3D
) {
  try {
    const THREE = (window as any).THREE;
    if (!THREE) return;

    let worldPos: { x: number; y: number } | null = null;

    if (marker.dbId && viewer.model) {
      const instanceTree = viewer.model.getInstanceTree();
      const fragmentList = viewer.model.getFragmentList();

      if (instanceTree && fragmentList) {
        let fragmentId = -1;
        instanceTree.enumNodeFragments(marker.dbId, (fid: number) => {
          if (fragmentId === -1) fragmentId = fid;
        });

        if (fragmentId >= 0) {
          const bbox = new THREE.Box3();
          fragmentList.getWorldBounds(fragmentId, bbox);
          if (bbox) {
            const cx = (bbox.min.x + bbox.max.x) / 2;
            const cy = (bbox.min.y + bbox.max.y) / 2;
            const cz = (bbox.min.z + bbox.max.z) / 2;
            const screenPt = (viewer.impl as any).worldToClient(
              new THREE.Vector3(cx, cy, cz)
            );
            if (screenPt) worldPos = { x: screenPt.x, y: screenPt.y };
          }
        }
      }
    } else if (marker.worldPosition) {
      const screenPt = (viewer.impl as any).worldToClient(
        new THREE.Vector3(
          marker.worldPosition.x,
          marker.worldPosition.y,
          marker.worldPosition.z
        )
      );
      if (screenPt) worldPos = { x: screenPt.x, y: screenPt.y };
    }

    if (worldPos) {
      markerDiv.style.left = `${worldPos.x}px`;
      markerDiv.style.top = `${worldPos.y}px`;
      markerDiv.style.display = 'block';
    } else {
      markerDiv.style.display = 'none';
    }
  } catch (err) {
    console.error('Error updating marker position:', err);
  }
}
