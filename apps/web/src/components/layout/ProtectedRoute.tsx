'use client';

import { useEffect, useState, ReactNode } from 'react';
import { useRouter } from 'next/navigation';

interface ProtectedRouteProps {
  children: ReactNode;
  requireAdmin?: boolean;
}

export function ProtectedRoute({ children, requireAdmin = false }: ProtectedRouteProps) {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/auth');
      return;
    }

    if (requireAdmin) {
      fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => {
          if (data.role !== 'admin') {
            router.push('/dashboard');
          } else {
            setIsAuthorized(true);
          }
        })
        .catch(() => {
          localStorage.removeItem('token');
          router.push('/auth');
        });
    } else {
      setIsAuthorized(true);
    }
  }, [router, requireAdmin]);

  if (!isAuthorized) {
    return <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin w-8 h-8 border-2 border-[#2a2a2a] border-t-[#8b5cf6] rounded-full" />
    </div>;
  }

  return <>{children}</>;
}
