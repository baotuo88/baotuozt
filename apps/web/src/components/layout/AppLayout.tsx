'use client';

import { ReactNode } from 'react';
import { TopNav } from './TopNav';

interface AppLayoutProps {
  children: ReactNode;
  showNav?: boolean;
}

export function AppLayout({ children, showNav = true }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {showNav && <TopNav />}
      <main>{children}</main>
    </div>
  );
}
