'use client';

import { use, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ApsViewer } from '@/app/components/viewer/aps-viewer';
import { useFloorIsolation } from '@/app/components/viewer/use-floor-isolation';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface PageProps {
  params: Promise<{ id: string }>;
}

interface Project {
  projectId: string;
  name: string;
  buildingId: string;
  status: string;
  building: {
    buildingId: string;
    name: string;
    address: string;
    modelUrn: string;
  };
}

interface Floor {
  floorId: string;
  name: string;
  floorNumber: number;
  issueCount: number;
}

const INVALID_MODEL_URNS = new Set([
  'YOUR_MODEL_URN_HERE',
  'your_model_urn',
  'default-model-urn',
]);

function isValidModelUrn(value: string | undefined | null): value is string {
  return !!value && !INVALID_MODEL_URNS.has(value.trim());
}

export default function FloorListPage({ params }: PageProps) {
  const { id } = use(params);
  const [project, setProject] = useState<Project | null>(null);
  const [floors, setFloors] = useState<Floor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Hidden viewer for floor mapping
  const [viewer, setViewer] = useState<Autodesk.Viewing.GuiViewer3D | null>(null);

  const { floorMappingReady, floorsWithElements } = useFloorIsolation({
    viewer,
    selectedFloorNumber: null,
    floors,
  });

  const modelUrn = isValidModelUrn(project?.building.modelUrn)
    ? project.building.modelUrn
    : isValidModelUrn(process.env.NEXT_PUBLIC_APS_MODEL_URN)
      ? process.env.NEXT_PUBLIC_APS_MODEL_URN
      : '';

  const displayFloors = useMemo(
    () =>
      floorMappingReady
        ? floors.filter((f) => floorsWithElements.has(f.floorNumber))
        : null,
    [floorMappingReady, floors, floorsWithElements]
  );

  useEffect(() => {
    const fetchData = async () => {
      try {
        const projectRes = await fetch(`/api/projects/${id}`);
        if (!projectRes.ok) throw new Error('Project not found');
        const projectData: Project = await projectRes.json();
        setProject(projectData);

        const floorsRes = await fetch(
          `/api/buildings/${projectData.buildingId}/floors`
        );
        if (!floorsRes.ok) throw new Error('Failed to fetch floors');
        const floorsData: Floor[] = await floorsRes.json();
        setFloors(floorsData.sort((a, b) => b.floorNumber - a.floorNumber));
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <p className="text-muted-foreground">読み込み中...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 bg-background min-h-screen">
        <p className="text-destructive">エラー: {error}</p>
        <Link href="/projects" className="mt-4 inline-block text-primary hover:underline">
          ← プロジェクト一覧に戻る
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Hidden viewer for floor element analysis */}
      {modelUrn && !floorMappingReady && (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            width: 1,
            height: 1,
            overflow: 'hidden',
            opacity: 0,
            pointerEvents: 'none',
          }}
        >
          <ApsViewer modelUrn={modelUrn} onViewerReady={setViewer} />
        </div>
      )}

      {/* Header */}
      <header className="bg-card border-b px-4 sm:px-6 py-4 sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2 overflow-x-auto whitespace-nowrap pb-1">
          <Link href="/projects" className="hover:text-primary transition-colors">
            プロジェクト一覧
          </Link>
          <span className="opacity-50">/</span>
          <span className="text-foreground/80">{project?.name}</span>
        </div>
        <h1 className="text-xl sm:text-2xl font-semibold text-foreground">{project?.name}</h1>
        <p className="text-sm text-muted-foreground mt-1">フロア一覧 — フロアを選択して3Dビューを開く</p>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        {displayFloors === null ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-6 h-6 rounded-full border-2 border-muted-foreground border-t-primary animate-spin" />
            <p className="text-muted-foreground text-sm">3Dモデルを解析中...</p>
          </div>
        ) : displayFloors.length === 0 ? (
          <p className="text-muted-foreground text-center py-16">構造物のあるフロアが見つかりません</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            <Link
              href={`/projects/${id}/viewer`}
              className="block group h-40"
            >
              <Card className="h-full bg-primary/10 hover:bg-primary/20 border-primary/30 hover:border-primary/60 transition-all text-center flex flex-col justify-center items-center shadow-sm group-hover:shadow-lg group-hover:shadow-primary/10">
                <p className="text-3xl font-bold group-hover:scale-110 group-hover:text-primary transition-all mb-3">全フロア</p>
                <CardContent className="p-0 w-full px-4">
                  <div className="flex items-center justify-center text-sm text-muted-foreground bg-black/20 w-full py-2 rounded-lg border border-white/5">
                    3Dビューを開く
                  </div>
                </CardContent>
              </Card>
            </Link>
            {displayFloors.map((floor) => (
              <Link
                key={floor.floorId}
                href={`/projects/${id}/viewer?floorId=${floor.floorId}`}
                className="block group h-40"
              >
                <Card className="h-full bg-neutral-900/40 hover:bg-neutral-900/80 border-neutral-800 hover:border-primary/50 transition-all text-center flex flex-col justify-center items-center shadow-sm group-hover:shadow-lg group-hover:shadow-primary/10">
                  <p className="text-3xl font-bold group-hover:scale-110 group-hover:text-primary transition-all mb-3">{floor.name}</p>
                  <CardContent className="p-0 w-full px-4">
                    <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground bg-black/20 w-full py-2 rounded-lg border border-white/5">
                      <span>指摘:</span>
                      <Badge variant={floor.issueCount > 0 ? "destructive" : "secondary"}>
                        {floor.issueCount} 件
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
