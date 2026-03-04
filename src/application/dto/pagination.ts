/**
 * ページネーション共通型
 * 全リスト系クエリで使用する
 */

/** ページネーションパラメータ */
export interface PaginationParams {
  page: number;
  limit: number;
}

/** ページネーション付きレスポンス */
export interface PaginatedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  limit: number;
  totalPages: number;
}

/** デフォルト値 */
export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

/**
 * URL SearchParams からページネーションパラメータを安全にパースする
 */
export function parsePaginationParams(searchParams: URLSearchParams): PaginationParams {
  const rawPage = searchParams.get('page');
  const rawLimit = searchParams.get('limit');

  let page = rawPage ? parseInt(rawPage, 10) : DEFAULT_PAGE;
  let limit = rawLimit ? parseInt(rawLimit, 10) : DEFAULT_LIMIT;

  if (isNaN(page) || page < 1) page = DEFAULT_PAGE;
  if (isNaN(limit) || limit < 1) limit = DEFAULT_LIMIT;
  if (limit > MAX_LIMIT) limit = MAX_LIMIT;

  return { page, limit };
}

/**
 * PaginatedResult を構築するヘルパー
 */
export function buildPaginatedResult<T>(
  items: T[],
  totalCount: number,
  params: PaginationParams
): PaginatedResult<T> {
  return {
    items,
    totalCount,
    page: params.page,
    limit: params.limit,
    totalPages: Math.ceil(totalCount / params.limit),
  };
}
