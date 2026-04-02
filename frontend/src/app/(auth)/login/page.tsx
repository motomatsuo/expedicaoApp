import { LoginForm } from '@/features/auth/components/login-form';

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-app p-4 md:p-6 lg:p-8">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-md items-center justify-center">
        <div className="w-full">
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
