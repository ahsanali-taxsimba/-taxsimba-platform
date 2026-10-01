export function classifyLinkType($anchor, htmlRel) {
  const rel = String(
    htmlRel ||
      ($anchor && typeof $anchor.attr === "function" ? $anchor.attr("rel") : "") ||
      "",
  ).toLowerCase();
  if (rel.includes("sponsored")) return "sponsored";
  if (rel.includes("ugc")) return "ugc";
  if (rel.includes("nofollow")) return "nofollow";
  return "dofollow";
}
