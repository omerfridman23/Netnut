/** Format an ISO timestamp as a compact English date + time, e.g. "Jun 22, 11:01 PM". */
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
