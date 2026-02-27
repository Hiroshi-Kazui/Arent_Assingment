'use client';

import { useEffect, useRef, useState } from 'react';

interface ApsViewerProps {
  modelUrn: string;
  onMarkerClick?: (issueId: string) => void;
  onDbIdSelected?: (dbId: number) => void;
  onViewerReady?: (viewer: Autodesk.Viewing.GuiViewer3D) => void;
  onContainerReady?: (container: HTMLElement) => void;
}

/**
 * APS Viewer コンポーネント
 * Autodesk Platform Services の 3D Viewer を表示
 */
export function ApsViewer({
  modelUrn,
  onDbIdSelected,
  onViewerReady,
  onContainerReady,
}: ApsViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Autodesk.Viewing.GuiViewer3D | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) {
      setError('Container element not found');
      return;
    }

    const initializeViewer = async () => {
      let linkEl: HTMLLinkElement | null = null;
      let scriptEl: HTMLScriptElement | null = null;
      let dblClickHandler: ((event: MouseEvent) => void) | null = null;
      try {
        setLoading(true);

        // Viewer SDK をロード
        scriptEl = document.createElement('script');
        scriptEl.src =
          'https://developer.api.autodesk.com/modelderivative/v2/viewers/7.*/viewer3D.min.js';
        scriptEl.async = true;

        // CSS をロード
        linkEl = document.createElement('link');
        linkEl.rel = 'stylesheet';
        linkEl.href =
          'https://developer.api.autodesk.com/modelderivative/v2/viewers/7.*/style.min.css';
        document.head.appendChild(linkEl);

        scriptEl.onload = async () => {
          // Viewer を初期化
          const options: Autodesk.Viewing.InitializerOptions = {
            env: 'AutodeskProduction',
            accessToken: '',
            getAccessToken: async (callback) => {
              try {
                const response = await fetch('/api/viewer/token');
                const data = await response.json();
                callback(data.access_token, data.expires_in);
              } catch (err) {
                console.error('Failed to get access token:', err);
                callback('', 3600);
              }
            },
          };

          Autodesk.Viewing.Initializer(options, async () => {
            if (!containerRef.current) return;

            // GuiViewer3D を作成
            const viewer = new Autodesk.Viewing.GuiViewer3D(
              containerRef.current
            );
            viewerRef.current = viewer;
            (viewer as any).start();

            // Callback: コンテナとビューアーが準備完了
            if (onContainerReady && containerRef.current) {
              onContainerReady(containerRef.current);
            }
            if (onViewerReady) {
              onViewerReady(viewer);
            }

            // ドキュメント読み込み
            try {
              // Forge URN を使用してドキュメント読み込み
              Autodesk.Viewing.Document.load(
                `urn:${modelUrn}`,
                (doc: any) => {
                  const root = doc.getRoot();
                  const viewable = findViewableNode(root);

                  if (viewable) {
                    viewer.loadDocumentNode(doc, viewable);
                  } else {
                    setError(
                      'Viewable geometry not found in document'
                    );
                  }

                  setLoading(false);
                },
                (error: any) => {
                  console.error('Document load error:', error);
                  setError(`Failed to load document: ${error.message}`);
                  setLoading(false);
                }
              );
            } catch (err) {
              console.error('Viewer initialization error:', err);
              setError(
                'Failed to initialize viewer: ' +
                  (err instanceof Error ? err.message : String(err))
              );
              setLoading(false);
            }

            // ダブルクリックでdbID取得
            dblClickHandler = (event: MouseEvent) => {
              const hit = (viewer.impl as any).hitTest(
                event.offsetX,
                event.offsetY,
                true
              );
              if (hit?.dbId && onDbIdSelected) {
                onDbIdSelected(hit.dbId);
              }
            };
            containerRef.current?.addEventListener('dblclick', dblClickHandler);
          });
        };

        scriptEl.onerror = () => {
          setError('Failed to load Forge Viewer SDK');
          setLoading(false);
        };

        document.body.appendChild(scriptEl);
      } catch (err) {
        console.error('Error initializing viewer:', err);
        setError(
          'Error initializing viewer: ' +
            (err instanceof Error ? err.message : String(err))
        );
        setLoading(false);
      }
    };

    initializeViewer();

    // クリーンアップ
    return () => {
      if (containerRef.current) {
        containerRef.current.replaceChildren();
      }
      if (viewerRef.current) {
        try {
          viewerRef.current.finish();
        } catch (err) {
          console.error('Error finishing viewer:', err);
        }
      }
    };
  }, [modelUrn, onDbIdSelected]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      {loading && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 10,
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
            padding: '20px',
            borderRadius: '8px',
          }}
        >
          Loading 3D Model...
        </div>
      )}

      {error && (
        <div
          style={{
            position: 'absolute',
            top: '20px',
            left: '20px',
            right: '20px',
            backgroundColor: '#f8d7da',
            color: '#721c24',
            padding: '12px',
            borderRadius: '4px',
            zIndex: 10,
          }}
        >
          <strong>Error:</strong> {error}
        </div>
      )}

      <div
        ref={containerRef}
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  );
}

/**
 * ドキュメント内で表示可能なノードを探す
 */
function findViewableNode(
  node: Autodesk.Viewing.BubbleNode
): Autodesk.Viewing.BubbleNode | null {
  if (node.viewable) {
    return node;
  }

  if (node.children) {
    for (const child of node.children) {
      const result = findViewableNode(child);
      if (result) {
        return result;
      }
    }
  }

  return null;
}
