/**
 * Viewer Token Provider インターフェース
 * BIM ビューア（Forge等）のアクセストークンを取得
 * 外部認証サービスとの連携を抽象化
 */
export interface ViewerTokenProvider {
  /**
   * BIM ビューア用のアクセストークンを取得
   * @returns アクセストークンと有効期限（秒）
   */
  getAccessToken(): Promise<{
    token: string;
    expiresIn: number;
  }>;
}
