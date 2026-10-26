/**
 * mammoth HTML → flat text blocks, for docx-map.js. Works on browser DOM
 * elements and on node-html-parser elements (both have tagName,
 * textContent and querySelectorAll).
 */

const clean = (t) => (t || "").replace(/\s+/g, " ").trim();

function isHeadingLike(el, text) {
  // Many case studies use bold lines instead of Word heading styles.
  if (!text || text.length > 70 || /[.!?]$/.test(text)) return false;
  const strong = clean([...el.querySelectorAll("strong")].map((s) => s.textContent).join(""));
  return strong.length > 0 && strong === text;
}

export function elementsToBlocks(elements) {
  const blocks = [];
  const push = (type, text) => {
    const t = clean(text);
    if (t) blocks.push({ type, text: t });
  };
  for (const el of elements) {
    const tag = (el.tagName || "").toLowerCase();
    const text = el.textContent || "";
    if (/^h[1-6]$/.test(tag)) push("heading", text);
    else if (tag === "p") push(isHeadingLike(el, clean(text)) ? "heading" : "p", text);
    else if (tag === "ul" || tag === "ol") el.querySelectorAll("li").forEach((li) => push("li", li.textContent));
    else if (tag === "table") {
      for (const row of el.querySelectorAll("tr")) {
        const cells = [...row.querySelectorAll("td")].map((c) => clean(c.textContent)).filter(Boolean);
        if (cells.length === 2) push("p", `${cells[0].replace(/:$/, "")}: ${cells[1]}`);
        else if (cells.length) push("p", cells.join(" — "));
      }
    }
  }
  return blocks;
}
