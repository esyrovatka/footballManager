export function marketValueFromOverall(overall: number): number {
  return Math.round((overall * overall) / 80) * 1_000_000;
}

export function salaryFromOverall(overall: number): number {
  return Math.round(marketValueFromOverall(overall) * 0.005);
}
