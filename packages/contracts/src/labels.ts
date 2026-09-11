// Single-pass tokenization prevents a short label from matching inside a previously inserted marker.
export function protectLabels(text: string, labels: string[]) {
  if (/__GUIDE_LABEL_\d+__/.test(text)) throw new Error('INVALID_INPUT');
  const ordered = [...new Set(labels)].filter(Boolean).sort((a, b) => b.length - a.length);
  const matches: { marker: string; text: string }[] = [];
  if (!ordered.length) return { text, restore: (translated: string) => translated };
  const pattern = new RegExp(ordered.map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'gu');
  const protectedText = text.replace(pattern, label => { const marker = `__GUIDE_LABEL_${matches.length}__`; matches.push({ marker, text: label }); return marker; });
  return {
    text: protectedText,
    restore(translated: string) {
      const found = translated.match(/__GUIDE_LABEL_\d+__/g) || [];
      if (found.length !== matches.length || matches.some(m => found.filter(f => f === m.marker).length !== 1)) throw new Error('LABEL_TRANSLATION_FAILED');
      return translated.replace(/__GUIDE_LABEL_\d+__/g, marker => matches.find(m => m.marker === marker)!.text);
    }
  };
}
