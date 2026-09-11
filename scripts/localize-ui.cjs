// Maintenance helper: inventory literal interface copy. No credentials or provider calls.
const ts = require('typescript');
const fs = require('node:fs');
const files = ['apps/web/app/page.tsx', ...['SafeContext', 'SpeechControls', 'AccountTools', 'FloatingPanel', 'ContextHelp', 'SpokenIntro', 'ImageReview'].map(name => `apps/web/components/${name}.tsx`)];
const texts = new Set();
const compiled = ts.transpileModule(fs.readFileSync('apps/web/lib/translations.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const scope = { exports: {} }; require('node:vm').runInNewContext(compiled, scope);
const translations = scope.exports.translations;
const unchanged = new Set(['d', 'Digital Assistant', 'English · हिन्दी · বাংলা · मराठी · తెలుగు · தமிழ் · اردو']);
for (const file of files) {
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const edits = new Map();
  const add = (node, text, jsx = false) => {
    texts.add(text); if (unchanged.has(text) || !translations[text]) return;
    const expression = `m(${JSON.stringify(text)})`;
    let replacement = jsx ? `{${expression}}` : expression;
    if (ts.isJsxText(node) && !node.text.includes('\n')) replacement = (/^\s/.test(node.text) ? "{' '}" : '') + replacement + (/\s$/.test(node.text) ? "{' '}" : '');
    edits.set(node.pos, { start: ts.isJsxText(node) ? node.pos : node.getStart(source), end: node.end, replacement });
  };
  function visit(node) {
    if (ts.isCallExpression(node) && node.expression.getText(source) === 'm' && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) texts.add(node.arguments[0].text);
    if (ts.isJsxText(node) && /[A-Za-z]/.test(node.text)) add(node, node.text.trim(), true);
    if (ts.isJsxAttribute(node) && ['aria-label', 'alt'].includes(node.name.getText(source)) && node.initializer && ts.isStringLiteral(node.initializer)) add(node.initializer, node.initializer.text, true);
    if (ts.isCallExpression(node) && ['setError', 'setStatus'].includes(node.expression.getText(source)) && node.arguments[0] && ts.isStringLiteral(node.arguments[0]) && node.arguments[0].text) add(node.arguments[0], node.arguments[0].text);
    if (ts.isConditionalExpression(node)) {
      let parent = node.parent; while (parent && !ts.isJsxExpression(parent) && !ts.isArrowFunction(parent)) parent = parent.parent;
      if (parent && ts.isJsxExpression(parent) && !ts.isJsxAttribute(parent.parent)) for (const part of [node.whenTrue, node.whenFalse]) if (ts.isStringLiteral(part) && /[A-Za-z]/.test(part.text)) add(part, part.text);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  if (process.argv.includes('--write')) {
    let content = source.text;
    for (const edit of [...edits.values()].sort((a, b) => b.start - a.start)) content = content.slice(0, edit.start) + edit.replacement + content.slice(edit.end);
    fs.writeFileSync(file, content.replaceAll('lang="en"', 'lang={uiLocale}'));
  }
}
const missing = [...texts].filter(text => !translations[text] && !unchanged.has(text));
console.log(JSON.stringify({ literalCount: texts.size, missing }, null, 2));
if (missing.length) process.exitCode = 1;
