import './globals.css';
import { Toaster } from 'sonner';
import { SessionProvider } from './components/session-provider';

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
    <html lang="ja" className="dark" suppressHydrationWarning>
      <body className="bg-background text-foreground min-h-screen">
        <SessionProvider>{children}</SessionProvider>
        <Toaster theme="dark" position="top-right" richColors />
      </body>
    </html>
  );
}
