/**
 * Formata valor para moeda brasileira (R$)
 */
export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
};

/**
 * Formata data para padrão brasileiro
 */
export const formatDate = (date: Date | string): string => {
  const d = new Date(date);
  return new Intl.DateTimeFormat('pt-BR').format(d);
};

/**
 * Formata data e hora para padrão brasileiro
 */
export const formatDateTime = (date: Date | string): string => {
  const d = new Date(date);
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(d);
};

/**
 * Gera números aleatórios únicos para jogos
 */
export const generateRandomNumbers = (
  count: number,
  min: number,
  max: number
): number[] => {
  const numbers = new Set<number>();
  
  while (numbers.size < count) {
    const random = Math.floor(Math.random() * (max - min + 1)) + min;
    numbers.add(random);
  }
  
  return Array.from(numbers).sort((a, b) => a - b);
};

/**
 * Verifica quantos acertos um jogo teve
 */
export const checkMatches = (
  gameNumbers: number[],
  resultNumbers: number[]
): number => {
  return gameNumbers.filter(n => resultNumbers.includes(n)).length;
};

/**
 * Classifica o resultado de um jogo
 */
export const getResultClassification = (matches: number, gameType: string): string => {
  const classifications: Record<string, Record<number, string>> = {
    'lotofacil': {
      15: '15 ACERTOS - PREMIAÇÃO MÁXIMA!',
      14: '14 ACERTOS - PREMIAÇÃO',
      13: '13 ACERTOS - PREMIAÇÃO',
      12: '12 ACERTOS - PREMIAÇÃO',
      11: '11 ACERTOS - PREMIAÇÃO'
    },
    'megasena': {
      6: 'SENA - PREMIAÇÃO MÁXIMA!',
      5: 'QUINA - PREMIAÇÃO',
      4: 'QUADRA - PREMIAÇÃO'
    },
    'quina': {
      5: 'QUINA - PREMIAÇÃO MÁXIMA!',
      4: 'QUADRA - PREMIAÇÃO',
      3: 'TERNO - PREMIAÇÃO'
    },
    'lotomania': {
      20: '20 ACERTOS - PREMIAÇÃO MÁXIMA!',
      19: '19 ACERTOS - PREMIAÇÃO',
      18: '18 ACERTOS - PREMIAÇÃO',
      17: '17 ACERTOS - PREMIAÇÃO',
      16: '16 ACERTOS - PREMIAÇÃO',
      0: 'ZERO ACERTOS - PREMIAÇÃO ESPECIAL!'
    }
  };
  
  const gameClass = classifications[gameType.toLowerCase()];
  if (!gameClass) return `${matches} ACERTOS`;
  
  return gameClass[matches] || `${matches} ACERTOS`;
};

/**
 * Calcula probabilidade de acerto
 */
export const calculateProbability = (
  totalNumbers: number,
  chooseNumbers: number,
  markedNumbers: number
): string => {
  const factorial = (n: number): number => {
    if (n <= 1) return 1;
    return n * factorial(n - 1);
  };
  
  const combinations = (n: number, k: number): number => {
    return factorial(n) / (factorial(k) * factorial(n - k));
  };
  
  const totalCombinations = combinations(totalNumbers, chooseNumbers);
  const probability = (1 / totalCombinations) * 100;
  
  return probability.toFixed(8) + '%';
};

/**
 * Máscara para CPF/CNPJ
 */
export const formatDocument = (document: string): string => {
  const cleaned = document.replace(/\D/g, '');
  
  if (cleaned.length === 11) {
    // CPF
    return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  } else if (cleaned.length === 14) {
    // CNPJ
    return cleaned.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  }
  
  return document;
};

/**
 * Máscara para telefone/celular
 */
export const formatPhone = (phone: string): string => {
  const cleaned = phone.replace(/\D/g, '');
  
  if (cleaned.length === 11) {
    return cleaned.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  } else if (cleaned.length === 10) {
    return cleaned.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  }
  
  return phone;
};

/**
 * Valida se é um email válido
 */
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Trunca texto com reticências
 */
export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

/**
 * Converte número por extenso (básico para valores de premiação)
 */
export const numberToWords = (num: number): string => {
  if (num >= 1000000) {
    const millions = Math.floor(num / 1000000);
    const remainder = num % 1000000;
    if (remainder === 0) {
      return `${millions} milhão${millions > 1 ? 'ões' : ''}`;
    }
    return `${millions} milhão${millions > 1 ? 'ões' : ''} e ${numberToWords(remainder)}`;
  }
  
  if (num >= 1000) {
    const thousands = Math.floor(num / 1000);
    const remainder = num % 1000;
    if (remainder === 0) {
      return `${thousands} mil`;
    }
    return `${thousands} mil e ${numberToWords(remainder)}`;
  }
  
  const units: string[] = [
    'zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'
  ];
  
  if (num < 10) return units[num];
  
  const teens: string[] = [
    'dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 
    'dezessete', 'dezoito', 'dezenove'
  ];
  
  if (num < 20) return teens[num - 10];
  
  const tens: string[] = [
    '', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 
    'sessenta', 'setenta', 'oitenta', 'noventa'
  ];
  
  const ten = Math.floor(num / 10);
  const unit = num % 10;
  
  if (unit === 0) return tens[ten];
  return `${tens[ten]} e ${units[unit]}`;
};
