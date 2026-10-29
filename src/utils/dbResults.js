// Helpers for reading the result sets of a CALL made with mysql2.

// mysql2 returns DECIMAL columns (SUM(), ROUND(), AVG() ...) as strings.
// Convert them to numbers using the column types MySQL sends with each result set,
// so any new DECIMAL column an SP adds is converted without a code change.
const DECIMAL_COLUMN_TYPES = new Set([0, 246]); // DECIMAL, NEWDECIMAL

export const decimalsToNumbers = (rows, columns = []) => {
  const names = columns
    .filter((col) => DECIMAL_COLUMN_TYPES.has(col.columnType))
    .map((col) => col.name);
  if (names.length === 0) return rows;

  return rows.map((row) => {
    const out = { ...row };
    for (const name of names) {
      if (out[name] != null) out[name] = Number(out[name]);
    }
    return out;
  });
};

// Maps the result sets that follow the status row to named sections, in order.
// sections: [{ key, single? }] — single: true returns the first row as an object instead of an array.
// A result set the SP adds later is still returned as section_<n> (n = its position after
// the status row), so a new section shows up in the API before the list is updated.
export const mapResultSets = (results, fields, sections) => {
  // pair every result set with its column definitions, then drop CALL's trailing OkPacket
  const sets = results
    .slice(1)
    .map((rows, i) => ({ rows, columns: fields[i + 1] }))
    .filter((set) => Array.isArray(set.rows));

  const data = {};
  sets.forEach(({ rows, columns }, i) => {
    const section = sections[i] ?? { key: `section_${i + 1}` };
    const converted = decimalsToNumbers(rows, columns);
    data[section.key] = section.single ? converted[0] ?? null : converted;
  });

  return data;
};
