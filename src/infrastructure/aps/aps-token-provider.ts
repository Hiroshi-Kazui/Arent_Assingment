import { ViewerTokenProvider } from '../../domain/repositories/viewer-token-provider';

/**
 * APS (Autodesk Platform Services) Token Provider
 * 2-legged OAuth でアクセストークンを取得し、キャッシュする
 */
export class ApsTokenProvider implements ViewerTokenProvider {
  private clientId: string;
  private clientSecret: string;
  private tokenUrl =
    'https://developer.api.autodesk.com/authentication/v2/token';

  private cachedToken: string | null = null;
  private tokenExpiresAt: number = 0;

  constructor(clientId: string, clientSecret: string) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
  }

  async getAccessToken(): Promise<string> {
    // 有効期限の60秒前まではキャッシュを再利用
    if (
      this.cachedToken &&
      Date.now() < this.tokenExpiresAt - 60_000
    ) {
      return this.cachedToken;
    }

    // 新しいトークンを取得
    const token = await this.fetchNewToken();
    this.cachedToken = token.access_token;
    this.tokenExpiresAt = Date.now() + token.expires_in * 1000;

    return this.cachedToken;
  }

  /**
   * APS から新しいアクセストークンを取得
   */
  private async fetchNewToken(): Promise<{
    access_token: string;
    expires_in: number;
  }> {
    const response = await fetch(this.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        grant_type: 'client_credentials',
        scope: 'data:read',
      }).toString(),
    });

    if (!response.ok) {
      throw new Error(
        `Failed to obtain APS token: ${response.status} ${response.statusText}`
      );
    }

    return response.json();
  }
}
