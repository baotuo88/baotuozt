import { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
}

export function Card({ children, className = '' }: CardProps) {
  return (
    <div className={`bg-[#1a1a1a] border border-[#2a2a2a] rounded-[20px] p-6 ${className}`}>
      {children}
    </div>
  );
}
