import './globals.css';

export const metadata = {
  title: 'Issue Management Tool',
  description: 'Construction site issue management',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className="bg-gray-50 text-gray-900">{children}</body>
    </html>
  );
}
