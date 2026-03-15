interface ComparisonSectionProps {
  label: string;
  title: string;
  subtitle: string;
  columns: { icon: string; name: string; role: string; highlight?: boolean }[];
  rows: { param: string; values: string[]; dim?: number[] }[];
  conclusion: string;
}

export function ComparisonSection({ label, title, subtitle, columns, rows, conclusion }: ComparisonSectionProps) {
  return (
    <section className="comparison">
      <div className="content-w">
        <p className="section-label">{label}</p>
        <h2 dangerouslySetInnerHTML={{ __html: title }} />
        <p className="comparison-sub" dangerouslySetInnerHTML={{ __html: subtitle }} />
        <div className="compare-table-wrap">
          <table className="compare-table">
            <thead>
              <tr>
                <th></th>
                {columns.map((col, i) => (
                  <th key={i} className={col.highlight ? "hl" : undefined}>
                    <span className="th-icon">{col.icon}</span>
                    {col.name}
                    <span className="th-role">{col.role}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri}>
                  <td>{row.param}</td>
                  {row.values.map((val, ci) => {
                    const isDim = row.dim?.includes(ci);
                    const isHl = columns[ci]?.highlight;
                    const cls = [isDim && "dim", isHl && "hl"].filter(Boolean).join(" ") || undefined;
                    return (
                      <td key={ci} className={cls}>
                        {val}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="table-conclusion">
          <p dangerouslySetInnerHTML={{ __html: conclusion }} />
        </div>
      </div>
    </section>
  );
}
