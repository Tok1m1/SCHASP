export default function SimpleTable({ rows }) {
  if (!rows || rows.length === 0) {
    return (
      <div className="emptyState">
        Нет данных.
      </div>
    );
  }

  const keys = Object.keys(rows[0]).slice(0, 8);

  const renderCell = (value) => {
    if (value == null) return "";

    if (Array.isArray(value)) {
      if (!value.length) return "—";

      // For arrays of objects (like plan items), show concise readable labels.
      if (typeof value[0] === "object" && value[0] !== null) {
        const labels = value
          .map((item) =>
            item?.title ||
            item?.name ||
            item?.label ||
            item?.subject ||
            item?.id
          )
          .filter(Boolean)
          .map(String);
        return labels.length ? labels.join("; ") : `${value.length} элементов`;
      }

      return value.map(String).join(", ");
    }

    if (typeof value === "object") {
      const label =
        value.title ||
        value.name ||
        value.fullName ||
        value.label ||
        value.email ||
        value.id;
      return label ? String(label) : "Объект";
    }

    return String(value);
  };

  return (
    <div className="tableWrap">
      <table className="table">
        <thead className="thead">
          <tr className="tr">
            {keys.map((k) => (
              <th key={k} className="th">
                {k}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="tbody">
          {rows.map((row, idx) => (
            <tr key={row.id || idx} className="tr">
              {keys.map((k) => (
                <td key={k} className="td">
                  {renderCell(row[k])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
