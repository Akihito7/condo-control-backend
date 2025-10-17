export function getFullMonthInterval(rawMonthStr: string) {
  // Remove aspas duplas, aspas simples e crases se existirem
  const cleanStr = rawMonthStr.trim().replace(/^["'`]+|["'`]+$/g, '');

  const [year, month] = cleanStr.split('-').map(Number);

  if (!year || !month) {
    throw new Error('Formato inválido de data: ' + rawMonthStr);
  }

  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0); // último dia do mês

  const formatDate = (date: Date) => date.toISOString().split('T')[0];

  return {
    startDate: formatDate(startDate),
    endDate: formatDate(endDate),
  };
}
