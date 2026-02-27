import { NextResponse } from 'next/server';
import { ApsTokenProvider } from '@/infrastructure/aps/aps-token-provider';
import { handleError, successResponse } from '@/api/utils/error-handler';

export async function GET() {
  try {
    const clientId = process.env.APS_CLIENT_ID || '';
    const clientSecret = process.env.APS_CLIENT_SECRET || '';

    if (!clientId || !clientSecret) {
      return NextResponse.json(
        { error: 'APS credentials not configured' },
        { status: 500 }
      );
    }

    const tokenProvider = new ApsTokenProvider(clientId, clientSecret);
    const accessToken = await tokenProvider.getAccessToken();

    return successResponse({
      access_token: accessToken,
      // トークンの有効期限は通常3600秒（1時間）
      expires_in: 3600,
    });
  } catch (error) {
    return handleError(error);
  }
}
