export function LogoIcon({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const dot =
    size === "sm" ? "w-1.5 h-1.5" : size === "lg" ? "w-3 h-3" : "w-2 h-2";
  const gap = size === "sm" ? "gap-0.5" : size === "lg" ? "gap-1.5" : "gap-1";

  return (
    <span className={`inline-grid grid-cols-2 ${gap}`} aria-hidden>
      <span className={`${dot} rounded-full bg-[#007bff]`} />
      <span className={`${dot} rounded-full bg-gray-300`} />
      <span className={`${dot} rounded-full bg-gray-300`} />
      <span className={`${dot} rounded-full bg-gray-300`} />
    </span>
  );
}
