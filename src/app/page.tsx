import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function Home() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full text-center border-neutral-800 shadow-2xl bg-neutral-900/50 backdrop-blur-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-3xl font-bold tracking-tight">指摘管理ツール</CardTitle>
          <CardDescription className="text-sm sm:text-base mt-2">
            施工現場向け 3D 指摘管理システム
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <Button asChild size="lg" className="w-full sm:w-auto font-semibold shadow-[0_0_20px_rgba(234,179,8,0.2)] hover:shadow-[0_0_30px_rgba(234,179,8,0.4)] transition-all">
            <Link href="/projects">
              プロジェクト一覧を開く →
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
