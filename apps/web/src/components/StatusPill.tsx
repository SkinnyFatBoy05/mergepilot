export function StatusPill({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "success" | "danger" }) {
  return <span className={`status status--${tone}`}>{children}</span>;
}
