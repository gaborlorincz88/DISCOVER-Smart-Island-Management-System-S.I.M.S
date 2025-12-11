/**
 * Politeness Filter Service
 * Detects inappropriate language and content in multiple languages
 */

// Common inappropriate words and phrases in multiple languages
const inappropriateWords = {
  // English
  en: [
    'fuck', 'shit', 'damn', 'bitch', 'asshole', 'bastard', 'cunt', 'piss', 'crap',
    'hell', 'bloody', 'fucking', 'shitty', 'damned', 'fucked', 'shitting',
    'bullshit', 'cocksucker', 'motherfucker', 'dickhead', 'prick', 'twat',
    'wanker', 'tosser', 'bellend', 'knobhead', 'arsehole', 'bugger', 'sod',
    'idiot', 'moron', 'stupid', 'dumb', 'retard', 'retarded', 'gay', 'fag',
    'nigger', 'nigga', 'chink', 'spic', 'kike', 'wetback', 'towelhead',
    'kill yourself', 'go die', 'fuck off', 'piss off', 'shut up', 'shut the fuck up',
    'fuck them', 'fuck you', 'fuck this', 'fuck that', 'fucking hell', 'what the fuck',
    'holy shit', 'oh shit', 'piece of shit', 'full of shit', 'shitty place'
  ],
  
  // Spanish
  es: [
    'joder', 'mierda', 'puta', 'puto', 'cabrón', 'cabrona', 'hijo de puta',
    'hija de puta', 'coño', 'cojones', 'hostia', 'ostia', 'gilipollas',
    'imbécil', 'idiota', 'estúpido', 'tonto', 'mamón', 'mamona', 'capullo',
    'capulla', 'maricón', 'marica', 'bollera', 'lesbiana', 'puto', 'puta',
    'jódete', 'vete a la mierda', 'cállate', 'calla', 'métete en tus asuntos'
  ],
  
  // French
  fr: [
    'merde', 'putain', 'putain de', 'con', 'conne', 'connard', 'connasse',
    'salope', 'salop', 'enculé', 'enculée', 'bite', 'chatte', 'cul',
    'foutre', 'baiser', 'niquer', 'bordel', 'putain de merde', 'ta gueule',
    'ferme ta gueule', 'va te faire foutre', 'va te faire enculer'
  ],
  
  // German
  de: [
    'scheiße', 'scheiß', 'ficken', 'fick', 'fick dich', 'arschloch', 'arsch',
    'hurensohn', 'hure', 'bitch', 'fotze', 'schwuchtel', 'schwul', 'schwule',
    'idiot', 'dumm', 'dummer', 'dumme', 'verpiss dich', 'halt die fresse',
    'verpiss dich', 'leck mich', 'leck mich am arsch'
  ],
  
  // Italian
  it: [
    'merda', 'cazzo', 'puttana', 'puttano', 'stronzo', 'stronza', 'coglione',
    'cogliona', 'frocio', 'frocia', 'ricchione', 'ricchiona', 'idiota',
    'stupido', 'stupida', 'scemo', 'scema', 'vaffanculo', 'vai a farti fottere',
    'stai zitto', 'taci', 'chiudi la bocca'
  ],
  
  // Portuguese
  pt: [
    'merda', 'porra', 'puta', 'puto', 'filho da puta', 'filha da puta',
    'caralho', 'cacete', 'buceta', 'cu', 'foder', 'fode', 'fodido',
    'fodida', 'idiota', 'estúpido', 'estúpida', 'burro', 'burra',
    'vai se foder', 'vai tomar no cu', 'cala a boca', 'cala-te'
  ],
  
  // Dutch
  nl: [
    'kut', 'klootzak', 'hoer', 'hoeren', 'neuken', 'neuk', 'geneukt',
    'lul', 'lulhannes', 'idioot', 'dom', 'domme', 'stom', 'stomme',
    'rot op', 'krijg de klere', 'hou je bek', 'hou je mond'
  ],
  
  // Russian
  ru: [
    'блять', 'блядь', 'сука', 'суки', 'хуй', 'хуйня', 'пизда', 'пиздец',
    'ебать', 'ебаный', 'ебаная', 'ебать', 'идиот', 'идиотка', 'дурак',
    'дура', 'тупой', 'тупая', 'иди нахуй', 'пошёл нахуй', 'заткнись'
  ],
  
  // Arabic
  ar: [
    'كلب', 'كلبة', 'حمار', 'حمارة', 'غبي', 'غبية', 'أحمق', 'أحمقة',
    'عاهر', 'عاهرة', 'ابن عاهر', 'ابنة عاهر', 'انتحر', 'اقتل نفسك'
  ],
  
  // Chinese (Simplified)
  zh: [
    '操', '草', '草泥马', '傻逼', '傻比', '煞笔', '沙比', '傻屄',
    '傻逼', '白痴', '智障', '脑残', '去死', '滚', '闭嘴'
  ],
  
  // Japanese
  ja: [
    'クソ', 'くそ', 'バカ', '馬鹿', 'アホ', 'あほ', '死ね', 'しね',
    'うざい', 'うざったい', 'キモい', 'きもい', 'うるさい', '黙れ'
  ],
  
  // Korean
  ko: [
    '씨발', '시발', '개새끼', '개새키', '지랄', '지랄하네', '병신',
    '멍청이', '바보', '죽어', '죽어라', '닥쳐', '닥치고'
  ]
};

// Patterns for detecting inappropriate content
const inappropriatePatterns = [
  // Excessive caps
  /[A-Z]{10,}/g,
  
  // Repeated characters (like "fuckkkkk")
  /(.)\1{4,}/g,
  
  // Phone numbers or personal info
  /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g,
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  
  // URLs
  /https?:\/\/[^\s]+/g,
  
  // Spam patterns
  /(.)\1{3,}/g,
  /\b(buy|sell|cheap|free|offer|deal|discount|promo|promotion)\b/gi
];

/**
 * Detect language of text (simple heuristic)
 */
function detectLanguage(text) {
  const textLower = text.toLowerCase();
  
  // Check for specific language patterns
  if (/[а-яё]/i.test(text)) return 'ru';
  if (/[一-龯]/i.test(text)) return 'zh';
  if (/[ひらがなカタカナ]/i.test(text)) return 'ja';
  if (/[가-힣]/i.test(text)) return 'ko';
  if (/[ا-ي]/i.test(text)) return 'ar';
  if (/[àáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿ]/i.test(text)) {
    if (/[ñ]/i.test(text)) return 'es';
    if (/[ç]/i.test(text)) return 'fr' || 'pt';
    if (/[äöüß]/i.test(text)) return 'de';
    if (/[àèéìíîòóù]/i.test(text)) return 'it';
    return 'fr'; // Default to French for accented characters
  }
  if (/[àáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿ]/i.test(text)) return 'pt';
  if (/[àáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿ]/i.test(text)) return 'nl';
  
  return 'en'; // Default to English
}

/**
 * Check if text contains inappropriate content
 */
function containsInappropriateContent(text) {
  if (!text || typeof text !== 'string') return { isInappropriate: false, reasons: [] };
  
  const textLower = text.toLowerCase().trim();
  const reasons = [];
  
  // Check for inappropriate words
  const detectedLanguage = detectLanguage(text);
  const words = inappropriateWords[detectedLanguage] || inappropriateWords.en;
  
  for (const word of words) {
    // Use a more flexible pattern that handles punctuation better
    const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(^|[^a-zA-Z])${escapedWord}([^a-zA-Z]|$)`, 'gi');
    if (regex.test(textLower)) {
      reasons.push(`Contains inappropriate language: "${word}"`);
    }
  }
  
  // Check for inappropriate patterns
  for (const pattern of inappropriatePatterns) {
    if (pattern.test(text)) {
      reasons.push(`Contains inappropriate pattern: ${pattern.source}`);
    }
  }
  
  // Check for excessive punctuation
  const punctuationCount = (text.match(/[!@#$%^&*()_+={}[\]|\\:";'<>?,./]/g) || []).length;
  if (punctuationCount > text.length * 0.3) {
    reasons.push('Excessive punctuation');
  }
  
  // Check for very short or very long content
  if (text.length < 3) {
    reasons.push('Content too short');
  }
  if (text.length > 1000) {
    reasons.push('Content too long');
  }
  
  // Check for repeated words
  const textWords = textLower.split(/\s+/);
  const wordCounts = {};
  textWords.forEach(word => {
    wordCounts[word] = (wordCounts[word] || 0) + 1;
  });
  
  for (const [word, count] of Object.entries(wordCounts)) {
    if (count > 5 && word.length > 2) {
      reasons.push(`Excessive repetition of word: "${word}"`);
    }
  }
  
  return {
    isInappropriate: reasons.length > 0,
    reasons: reasons,
    detectedLanguage: detectedLanguage
  };
}

/**
 * Get politeness score (0-100, higher is more impolite/less polite)
 */
function getPolitenessScore(text) {
  if (!text || typeof text !== 'string') return 0;
  
  const result = containsInappropriateContent(text);
  if (result.isInappropriate) {
    // High score for inappropriate content (red) - base score + reasons
    let score = 40; // Base score for inappropriate content
    score += result.reasons.length * 20; // Add 20 points per reason
    return Math.min(100, score);
  }
  
  // Low score for clean content (green)
  let score = 20;
  
  // Reduce score for positive words (making it even more polite/green)
  const positiveWords = ['good', 'great', 'excellent', 'amazing', 'wonderful', 'fantastic', 'love', 'enjoyed', 'recommend'];
  const positiveCount = positiveWords.filter(word => 
    text.toLowerCase().includes(word)
  ).length;
  score -= positiveCount * 5;
  
  // Reduce score for proper capitalization (making it more polite)
  if (text === text.charAt(0).toUpperCase() + text.slice(1).toLowerCase()) {
    score -= 5;
  }
  
  // Reduce score for appropriate length (making it more polite)
  if (text.length >= 10 && text.length <= 500) {
    score -= 5;
  }
  
  return Math.max(0, score);
}

module.exports = {
  containsInappropriateContent,
  getPolitenessScore,
  detectLanguage
};
