/**
 * Format a date ISO string to a locale date string (e.g., "Jun 8, 2026")
 */
export const formatDate = (
  iso: string | null | undefined,
  options?: Intl.DateTimeFormatOptions,
): string => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      day: "numeric",
      month: "short",
      year: "numeric",
      ...options,
    });
  } catch {
    return "—";
  }
};

/**
 * Format a date ISO string to include time (e.g., "Jun 8, 2026, 2:30 PM")
 */
export const formatDateTime = (iso: string | null | undefined): string => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
};

/**
 * Check if a date falls within the current month
 */
export const isThisMonth = (iso: string): boolean => {
  const date = new Date(iso);
  const now = new Date();
  return (
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear()
  );
};

/**
 * Check if a date falls within the current quarter
 */
export const isThisQuarter = (iso: string): boolean => {
  const date = new Date(iso);
  const now = new Date();
  const dateQuarter = Math.floor(date.getMonth() / 3);
  const nowQuarter = Math.floor(now.getMonth() / 3);
  return dateQuarter === nowQuarter && date.getFullYear() === now.getFullYear();
};

/**
 * Check if a date falls within the current year
 */
export const isThisYear = (iso: string): boolean => {
  const date = new Date(iso);
  const now = new Date();
  return date.getFullYear() === now.getFullYear();
};

/**
 * Get the month name from an ISO date string
 */
export const getMonthName = (iso: string): string => {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      year: "numeric",
    });
  } catch {
    return "Unknown";
  }
};

/**
 * Generate and download a CSV file from an array of objects.
 * Headers are derived from the first object's keys if not provided.
 */
export function exportToCSV(
  filename: string,
  headers: string[],
  rows: Record<string, unknown>[],
  headerLabels?: Record<string, string>,
): void {
  if (rows.length === 0) return;

  const labels = headerLabels || {};
  const csvHeaders = headers.map((h) => labels[h] || h);
  const csvRows = rows.map((row) =>
    headers
      .map((h) => {
        const val = row[h];
        if (val === null || val === undefined) return "";
        const str = String(val);
        // Escape quotes and wrap in quotes if contains comma, quote, or newline
        if (str.includes(",") || str.includes('"') || str.includes("\n")) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      })
      .join(","),
  );

  const csv = [csvHeaders.join(","), ...csvRows].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename.replace(/[^a-zA-Z0-9_-]/g, "_")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
