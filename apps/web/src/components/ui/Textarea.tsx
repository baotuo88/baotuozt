import { TextareaHTMLAttributes } from 'react';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
}

export function Textarea({ label, className = '', ...props }: TextareaProps) {
  return (
    <label className="flex flex-col gap-2 font-semibold text-sm text-[#a3a3a3]">
      {label && <span>{label}</span>}
      <textarea
        className={`border border-[#2a2a2a] rounded-xl px-4 py-3 bg-[#141414] text-[#e5e5e5] transition-all min-h-[120px] resize-y leading-relaxed focus:outline-none focus:border-[#8b5cf6] focus:shadow-[0_0_0_3px_rgba(139,92,246,0.1)] ${className}`}
        {...props}
      />
    </label>
  );
}
