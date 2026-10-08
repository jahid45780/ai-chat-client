export function BrandMark({ className = '' }: { className?: string }) {
  return <span className={`brand-mark ${className}`.trim()} aria-hidden="true">
    <svg viewBox="0 0 28 28" fill="none">
      <path d="M9 6.2h5.3a3.9 3.9 0 0 1 0 7.8H9" />
      <path d="M9 14h6a3.9 3.9 0 0 1 0 7.8H9V6.2" />
      <path className="brand-mark-break" d="M13.1 14h6.2" />
      <circle cx="21.1" cy="14" r="1.2" />
    </svg>
  </span>;
}
