const translations = await fetch(new URL('./locale.json', import.meta.url)).then(response => response.json());
const originals = new WeakMap();
const attributes = new WeakMap();
const ignored = 'script,style,code,pre,svg';
let language = localStorage.getItem('studio-language') === 'en' ? 'en' : 'pt';

function translateText(node) {
  if (node.parentElement?.closest(ignored)) return;
  const current = node.nodeValue?.trim();
  if (!current) return;
  let original = originals.get(node) || current;
  let entry = translations[original];
  if (entry && current !== original && current !== entry.pt && current !== entry.en) {
    original = current;
    entry = translations[original];
  }
  if (!entry) return;
  originals.set(node, original);
  const replacement = entry[language] || original;
  if (replacement !== current) node.nodeValue = node.nodeValue.replace(current, replacement);
}

function translateElement(element) {
  if (element.closest(ignored)) return;
  let saved = attributes.get(element);
  if (!saved) { saved = {}; attributes.set(element, saved); }
  for (const name of ['aria-label', 'placeholder', 'title', 'data-placeholder']) {
    const current = element.getAttribute(name);
    if (!current) continue;
    let original = saved[name] || current;
    let entry = translations[original];
    if (entry && current !== original && current !== entry.pt && current !== entry.en) {
      original = current;
      entry = translations[original];
    }
    if (!entry) continue;
    saved[name] = original;
    const replacement = entry[language] || original;
    if (replacement !== current) element.setAttribute(name, replacement);
  }
}

function translateTree(root) {
  if (root.nodeType === Node.TEXT_NODE) return translateText(root);
  if (root.nodeType !== Node.ELEMENT_NODE || root.closest(ignored)) return;
  translateElement(root);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    if (walker.currentNode.nodeType === Node.TEXT_NODE) translateText(walker.currentNode);
    else translateElement(walker.currentNode);
  }
}

const selector = document.createElement('select');
selector.setAttribute('aria-label', 'Idioma / Language');
selector.innerHTML = '<option value="pt">Português</option><option value="en">English</option>';
selector.value = language;
selector.style.cssText = 'position:fixed;right:1rem;bottom:1rem;z-index:9999;padding:.5rem .75rem;border:1px solid #777;border-radius:.7rem;background:#19191d;color:#fff;font:600 13px system-ui;box-shadow:0 4px 18px #0008';
selector.addEventListener('change', () => {
  language = selector.value;
  localStorage.setItem('studio-language', language);
  document.documentElement.lang = language === 'pt' ? 'pt-BR' : 'en';
  translateTree(document.body);
});
document.body.append(selector);
document.documentElement.lang = language === 'pt' ? 'pt-BR' : 'en';
translateTree(document.body);
new MutationObserver(records => {
  for (const record of records) {
    if (record.type === 'characterData') translateText(record.target);
    else if (record.type === 'attributes') translateElement(record.target);
    else for (const node of record.addedNodes) translateTree(node);
  }
}).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['aria-label', 'placeholder', 'title', 'data-placeholder'] });
