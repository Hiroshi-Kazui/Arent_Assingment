import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-xl border border-gray-200 p-10 max-w-md w-full text-center shadow-sm">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">指摘管理ツール</h1>
        <p className="text-gray-500 mb-8">施工現場向け 3D 指摘管理システム</p>

        <Link
          href="/projects"
          className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
        >
          プロジェクト一覧を開く →
        </Link>
      </div>
    </div>
  );
}
