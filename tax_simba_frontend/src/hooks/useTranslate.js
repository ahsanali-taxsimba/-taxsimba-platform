"use client";

import { useState, useEffect } from 'react';
import { useTranslation } from '@/context/TranslationContext';

export const useTranslate = (text) => {
  const { currentLanguage, translate } = useTranslation();
  const [translatedText, setTranslatedText] = useState(text);

  useEffect(() => {
    if (currentLanguage === 'en') {
      setTranslatedText(text);
      return;
    }

    let isMounted = true;

    const performTranslation = async () => {
      const result = await translate(text, currentLanguage);
      if (isMounted) {
        setTranslatedText(result);
      }
    };

    performTranslation();

    return () => {
      isMounted = false;
    };
  }, [text, currentLanguage, translate]);

  return translatedText;
};