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
  const edge = getEdgePercent(modelOdds, marketOdds);
  if (edge == null) return "—";
  return `${edge >= 0 ? "+" : ""}${edge.toFixed(1)}%`;
}

export function formatBookmaker(bookmaker: string | null): string {
  if (!bookmaker) return "No line";

  return bookmaker
    .replace(/ag$/i, ".ag")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function getEdgePercent(
  modelOdds: number,
  marketOdds: number | null,
): number | null {
  if (marketOdds == null) return null;

  const modelDecimal = toDecimalOdds(modelOdds);
  const marketDecimal = toDecimalOdds(marketOdds);
  return (marketDecimal / modelDecimal - 1) * 100;
}

export function getKellyFraction(
  modelProbability: number,
  marketOdds: number | null,
): number {
  if (marketOdds == null) return 0;

  const decimalOdds = toDecimalOdds(marketOdds);
  const b = decimalOdds - 1;
  const p = modelProbability;
  const q = 1 - p;
  const kelly = (b * p - q) / b;

  return kelly > 0 ? kelly : 0;
}

export function formatCurrency(value: number | null): string {
  if (value == null || Number.isNaN(value)) return "—";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}
