'use client';

import { useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

export default function WorkspaceRedirectPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const mode = searchParams.get('mode');

    const modeMap: Record<string, string> = {
      ecommerce: '/generate/ecommerce',
      social: '/generate/social',
      portrait: '/generate/portrait',
      general: '/generate/general',
    };

    const redirectTo = mode && modeMap[mode] ? modeMap[mode] : '/dashboard';
    router.replace(redirectTo);
  }, [searchParams, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
      <div className="text-center">
        <div className="animate-spin w-8 h-8 border-2 border-[#2a2a2a] border-t-[#8b5cf6] rounded-full mx-auto mb-4" />
        <p className="text-[#a3a3a3]">正在跳转...</p>
      </div>
    </div>
  );
}
