export function parseCurrencyBRL(
  value: string | undefined,
): number | undefined {
  if (!value) return undefined;

  const normalized = value
    .replace(/\./g, '') // remove separadores de milhar
    .replace(',', '.'); // troca vírgula decimal por ponto

  const parsed = Number(normalized);

  return isNaN(parsed) ? undefined : parsed;
}
