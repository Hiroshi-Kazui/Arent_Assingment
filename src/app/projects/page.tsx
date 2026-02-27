'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Project {
  projectId: string;
  name: string;
  buildingId: string;
  status: string;
  issueCount: number;
  startDate: string;
  dueDate: string;
}

const STATUS_LABELS: Record<string, string> = {
  PLANNING: '計画中',
  ACTIVE: '進行中',
  COMPLETED: '完了',
};

const STATUS_COLORS: Record<string, string> = {
  PLANNING: 'bg-slate-100 text-slate-800',
  ACTIVE: 'bg-blue-100 text-blue-800',
  COMPLETED: 'bg-green-100 text-green-800',
};

export default function ProjectListPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/projects')
      .then((r) => r.json())
      .then((data) => {
        setProjects(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch((err) => {
        setError(String(err));
        setLoading(false);
      });
  }, []);

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
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <h1 className="text-xl font-semibold text-gray-900">指摘管理ツール</h1>
        <p className="text-sm text-gray-500 mt-1">プロジェクト一覧</p>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        {projects.length === 0 ? (
          <p className="text-gray-500 text-center py-16">プロジェクトが見つかりません</p>
        ) : (
          <div className="space-y-4">
            {projects.map((project) => (
              <Link
                key={project.projectId}
                href={`/projects/${project.projectId}/floors`}
                className="block bg-white rounded-lg border border-gray-200 p-5 hover:border-blue-400 hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-base font-semibold text-gray-900">{project.name}</h2>
                    <p className="text-sm text-gray-500 mt-1">ID: {project.projectId}</p>
                  </div>
                  <span
                    className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                      STATUS_COLORS[project.status] ?? 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {STATUS_LABELS[project.status] ?? project.status}
                  </span>
                </div>

                <div className="mt-3 flex items-center gap-6 text-sm text-gray-600">
                  <span>
                    指摘件数:{' '}
                    <span className="font-semibold text-gray-900">{project.issueCount}</span>
                  </span>
                  {project.startDate && (
                    <span>開始: {new Date(project.startDate).toLocaleDateString('ja-JP')}</span>
                  )}
                  {project.dueDate && (
                    <span>期限: {new Date(project.dueDate).toLocaleDateString('ja-JP')}</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
