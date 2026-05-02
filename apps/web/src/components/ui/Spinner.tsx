export function Spinner({ size = 16 }: { size?: number }) {
  return (
    <div
      className="inline-block border-2 border-[#2a2a2a] border-t-[#8b5cf6] rounded-full animate-spin"
      style={{ width: size, height: size }}
    />
  );
}
