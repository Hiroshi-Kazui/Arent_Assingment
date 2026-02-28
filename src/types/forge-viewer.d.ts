/**
 * Autodesk Forge Viewer SDK 型定義
 * CDN経由で読み込まれるため、グローバルスコープに型を定義
 */

declare global {
  namespace Autodesk {
    namespace Viewing {
      function Initializer(options: InitializerOptions, callback: () => void): void;

      interface InitializerOptions {
        env: 'AutodeskProduction' | 'AutodeskProduction2' | 'AutodeskDevelopment';
        accessToken: string;
        api?: string;
        getAccessToken: (callback: (token: string, expires: number) => void) => void;
      }

      class GuiViewer3D {
        constructor(container: HTMLElement, config?: any);
        loadDocumentNode(document: Document, node: BubbleNode, options?: any): Promise<void>;
        finish(): void;
        addEventListener(event: string, callback: Function): void;
        removeEventListener(event: string, callback: Function): void;
        getSelection(): number[];
        addEventListener(event: 'selection', callback: (event: SelectionChangeEvent) => void): void;

        // Extensions
        loadExtension(name: string, options?: any): Promise<Extension>;
        unloadExtension(name: string): void;

        // Model/Navigation
        impl: ViewerImpl;
        model: Model;
        toolbar: any;
      }

      interface SelectionChangeEvent {
        dbIdArray: number[];
      }

      interface ViewerImpl {
        selector: ElementSelector;
        canvas: HTMLCanvasElement;
        camera: any;
      }

      interface ElementSelector {
        getDbId(event: MouseEvent): number | null;
      }

      interface Model {
        getInstanceTree(): InstanceTree;
        getFragmentList(): FragmentList;
        getBoundingBox(): any;
        getFragmentTree(): any;
      }

      interface InstanceTree {
        getNodeName(nodeId: number): string;
        getChildCount(nodeId: number): number;
        getChildren(nodeId: number): number[];
        getParent(nodeId: number): number;
        getNodeBox(nodeId: number): any;
        enumNodeFragments(nodeId: number, callback: (fragmentId: number) => void): void;
      }

      interface FragmentList {
        getCount(): number;
        getWorldBoundingBox(fragmentId: number): any;
        getWorldMatrix(fragmentId: number): any;
      }

      interface Document {
        getRoot(): BubbleNode;
      }

      // Static methods on Document
      namespace Document {
        function load(urn: string, onSuccess: (doc: Document) => void, onError: (error: any) => void, accessToken?: string): void;
      }

      interface BubbleNode {
        children?: BubbleNode[];
        name?: string;
        role?: string;
        guid?: string;
        viewable?: boolean;
        data?: any;
      }

      interface Extension {
        initialize(): void;
        unload(): void;
      }

      // DataVisualization Extension
      namespace DataVisualization {
        class SpriteIcon {
          constructor(id: number, spriteSheet: any, position: any);
          id: number;
          position: any;
        }
      }

      // Events
      const SELECTION_CHANGED: string;
      const AGGREGATE_SELECTION_CHANGED: string;
      const VIEWER_UNINITIALIZED: string;
      const VIEWER_INITIALIZING: string;
      const VIEWER_INITIALIZED: string;
      const CAMERA_CHANGE_EVENT: string;
    }
  }
}

export {};
