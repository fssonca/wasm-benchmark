export async function loadCSV(filePath) {
  const response = await fetch(filePath);
  const text = await response.text();
  const rows = text.split("\n").map((row) => row.split(","));

  const headers = rows[0];
  const data = rows.slice(1).map((row) => {
    let obj = {};
    headers.forEach((header, index) => {
      obj[header] = isNaN(row[index]) ? row[index] : parseFloat(row[index]);
    });
    return obj;
  });

  return data.filter((row) => row.date); // Remove empty rows
}
