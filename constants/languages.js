/**
 * Centralized definition of supported languages in HabitUp.
 *
 * Supported languages:
 * - en: English (Default)
 * - hi: Hindi
 * - te: Telugu
 * - ta: Tamil
 * - kn: Kannada
 * - ml: Malayalam
 * - bn: Bengali
 * - mr: Marathi
 * - gu: Gujarati
 */

const DEFAULT_LANGUAGE = 'en';

const SUPPORTED_LANGUAGES = Object.freeze([
  'en',
  'hi',
  'te',
  'ta',
  'kn',
  'ml',
  'bn',
  'mr',
  'gu',
]);

const SUPPORTED_LANGUAGE_SET = new Set(SUPPORTED_LANGUAGES);

/**
 * Validates whether a given language code is supported.
 *
 * @param {string} lang
 * @returns {boolean}
 */
function isValidLanguage(lang) {
  if (!lang || typeof lang !== 'string') return false;
  return SUPPORTED_LANGUAGE_SET.has(lang.trim().toLowerCase());
}

/**
 * Normalizes a language code. Returns valid lowercase code or default 'en'.
 *
 * @param {string} lang
 * @returns {string}
 */
function normalizeLanguage(lang) {
  if (isValidLanguage(lang)) {
    return lang.trim().toLowerCase();
  }
  return DEFAULT_LANGUAGE;
}

module.exports = {
  DEFAULT_LANGUAGE,
  SUPPORTED_LANGUAGES,
  isValidLanguage,
  normalizeLanguage,
};
