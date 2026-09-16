"use client";

import { useTranslate } from "@/hooks/useTranslate";

const TranslatedText = ({ children, as: Component = "span", className = "mt-0 d-inline-block" }) => {
  const translatedText = useTranslate(children);
  return <Component className={className}>{translatedText}</Component>;
};

export default TranslatedText;