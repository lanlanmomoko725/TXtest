export function formatShortDate(value: Date | string | number) {
  const date = new Date(value);
  const year = String(date.getFullYear()).slice(-2);
  return `${year}-${date.getMonth() + 1}-${date.getDate()}`;
}

export function formatShortDateTime(value: Date | string | number) {
  const date = new Date(value);
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${formatShortDate(date)} ${hours}:${minutes}`;
}
