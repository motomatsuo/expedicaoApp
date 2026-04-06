import { Suspense } from 'react';
import ListaBipagemPageClient from './lista-bipagem-page-client';

export default function ListaBipagemPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] flex-1 items-center justify-center bg-gray-50 p-8 text-sm text-gray-500">
          Carregando lista…
        </div>
      }
    >
      <ListaBipagemPageClient />
    </Suspense>
  );
}
