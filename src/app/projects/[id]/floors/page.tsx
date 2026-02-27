'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';

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

export default function FloorListPage({ params }: PageProps) {
  const { id } = use(params);
  const [project, setProject] = useState<Project | null>(null);
  const [floors, setFloors] = useState<Floor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // プロジェクト詳細を取得
        const projectRes = await fetch(`/api/projects/${id}`);
        if (!projectRes.ok) throw new Error('Project not found');
        const projectData: Project = await projectRes.json();
        setProject(projectData);

        // フロア一覧を取得
        const floorsRes = await fetch(
          `/api/buildings/${projectData.buildingId}/floors`
        );
        if (!floorsRes.ok) throw new Error('Failed to fetch floors');
        const floorsData: Floor[] = await floorsRes.json();
        setFloors(floorsData.sort((a, b) => a.floorNumber - b.floorNumber));
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
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">読み込み中...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <p className="text-red-600">エラー: {error}</p>
        <Link href="/projects" className="mt-4 inline-block text-blue-600 hover:underline">
          ← プロジェクト一覧に戻る
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
          <Link href="/projects" className="hover:text-blue-600">
            プロジェクト一覧
          </Link>
          <span>/</span>
          <span className="text-gray-900">{project?.name}</span>
        </div>
        <h1 className="text-xl font-semibold text-gray-900">{project?.name}</h1>
        <p className="text-sm text-gray-500 mt-1">フロア一覧 — フロアを選択して3Dビューを開く</p>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        {floors.length === 0 ? (
          <p className="text-gray-500 text-center py-16">フロアが見つかりません</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {floors.map((floor) => (
              <Link
                key={floor.floorId}
                href={`/projects/${id}/viewer?floorId=${floor.floorId}`}
                className="bg-white rounded-lg border border-gray-200 p-5 hover:border-blue-400 hover:shadow-sm transition-all text-center"
              >
                <p className="text-2xl font-bold text-gray-900">{floor.name}</p>
                <p className="text-sm text-gray-500 mt-2">
                  指摘:{' '}
                  <span
                    className={`font-semibold ${
                      floor.issueCount > 0 ? 'text-red-600' : 'text-gray-600'
                    }`}
                  >
                    {floor.issueCount}
                  </span>{' '}
                  件
                </p>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
