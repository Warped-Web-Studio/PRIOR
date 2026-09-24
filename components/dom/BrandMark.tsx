/** The core-sample mark: a drilled rule with a single stratum break. */
export function CoreMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 12 40" aria-hidden="true" focusable="false">
      <rect x="5.4" y="0" width="1.2" height="24" fill="currentColor" />
      <rect x="0.5" y="26.4" width="11" height="0.9" fill="currentColor" />
      <rect x="5.4" y="29.6" width="1.2" height="10.4" fill="currentColor" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={`wordmark ${className ?? ""}`}>
      <CoreMark className="wordmark__mark" />
      <span className="wordmark__type">PRIOR</span>
    </span>
  );
}
