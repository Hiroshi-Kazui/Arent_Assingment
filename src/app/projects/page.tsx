'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AuthHeader } from '@/app/components/auth-header';

interface Project {
  projectId: string;
  name: string;
  plan?: string;
  buildingId: string;
  status: string;
  issueCount: number;
  progressRate: number;
  startDate: string;
  dueDate: string;
}

const STATUS_LABELS: Record<string, string> = {
  PLANNING: '計画中',
  ACTIVE: '進行中',
  COMPLETED: '完了',
};

const STATUS_COLORS: Record<string, string> = {
  PLANNING: 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700 border-neutral-700',
  ACTIVE: 'bg-primary/20 text-primary hover:bg-primary/30 border-primary/30',
  COMPLETED: 'bg-blue-900/30 text-blue-400 hover:bg-blue-900/40 border-blue-800/50',
};

export default function ProjectListPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [navigatingId, setNavigatingId] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/projects')
      .then((r) => r.json())
      .then((data) => {
        setProjects(Array.isArray(data) ? data : data.items ?? []);
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
        <p className="text-muted-foreground">読み込み中...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <p className="text-destructive">エラー: {error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b px-4 sm:px-6 py-4 sticky top-0 z-10 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">指摘管理ツール</h1>
            <p className="text-sm text-muted-foreground mt-1">プロジェクト一覧</p>
          </div>
          <AuthHeader />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        {projects.length === 0 ? (
          <p className="text-muted-foreground text-center py-16">プロジェクトが見つかりません</p>
        ) : (
          <div className="space-y-4">
            {projects.map((project) => {
              const isNavigating = navigatingId === project.projectId && isPending;
              return (
              <div key={project.projectId} className="group">
                <button
                  type="button"
                  className="block w-full text-left"
                  onClick={() => {
                    setNavigatingId(project.projectId);
                    startTransition(() => {
                      router.push(`/projects/${project.projectId}/viewer`);
                    });
                  }}
                  disabled={isPending}
                >
                  <Card className={`bg-neutral-900/40 hover:bg-neutral-900/80 border-neutral-800 hover:border-primary/50 transition-all shadow-sm relative ${isNavigating ? 'opacity-60' : ''}`}>
                    {isNavigating && (
                      <div className="absolute inset-0 flex items-center justify-center z-10 rounded-lg bg-background/30">
                        <div className="w-5 h-5 rounded-full border-2 border-muted-foreground border-t-primary animate-spin" />
                      </div>
                    )}
                    <CardHeader className="pb-3 flex flex-row items-start justify-between space-y-0 gap-4">
                      <div>
                        <CardTitle className="text-lg group-hover:text-primary transition-colors">{project.name}</CardTitle>
                        <CardDescription className="font-mono text-xs mt-1">ID: {project.projectId}</CardDescription>
                      </div>
                      <Badge variant="outline" className={`shrink-0 ${STATUS_COLORS[project.status] ?? 'bg-neutral-800 text-neutral-300'}`}>
                        {STATUS_LABELS[project.status] ?? project.status}
                      </Badge>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground bg-black/20 p-3 rounded-lg border border-white/5">
                        <span className="flex items-center gap-1.5">
                          <span>指摘件数:</span>
                          <Badge variant="secondary" className="font-mono">{project.issueCount}</Badge>
                        </span>
                        {project.startDate && (
                          <span className="flex items-center gap-1.5">
                            <span>開始:</span> <span className="text-foreground/80">{new Date(project.startDate).toLocaleDateString('ja-JP')}</span>
                          </span>
                        )}
                        {project.dueDate && (
                          <span className="flex items-center gap-1.5">
                            <span>期限:</span> <span className="text-foreground/80">{new Date(project.dueDate).toLocaleDateString('ja-JP')}</span>
                          </span>
                        )}
                        {project.plan && (
                          <span className="flex items-center gap-1.5">
                            <span>計画:</span>
                            <span className="text-foreground/80 truncate max-w-[200px]">{project.plan}</span>
                          </span>
                        )}
                      </div>
                      {/* Progress Bar */}
                      <div className="mt-3">
                        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                          <span>進捗</span>
                          <span className="font-mono">{project.progressRate}%</span>
                        </div>
                        <div className="w-full bg-neutral-800 rounded-full h-2 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${project.progressRate}%`,
                              backgroundColor: project.progressRate >= 80 ? '#22c55e' : project.progressRate >= 40 ? '#eab308' : '#ef4444',
                            }}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </button>
              </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
