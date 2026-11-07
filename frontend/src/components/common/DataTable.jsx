export default function DataTable({ columns, data, loading = false, emptyMessage = 'No hay datos disponibles' }) {
  if (loading) {
    return (
      <div className="table-wrapper">
        <div className="loading-container">
          <div className="spinner" />
        </div>
      </div>
    )
  }

  if (!data || data.length === 0) {
    return (
      <div className="table-wrapper">
        <div className="empty-state">
          <p>{emptyMessage}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="table-wrapper">
      <table>
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key}>{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, idx) => (
            <tr key={idx}>
              {columns.map((col) => (
                <td key={col.key}>
                  {typeof col.render === 'function' ? col.render(row, col.key) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}