/**
 * Photo Storage インターフェース
 * 写真ファイルの永続化と取得を担当
 * 外部ストレージ（MinIO等）との連携を抽象化
 */
export interface PhotoStorage {
  /**
   * 写真ファイルをアップロード
   * @param key - 保存先キー（ファイルパス）
   * @param file - ファイルデータ
   * @param contentType - MIME type（例：image/jpeg）
   */
  upload(
    key: string,
    file: Buffer,
    contentType: string
  ): Promise<void>;

  /**
   * 写真アクセス URL を取得
   * @param key - ファイルキー
   * @returns 署名済み URL
   */
  getUrl(key: string): Promise<string>;
}
