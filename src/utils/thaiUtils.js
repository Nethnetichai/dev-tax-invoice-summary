/**
 * Thai Baht Text Conversion
 */
export const bahttext = (number) => {
  if (!number && number !== 0) return 'ศูนย์บาทถ้วน';
  const num = typeof number === 'string' ? parseFloat(number) : number;
  const numberStr = num.toFixed(2).split('.');
  const integerPart = numberStr[0];
  const decimalPart = numberStr[1];

  const numbers = ['ศูนย์', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];
  const units = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน', 'ล้าน'];

  const convert = (num) => {
    let text = '';
    const length = num.length;
    for (let i = 0; i < length; i++) {
      const digit = parseInt(num[i]);
      const pos = length - i - 1;
      if (digit !== 0) {
        if (pos % 6 === 0 && pos > 0) text += 'ล้าน';
        if (digit === 1 && pos % 6 === 0 && i !== 0) text += 'เอ็ด';
        else if (digit === 1 && pos % 6 === 1) text += '';
        else if (digit === 2 && pos % 6 === 1) text += 'ยี่';
        else text += numbers[digit];
        text += units[pos % 6];
      }
    }
    return text;
  };

  let result = convert(integerPart) + 'บาท';
  if (parseInt(decimalPart) === 0) {
    result += 'ถ้วน';
  } else {
    if (decimalPart === '01') result += 'หนึ่งสตางค์';
    else result += convert(decimalPart) + 'สตางค์';
  }

  return result || 'ศูนย์บาทถ้วน';
};

/**
 * Fix Thai tone marks and vowels overlapping for jsPDF
 * Reverts to basic reordering since PUA mapping was not supported by the embedded font.
 */
export const normalizeThaiPDF = (text) => {
  if (typeof text !== 'string') return text;

  let result = text;

  // 1. Handle Sara Am (ำ) - reorder if tone mark is before it
  result = result.replace(/([ก-ฮ])([่้๊๋])ำ/g, '$1ำ$2'); 

  // 2. Basic reordering of Tone Marks and Above Vowels
  // Correct order is Base + Above Vowel + Tone Mark
  // This helps jsPDF's basic engine stack them better
  return result
    .replace(/([ก-ฮ])([ิีึืั็])([่้๊๋์])/g, '$1$2$3')
    .replace(/([ก-ฮ])([่้๊๋์])([ิีึืั็])/g, '$1$3$2');
};
