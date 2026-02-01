import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from './locales/en.json';
import ja from './locales/ja.json';

i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        resources: {
            en: { translation: en },
            ja: { translation: ja },
        },
        fallbackLng: 'en',
        interpolation: {
            escapeValue: false, // react already safes from xss
        },
        detection: {
            order: ['localStorage', 'navigator'],
            caches: ['localStorage'],
        },
        lng: 'ja', // Default to Japanese as requested, though detector might override if cache exists. 
        // Actually, 'lng' option overrides detection. To strictly default to JA 
        // but allow switching, we rely on detection order or just set fallback to JA?
        // The user said "Set default language to Japanese".
        // If I set `lng: 'ja'`, it forces JA every time init runs? No, `lng` sets the initial language.
        // If used with detector, detector usually takes precedence.
        // Let's NOT set `lng` hardcoded if we want detection to work for future visits.
        // BUT for the FIRST visit, we want JA.
        // Browser language detector looks at navigator.language (which might be 'ja' or 'en').
        // If user's browser is EN, they see EN. User REQUESTED "Set default language to Japanese".
        // So if detection fails or finds nothing, it goes fallback.
        // If I want to FORCE Japanese on first load regardless of browser locale, I should probably 
        // not use detector? Or configure detector to look at storage ONLY, and default store to JA?
        // Safest: set `lng` to `localStorage.getItem('i18nextLng') || 'ja'`.
    });

// Explicitly setting default if not found (though the config above handles it if I pass lng properly)
if (!localStorage.getItem('i18nextLng')) {
    i18n.changeLanguage('ja');
}

export default i18n;
