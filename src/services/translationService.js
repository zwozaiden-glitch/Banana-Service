import { config } from '../config.js';

export const SUPPORTED_LANGUAGES = [
  { code: 'fr', name: 'French' },
  { code: 'es', name: 'Spanish' },
  { code: 'de', name: 'German' },
  { code: 'it', name: 'Italian' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'ja', name: 'Japanese' },
  { code: 'zh', name: 'Chinese' },
  { code: 'ru', name: 'Russian' },
  { code: 'ko', name: 'Korean' },
  { code: 'ar', name: 'Arabic' },
  { code: 'id', name: 'Indonesian' },
  { code: 'en', name: 'English' },
];

export class TranslationService {
  /**
   * Protects code blocks, URLs, mentions, emojis with tokens
   */
  static tokenizeText(text) {
    const tokens = [];
    let tokenIndex = 0;

    const patterns = [
      /```[\s\S]*?```/g,                       // Multi-line code blocks
      /`[^`\n]+`/g,                            // Inline code
      /<(a)?:[a-zA-Z0-9_]+:\d{17,20}>/g,      // Discord custom emojis
      /<@[!&]?\d{17,20}>/g,                    // Mentions (users/roles)
      /<#\d{17,20}>/g,                         // Channel mentions
      /https?:\/\/[^\s<>()]+/g,                // URLs
    ];

    let processed = text;
    for (const pattern of patterns) {
      processed = processed.replace(pattern, (match) => {
        const token = `__BANANA_TKN_${tokenIndex}__`;
        tokens.push({ token, original: match });
        tokenIndex++;
        return token;
      });
    }

    return { processed, tokens };
  }

  /**
   * Restores preserved tokens in translated text
   */
  static detokenizeText(translatedText, tokens) {
    let result = translatedText;
    for (const { token, original } of tokens) {
      // Look for the token or variations caused by translation whitespace
      const escaped = token.replace(/_/g, '[_\\s]*');
      const regex = new RegExp(token, 'gi');
      result = result.replace(regex, original);
    }
    return result;
  }

  /**
   * Real translation via LibreTranslate API or Google Translate fallback
   */
  static async translateText(text, targetLang = 'fr', sourceLang = 'auto') {
    if (!text || text.trim().length === 0) {
      return '';
    }

    const { processed, tokens } = this.tokenizeText(text);

    let translated = null;

    // 1. Try LibreTranslate if configured
    if (config.translation.apiUrl) {
      try {
        const body = {
          q: processed,
          source: sourceLang,
          target: targetLang,
          format: 'text',
        };
        if (config.translation.apiKey) {
          body.api_key = config.translation.apiKey;
        }

        const res = await fetch(config.translation.apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(6000),
        });

        if (res.ok) {
          const data = await res.json();
          if (data && data.translatedText) {
            translated = data.translatedText;
          }
        }
      } catch (err) {
        // Fall through to fallback
      }
    }

    // 2. High-reliability fallback using free Google Translate endpoint
    if (!translated) {
      try {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&q=${encodeURIComponent(processed)}`;
        const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && Array.isArray(data[0])) {
            translated = data[0].map(item => item[0]).join('');
          }
        }
      } catch (err) {
        // Fallback to MyMemory translation API
      }
    }

    // 3. Third fallback: MyMemory free translation API
    if (!translated) {
      try {
        const pair = `${sourceLang === 'auto' ? 'en' : sourceLang}|${targetLang}`;
        const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(processed)}&langpair=${pair}`;
        const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
        if (res.ok) {
          const data = await res.json();
          if (data && data.responseData && data.responseData.translatedText) {
            translated = data.responseData.translatedText;
          }
        }
      } catch (err) {
        console.error('All translation providers failed:', err);
      }
    }

    if (!translated) {
      throw new Error('Translation service is temporarily unavailable. Please try again later.');
    }

    // Reconstruct preserved code blocks and formatting
    return this.detokenizeText(translated, tokens);
  }
}
