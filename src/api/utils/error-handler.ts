import { NextResponse } from 'next/server';
import { DomainError } from '../../domain/errors/domain-error';

export interface ErrorResponse {
  error: string;
  details?: string;
}

/**
 * エラーレスポンスを生成
 */
export function handleError(error: unknown): NextResponse<ErrorResponse> {
  console.error('API Error:', error);

  if (error instanceof DomainError) {
    // Domain層のエラーは400で返す
    return NextResponse.json(
      {
        error: error.message,
        details: error.name,
      },
      { status: 400 }
    );
  }

  if (error instanceof Error) {
    if (error.message.includes('not found') || error.message.includes('Not found')) {
      return NextResponse.json(
        {
          error: 'Not found',
          details: error.message,
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        error: error.message,
      },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      error: 'Internal server error',
    },
    { status: 500 }
  );
}

/**
 * 成功レスポンスを生成
 */
export function successResponse<T>(
  data: T,
  status: number = 200
): NextResponse<T> {
  return NextResponse.json(data, { status });
}
