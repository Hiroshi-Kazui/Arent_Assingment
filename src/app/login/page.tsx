import { Suspense } from 'react';
import LoginForm from './login-form';

export default function LoginPage() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="w-full max-w-sm p-8 space-y-6 bg-card border rounded-lg shadow-sm">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground">ログイン</h1>
          <p className="mt-2 text-sm text-muted-foreground">指摘管理ツール</p>
        </div>
        <Suspense fallback={<div className="h-40" />}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
