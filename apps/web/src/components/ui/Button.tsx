import { ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
}

export function Button({ variant = 'primary', className = '', ...props }: ButtonProps) {
  const baseStyle = 'border-none rounded-xl px-6 py-3.5 font-bold cursor-pointer transition-all text-[15px]';
  const variants = {
    primary: 'bg-gradient-to-br from-[#8b5cf6] to-[#7c3aed] text-white hover:translate-y-[-2px] hover:shadow-[0_8px_24px_rgba(139,92,246,0.3)]',
    secondary: 'bg-[#1a1a1a] text-[#e5e5e5] border border-[#2a2a2a] hover:bg-[#222]',
    danger: 'bg-[#ef4444] text-white hover:bg-[#dc2626]'
  };

  return (
    <button
      className={`${baseStyle} ${variants[variant]} ${className} disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none`}
      {...props}
    />
  );
}
