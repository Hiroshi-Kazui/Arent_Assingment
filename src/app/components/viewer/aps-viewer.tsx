'use client';

import { useEffect, useRef, useState } from 'react';

interface ApsViewerProps {
  modelUrn: string;
  onViewerReady?: (viewer: Autodesk.Viewing.GuiViewer3D) => void;
  onContainerReady?: (container: HTMLElement) => void;
}

let viewerSdkPromise: Promise<void> | null = null;

function ensureViewerSdkLoaded(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('window is not available'));
  }

  if ((window as any).Autodesk?.Viewing) {
    return Promise.resolve();
  }

  if (viewerSdkPromise) {
    return viewerSdkPromise;
  }

  viewerSdkPromise = new Promise<void>((resolve, reject) => {
    const existingScript = document.querySelector(
      'script[data-aps-viewer-sdk="true"]'
    ) as HTMLScriptElement | null;
    const existingStyle = document.querySelector(
      'link[data-aps-viewer-style="true"]'
    ) as HTMLLinkElement | null;

    if (!existingStyle) {
      const linkEl = document.createElement('link');
      linkEl.rel = 'stylesheet';
      linkEl.href =
        'https://developer.api.autodesk.com/modelderivative/v2/viewers/7.*/style.min.css';
      linkEl.dataset.apsViewerStyle = 'true';
      document.head.appendChild(linkEl);
    }

    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(), { once: true });
      existingScript.addEventListener(
        'error',
        () => reject(new Error('Failed to load Forge Viewer SDK')),
        { once: true }
      );
      return;
    }

    const scriptEl = document.createElement('script');
    scriptEl.src =
      'https://developer.api.autodesk.com/modelderivative/v2/viewers/7.*/viewer3D.min.js';
    scriptEl.async = true;
    scriptEl.dataset.apsViewerSdk = 'true';
    scriptEl.onload = () => resolve();
    scriptEl.onerror = () =>
      reject(new Error('Failed to load Forge Viewer SDK'));
    document.body.appendChild(scriptEl);
  });

  return viewerSdkPromise;
}

/**
 * APS Viewer コンポーネント
 * Autodesk Platform Services の 3D Viewer を表示
 */
export function ApsViewer({
  modelUrn,
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
      try {
        setLoading(true);
        setError(null);

        await ensureViewerSdkLoaded();
        if (!(window as any).Autodesk?.Viewing) {
          throw new Error('Autodesk Viewer SDK is not available');
        }

        // Viewer を初期化
        const options: Autodesk.Viewing.InitializerOptions = {
          env: 'AutodeskProduction2',
          api: 'streamingV2',
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
            containerRef.current,
            { viewCubeUi: false }
          );
          viewerRef.current = viewer;
          (viewer as any).start();

          // ViewCube（コンパスNアイコン）をCSS非表示
          const vcStyle = document.createElement('style');
          vcStyle.textContent = '.viewcubeWrapper, .adsk-viewing-viewer .viewcubeWrapper { display: none !important; }';
          containerRef.current.appendChild(vcStyle);

          // Callback: コンテナとビューアーが準備完了
          if (onContainerReady && containerRef.current) {
            onContainerReady(containerRef.current);
          }
          if (onViewerReady) {
            onViewerReady(viewer);
          }

          // ドキュメント読み込み
          // Viewer を初期化
          try {
            Autodesk.Viewing.Document.load(
              `urn:${modelUrn}`,
              async (doc: any) => {
                const root = doc.getRoot();

                // 標準APIで取得し、フォールバックとしてカスタム実装を使用
                const viewable =
                  (typeof root.getDefaultGeometry === 'function'
                    ? root.getDefaultGeometry()
                    : null) ?? findViewableNode(root);

                if (!viewable) {
                  console.error(
                    '[ApsViewer] No viewable geometry found. Bubble tree:',
                    JSON.stringify(root.data, null, 2)
                  );
                  setError(
                    'Viewable geometry not found in document。' +
                    'モデルが APS Model Derivative API で変換済みか確認してください。' +
                    '（詳細はブラウザコンソールを参照）'
                  );
                  setLoading(false);
                  return;
                }

                try {
                  await viewer.loadDocumentNode(doc, viewable);
                  setLoading(false);
                } catch (loadErr) {
                  const details =
                    loadErr instanceof Error ? loadErr.message : String(loadErr);
                  setError(`Failed to display viewable: ${details}`);
                  setLoading(false);
                }
              },
              (loadDocError: any) => {
                console.error('Document load error:', loadDocError);
                const details =
                  typeof loadDocError === 'string'
                    ? loadDocError
                    : loadDocError?.message ??
                      loadDocError?.statusText ??
                      loadDocError?.code ??
                      JSON.stringify(loadDocError);
                setError(`Failed to load document: ${details}`);
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
        });
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
  }, [modelUrn, onContainerReady, onViewerReady]);

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
