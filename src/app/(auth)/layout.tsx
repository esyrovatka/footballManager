import Link from 'next/link';
import type { ReactNode } from 'react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center bg-neutral-50 dark:bg-neutral-950 px-4 py-8">
      <Link href="/" className="text-xl font-semibold mb-6">
        Football Manager
      </Link>
      <div className="w-full max-w-sm rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 shadow-sm">
        {children}
      </div>
    </div>
  );
}
