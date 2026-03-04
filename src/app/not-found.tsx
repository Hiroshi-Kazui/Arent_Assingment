export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h2 className="text-xl font-bold mb-4">ページが見つかりません</h2>
        <a href="/" className="text-blue-400 hover:underline">
          ホームに戻る
        </a>
      </div>
    </div>
  );
}
