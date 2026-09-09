"use client";

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

// Decode any HTML entities returned by the translation API (e.g. &#39; or &quot;)
const decodeHtmlEntities = (value) => {
  if (typeof value !== 'string') {
    return value;
  }

  const textarea = document.createElement('textarea');
  textarea.innerHTML = value;
  return textarea.value;
};

const TranslationContext = createContext();

export const TranslationProvider = ({ children }) => {
  const [currentLanguage, setCurrentLanguage] = useState('en');
  const [isTranslating, setIsTranslating] = useState(false);
  const translationCacheRef = useRef({});
  const pendingTranslationsRef = useRef({});

  const translate = useCallback(async (text, targetLang = currentLanguage) => {
    if (typeof text !== 'string') {
      return text;
    }

    // Return original text if target is English
    if (targetLang === 'en' || !text || text.trim() === '') {
      return text;
    }

    // Create cache key
    const cacheKey = `${text}_${targetLang}`;

    // Return from cache if available
    if (translationCacheRef.current[cacheKey]) {
      return decodeHtmlEntities(translationCacheRef.current[cacheKey]);
    }

    // If there is already an in-flight request for this key, reuse it
    if (pendingTranslationsRef.current[cacheKey]) {
      return pendingTranslationsRef.current[cacheKey];
    }

    const translationPromise = (async () => {
      try {
        const response = await fetch('/frontend-api/translate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text: text,
            targetLanguage: targetLang,
            sourceLanguage: 'en',
          }),
        });

        const data = await response.json();
        console.log('Translation response data:', data?.translatedText);
        if (response.ok) {
          const translatedValue = typeof data?.translatedText === 'string' ? data.translatedText : text;
          const decodedTranslation = decodeHtmlEntities(translatedValue) ?? text;
          translationCacheRef.current[cacheKey] = decodedTranslation;
          return decodedTranslation;
        } else {
          console.error('Translation error:', data.error);
          return text; // Return original text on error
        }
      } catch (error) {
        console.error('Translation failed:', error);
        return text; // Return original text on error
      } finally {
        delete pendingTranslationsRef.current[cacheKey];
      }
    })();

    pendingTranslationsRef.current[cacheKey] = translationPromise;
    return translationPromise;
  }, [currentLanguage]);

  const changeLanguage = useCallback((langCode) => {
    setCurrentLanguage(langCode);
    setIsTranslating(true);
    // Reset translating state after a short delay
    setTimeout(() => setIsTranslating(false), 500);
  }, []);

  return (
    <TranslationContext.Provider
      value={{
        currentLanguage,
        changeLanguage,
        translate,
        isTranslating
      }}
    >
      {children}
    </TranslationContext.Provider>
  );
};

export const useTranslation = () => {
  const context = useContext(TranslationContext);
  if (!context) {
    throw new Error('useTranslation must be used within TranslationProvider');
  }
  return context;
};
