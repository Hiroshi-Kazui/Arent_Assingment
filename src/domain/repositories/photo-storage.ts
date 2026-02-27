/**
 * Photo Storage インターフェース
 * 写真ファイルの永続化と取得を担当
 * 外部ストレージ（MinIO等）との連携を抽象化
 */
export interface PhotoStorage {
  /**
   * 写真ファイルをアップロード
   * @param key - 保存先キー（ファイルパス）
   * @param data - ファイルデータ（Buffer または Blob）
   * @param contentType - MIME type（例：image/jpeg）
   * @returns 保存後の URL または識別子
   */
  upload(
    key: string,
    data: Buffer | Blob,
    contentType: string
  ): Promise<string>;

  /**
   * 写真の署名済み URL を取得
   * @param key - ファイルキー
   * @param expirationMinutes - URL の有効期限（分）
   * @returns 署名済み URL
   */
  getSignedUrl(key: string, expirationMinutes: number): Promise<string>;
}
