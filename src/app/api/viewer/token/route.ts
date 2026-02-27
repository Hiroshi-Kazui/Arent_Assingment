import { NextResponse } from 'next/server';
import { getProviders } from '@/application/di';
import { handleError, successResponse } from '@/api/utils/error-handler';

export async function GET() {
  try {
    if (!process.env.APS_CLIENT_ID || !process.env.APS_CLIENT_SECRET) {
      return NextResponse.json(
        { error: 'APS credentials not configured' },
        { status: 500 }
      );
    }

    const providers = getProviders();
    const token = await providers.viewerTokenProvider.getAccessToken();

    return successResponse({
      access_token: token.token,
      expires_in: token.expiresIn,
    });
  } catch (error) {
    return handleError(error);
  }
}
