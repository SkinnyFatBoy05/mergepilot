export function DiffViewer({ diff }: { diff: string }) {
  return <div className="diff-wrap" tabIndex={0} aria-label="Unified code diff">
    <table className="diff"><tbody>{diff.split("\n").map((line, index) => {
      const kind = line.startsWith("+") && !line.startsWith("+++") ? "add" : line.startsWith("-") && !line.startsWith("---") ? "delete" : "context";
      return <tr className={`diff__${kind}`} key={`${index}-${line}`}><th scope="row">{index + 1}</th><td><span className="sr-only">{kind === "add" ? "Addition" : kind === "delete" ? "Deletion" : "Context"}: </span><code>{line || " "}</code></td></tr>;
    })}</tbody></table>
  </div>;
}
