import { ViewerTokenProvider } from '../../domain/repositories/viewer-token-provider';

const MD_BASE = 'https://developer.api.autodesk.com/modelderivative/v2/designdata';

/**
 * APS Model Derivative API から BIM モデルのメタデータを取得するサービス
 */
export class ApsModelMetadataService {
  constructor(private tokenProvider: ViewerTokenProvider) {}

  /**
   * モデルの Level 名一覧を取得する
   * 各要素の「参照レベル」(拘束カテゴリ) プロパティからユニークなLevel名を収集
   */
  async getLevelNames(modelUrn: string): Promise<string[]> {
    const { token } = await this.tokenProvider.getAccessToken();
    const encodedUrn = this.ensureBase64(modelUrn);

    // 1. メタデータ GUID を取得
    const guid = await this.getDefaultViewGuid(encodedUrn, token);
    if (!guid) {
      throw new Error('No 3D viewable found in model metadata');
    }

    // 2. 全プロパティからレベル名を抽出
    return this.extractLevelNames(encodedUrn, guid, token);
  }

  private async getDefaultViewGuid(urn: string, token: string): Promise<string | null> {
    const res = await fetch(`${MD_BASE}/${urn}/metadata`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      throw new Error(`Failed to get model metadata: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    const views = data?.data?.metadata ?? [];
    const view3d = views.find((v: any) => v.role === '3d');
    return view3d?.guid ?? views[0]?.guid ?? null;
  }

  /**
   * 全プロパティから「参照レベル」のユニークな値を抽出
   * mm値やオフセット値はフロア名ではないので除外
   */
  private async extractLevelNames(
    urn: string,
    guid: string,
    token: string
  ): Promise<string[]> {
    const res = await fetch(
      `${MD_BASE}/${urn}/metadata/${guid}/properties?forceget=true`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!res.ok) {
      throw new Error(`Failed to get properties: ${res.status}`);
    }

    const data = await res.json();
    const collection = data?.data?.collection ?? [];

    const levelPropNames = new Set([
      '参照レベル', 'reference level', 'level', 'base constraint',
    ]);

    const levelCounts = new Map<string, number>();

    for (const obj of collection) {
      const props = obj.properties || {};
      for (const catProps of Object.values(props)) {
        if (typeof catProps !== 'object' || catProps === null) continue;
        for (const [propName, propValue] of Object.entries(catProps as Record<string, unknown>)) {
          if (!levelPropNames.has(propName.toLowerCase())) continue;

          const val = String(propValue).trim();
          if (!val) continue;
          // mm 値やオフセット値を除外（フロア名ではない）
          if (/^-?\d+\.?\d*\s*mm$/.test(val)) continue;
          if (/^-?\d+\.\d{3}$/.test(val)) continue;

          levelCounts.set(val, (levelCounts.get(val) || 0) + 1);
        }
      }
    }

    // 要素数が少なすぎるものは除外（ノイズ）
    const names = [...levelCounts.entries()]
      .filter(([, count]) => count >= 1)
      .map(([name]) => name);

    return names;
  }

  private ensureBase64(urn: string): string {
    if (urn.startsWith('dXJu')) return urn;
    if (urn.startsWith('urn:')) {
      return Buffer.from(urn).toString('base64url');
    }
    return urn;
  }
}
