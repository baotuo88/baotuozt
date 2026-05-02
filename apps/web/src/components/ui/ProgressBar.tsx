interface ProgressBarProps {
  progress: number;
  label?: string;
}

export function ProgressBar({ progress, label }: ProgressBarProps) {
  return (
    <div className="mt-4">
      <div className="h-2 bg-[#141414] rounded-full overflow-hidden relative">
        <div
          className="h-full bg-gradient-to-r from-[#8b5cf6] to-[#06b6d4] rounded-full transition-all duration-300 relative overflow-hidden"
          style={{ width: `${progress}%` }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-[shimmer_2s_infinite]" />
        </div>
      </div>
      {label && (
        <div className="mt-2 text-sm text-[#a3a3a3] flex justify-between items-center">
          <span>{label}</span>
          <span>{progress}%</span>
        </div>
      )}
    </div>
  );
}
