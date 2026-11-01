export function getReminderMinutes(count: number, quietStart: number, quietEnd: number): number[] {
  if (quietStart === quietEnd || count <= 0) return [];
  const allowed = (quietStart - quietEnd + 1440) % 1440;
  // Android may batch a daily alarm up to an hour after its requested time.
  const safeWindow = Math.max(0, allowed - 60);
  if (!safeWindow) return [];
  const size = Math.min(12, Math.floor(count));
  return Array.from({ length: size }, (_, index) =>
    Math.floor((quietEnd + ((index + 0.5) * safeWindow) / size) % 1440),
  ).sort((a, b) => a - b);
}
