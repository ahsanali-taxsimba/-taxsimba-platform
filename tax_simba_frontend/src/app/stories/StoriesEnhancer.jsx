"use client";

import { useEffect, useRef } from "react";
import { enhanceStories } from "../../../taxsimba-stories/enhance.mjs";

export default function StoriesEnhancer({ html }) {
  const ref = useRef(null);
  useEffect(() => enhanceStories(ref.current), [html]);
  return <div ref={ref} dangerouslySetInnerHTML={{ __html: html }} />;
}
