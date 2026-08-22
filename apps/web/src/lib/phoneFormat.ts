// Purely presentational digit grouping (e.g. "5551234567" + [3,3,2,2] ->
// "555-123-45-67") for phone number inputs that store/report plain digits.
// Never trims or pads — a still-being-typed number just ends mid-group.
export function formatGroupedDigits(digits: string, groupSizes: number[]): string {
  const groups: string[] = [];
  let i = 0;
  for (const size of groupSizes) {
    if (i >= digits.length) break;
    groups.push(digits.slice(i, i + size));
    i += size;
  }
  return groups.join("-");
}
