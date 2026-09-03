export function EvidencePanel({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return <section className={`evidence-panel ${className}`} aria-labelledby={`panel-${title.replaceAll(" ", "-")}`}>
    <h2 id={`panel-${title.replaceAll(" ", "-")}`}>{title}</h2>
    {children}
  </section>;
}
