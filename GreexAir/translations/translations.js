const fs   = require('fs');
const path = require('path');

const LOCALES_DIR    = path.join(__dirname, 'locales');
const ALLOWED_LANGS  = ['hu', 'en', 'de', 'hr', 'ro', 'ru', 'sk', 'sl', 'sr', 'uk'];
const DEFAULT_LANG   = 'hu';

const cache = {};

function loadLang(lang) {
    if (cache[lang]) return cache[lang];
    const file = path.join(LOCALES_DIR, `${lang}.json`);
    if (!fs.existsSync(file)) {
        console.warn(`[translations] Missing locale file: ${lang}.json — falling back to ${DEFAULT_LANG}`);
        return loadLang(DEFAULT_LANG);
    }
    try {
        cache[lang] = JSON.parse(fs.readFileSync(file, 'utf8'));
        return cache[lang];
    } catch (e) {
        console.error(`[translations] Failed to parse ${lang}.json:`, e.message);
        return cache[DEFAULT_LANG] || {};
    }
}

// Pre-load all locales at startup
ALLOWED_LANGS.forEach(loadLang);

/**
 * Returns the translation object for the given language code.
 * Falls back to Hungarian if the language is not supported.
 * @param {string} lang
 * @returns {Object}
 */
function getTr(lang) {
    const safe = ALLOWED_LANGS.includes(lang) ? lang : DEFAULT_LANG;
    return loadLang(safe);
}

module.exports = { getTr, ALLOWED_LANGS, DEFAULT_LANG };
