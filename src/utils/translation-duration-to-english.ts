export function translateComplexDurationToEnglish(duration: string): string {
  if (!duration || typeof duration !== 'string') return duration;

  const translations: { [key: string]: string } = {
    dia: 'day',
    dias: 'days',
    hora: 'hour',
    horas: 'hours',
    mês: 'month',
    meses: 'months',
    ano: 'year',
    anos: 'years',
    minuto: 'minute',
    minutos: 'minutes',
    segundo: 'second',
    segundos: 'seconds',
  };

  // Substitui " e " por espaço para unir as partes
  const cleaned = duration.toLowerCase().replace(/ e /g, ' ');

  // Expressão regular para capturar número + unidade
  const regex = /(\d+)\s*(\w+)/g;

  const translatedParts: string[] = [];
  let match;

  while ((match = regex.exec(cleaned)) !== null) {
    const quantity = match[1]; // número
    const unitPt = match[2]; // unidade (dia, horas, etc)
    const unitEn = translations[unitPt] ?? unitPt;
    translatedParts.push(`${quantity} ${unitEn}`);
  }

  return translatedParts.join(' ');
}
