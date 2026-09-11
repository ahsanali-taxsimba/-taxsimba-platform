"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "@/context/TranslationContext";

function splitWhitespace(value) {
  const match = value.match(/^(\s*)([\s\S]*?)(\s*)$/);
  return {
    leading: match?.[1] ?? "",
    content: match?.[2] ?? "",
    trailing: match?.[3] ?? "",
  };
}

async function translateHtmlPreservingMarkup(html, translate, targetLang) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div id="__rt">${html}</div>`, "text/html");
  const root = doc.getElementById("__rt");
  if (!root) return html;

  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes = [];
  const uniqueSegments = new Map();

  let node = walker.nextNode();
  while (node) {
    const original = node.nodeValue ?? "";
    const { content } = splitWhitespace(original);
    if (content.trim() !== "") {
      textNodes.push(node);
      if (!uniqueSegments.has(content)) uniqueSegments.set(content, null);
    }
    node = walker.nextNode();
  }

  const segments = Array.from(uniqueSegments.keys());
  const translations = await Promise.all(
    segments.map(async (segment) => {
      const translated = await translate(segment, targetLang);
      return [segment, translated];
    })
  );

  const translationMap = new Map(translations);

  for (const textNode of textNodes) {
    const original = textNode.nodeValue ?? "";
    const { leading, content, trailing } = splitWhitespace(original);
    const translated = translationMap.get(content) ?? content;
    textNode.nodeValue = `${leading}${translated}${trailing}`;
  }

  return root.innerHTML;
}

export default function TranslatedRichText({ html = "", className = "", as: Component = "div" }) {
  const { currentLanguage, translate } = useTranslation();
  const [renderHtml, setRenderHtml] = useState(html);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (currentLanguage === "en") {
        setRenderHtml(html);
        return;
      }

      try {
        const translatedHtml = await translateHtmlPreservingMarkup(html, translate, currentLanguage);
        if (!cancelled) setRenderHtml(translatedHtml);
      } catch (err) {
        console.error("Rich text translation failed", err);
        if (!cancelled) setRenderHtml(html);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [currentLanguage, html, translate]);

  return <Component className={className} dangerouslySetInnerHTML={{ __html: renderHtml }} />;
}

