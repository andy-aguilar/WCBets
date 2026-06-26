export function toDecimalOdds(americanOdds: number): number {
  if (americanOdds > 0) {
    return 1 + americanOdds / 100;
  }

  return 1 + 100 / Math.abs(americanOdds);
}

export function formatAmericanOdds(odds: number | null): string {
  if (odds == null) return "—";
  if (odds > 0) return `+${odds}`;
  return String(odds);
}

export function formatEdge(
  modelOdds: number,
  marketOdds: number | null,
): string {
  if (marketOdds == null) return "—";

  const modelDecimal = toDecimalOdds(modelOdds);
  const marketDecimal = toDecimalOdds(marketOdds);
  const edge = (marketDecimal / modelDecimal - 1) * 100;

  return `${edge >= 0 ? "+" : ""}${edge.toFixed(1)}%`;
}

export function formatBookmaker(bookmaker: string | null): string {
  if (!bookmaker) return "No line";

  return bookmaker
    .replace(/ag$/i, ".ag")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
