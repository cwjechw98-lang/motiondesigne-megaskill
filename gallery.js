/* Standalone, dependency-free. No host mutation or execution.
 * Optional postMessage draft handoff: see docs/integration-contract.md.
 * Clipboard and manual selection remain available without a host.
 */
(() => {
  'use strict';
  const data = window.MOTION_LIBRARY || {};
  const styles = Array.isArray(data.styles) ? data.styles.filter(item => item && typeof item.id === 'string') : [];
  const depths = Array.isArray(data.depths) ? data.depths.filter(item => item && typeof item.id === 'string') : [];
  const sources = Array.isArray(data.sources) ? data.sources : [];
  const $ = id => document.getElementById(id);
  const text = value => typeof value === 'string' ? value : '';
  const originLabel = item => item.collection === 'foundations' ? 'Классика' : 'Эксперимент';
  // A host must explicitly opt in AND name an exact HTTP(S) origin.
  const params = new URLSearchParams(location.search);
  let targetOrigin = '';
  try {
    const candidate = new URL(params.get('parentOrigin') || window.MOTION_LIBRARY_PARENT_ORIGIN || '');
    if (['http:', 'https:'].includes(candidate.protocol) && candidate.href === `${candidate.origin}/`) targetOrigin = candidate.origin;
  } catch { /* No exact origin: copy-only mode, including local file parents. */ }
  const integration = window.parent !== window && !!targetOrigin && (window.MOTION_LIBRARY_INTEGRATION === 'postmessage' || params.get('integration') === 'postmessage');
  const MAX_PROMPT = 16000;
  const node = (tag, className, value) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (value !== undefined) element.textContent = value;
    return element;
  };
  // Trusted repository previews only: no traversal, remote URLs or data SVG.
  function imagePath(value) {
    const path = text(value);
    return /^assets\/presets\/[a-zA-Z0-9_-]+\.(?:svg|webp|png|jpe?g|avif)$/i.test(path) ? path : '';
  }
  function setImage(image, item, label) {
    image.alt = `${label}: ${text(item.name)}. Статическая иллюстрация, не анимация.`;
    const fallback = image.parentElement && image.parentElement.querySelector('.image-unavailable');
    const showResult = loaded => {
      image.hidden = !loaded;
      if (fallback) fallback.hidden = loaded;
    };
    // Install handlers before src; cached assets may finish immediately.
    image.onload = () => showResult(image.naturalWidth > 0);
    image.onerror = () => showResult(false);
    image.hidden = true;
    if (fallback) fallback.hidden = true;
    const path = imagePath(item.image);
    if (path) {
      image.src = path;
      if (image.complete) showResult(image.naturalWidth > 0);
    } else { image.removeAttribute('src'); showResult(false); }
  }
  function addSources(container, entries) {
    container.replaceChildren();
    if (!Array.isArray(entries) || !entries.length) return;
    const list = node('ul', 'source-list');
    entries.forEach(entry => {
      const source = typeof entry === 'string' ? sources.find(item => item && (item.id === entry || item.url === entry)) || { name: entry, url: entry } : entry;
      if (!source || typeof source !== 'object') return;
      const title = text(source.name) || text(source.title) || text(source.id) || 'Источник';
      const row = node('li');
      let url;
      try { url = new URL(text(source.url)); } catch { /* References without URLs remain plain text. */ }
      if (url && ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password) {
        const link = node('a', '', title);
        link.href = url.href;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        row.append(link);
      } else row.textContent = title;
      list.append(row);
    });
    if (list.children.length) container.append(node('h3', 'source-heading', 'Материалы и источники'), list);
  }
  function makeComposer(container, style) {
    const prefix = style ? 'style' : 'free';
    container.replaceChildren(node('h3', '', 'Ваш промпт'));
    const depthLabel = node('label', '', 'Пространство — по желанию');
    const select = node('select');
    select.id = `${prefix}-depth`;
    select.append(new Option('Не задавать глубину', ''));
    depths.forEach(depth => select.append(new Option(text(depth.name), depth.id)));
    depthLabel.append(select);
    const depthFigure = node('figure', 'depth-preview');
    depthFigure.hidden = true;
    const depthImage = node('img');
    const depthCaption = node('figcaption');
    depthFigure.append(depthImage, depthCaption);
    const briefLabel = node('label', '', 'Ваша задача');
    const brief = node('textarea');
    brief.id = `${prefix}-brief`;
    brief.rows = 3;
    brief.maxLength = 8000;
    brief.placeholder = 'О чём ролик, для кого, что важно показать? Формат и длительность — если уже определены.';
    briefLabel.append(brief);
    const promptLabel = node('label', 'prompt-field', 'Точный промпт для копирования');
    const prompt = node('textarea');
    prompt.id = `${prefix}-prompt`;
    prompt.readOnly = true;
    prompt.rows = 9;
    prompt.spellcheck = false;
    promptLabel.append(prompt);
    const hint = node('p', 'hint', 'Это редактируемый бриф для самостоятельной работы, не готовый фильм. Выберите подходящий инструмент отдельно: галерея ничего не запускает и не обещает возможности рендера.');
    const actions = node('div', 'composer-actions');
    const copy = node('button', 'button', 'Копировать промпт');
    copy.type = 'button';
    const status = node('p', 'copy-status');
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    copy.addEventListener('click', async () => {
      status.textContent = '';
      let copied = false;
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(prompt.value);
          copied = true;
        }
      } catch { /* file://, iframe permissions or clipboard denial: use selection fallback. */ }
      if (!copied) {
        prompt.focus();
        prompt.select();
        prompt.setSelectionRange(0, prompt.value.length);
        try { copied = document.execCommand('copy'); } catch { copied = false; }
      }
      status.textContent = copied ? 'Промпт скопирован.' : 'Автокопирование недоступно. Текст выделен: нажмите Ctrl+C или ⌘C; на телефоне выберите «Копировать».';
    });
    actions.append(copy);
    if (integration) {
      const apply = node('button', 'button secondary', 'Передать черновик');
      apply.type = 'button';
      apply.addEventListener('click', () => {
        if (prompt.value.length > MAX_PROMPT) { status.textContent = 'Черновик слишком длинный для передачи. Сократите бриф или скопируйте текст.'; return; }
        window.parent.postMessage({ type: 'motion-library:apply', version: 1, action: 'draft', prompt: prompt.value }, targetOrigin);
        status.textContent = 'Черновик передан окну-хосту; доставка не подтверждена. Отправка в чат и выполнение не запрашивались.';
      });
      actions.append(apply);
    }
    container.append(depthLabel, depthFigure, briefLabel, promptLabel, hint, actions, status);
    function update() {
      const depth = depths.find(item => item.id === select.value);
      const base = style ? `Визуальное направление (${text(style.name)}):\n${text(style.description)}` : 'Разработай оригинальную motion-композицию по моему брифу. Используй references/creative-grammar.md как вспомогательную грамматику: выбери формы, материал, типографику, свет, камеру и ритм под смысл задачи. Не копируй чужие работы. Уточни недостающие существенные параметры. Предложи решение без предположений о доступных инструментах и рендерах.';
      const parts = [base];
      if (depth) parts.push(`Пространственная подача (${text(depth.name)}):\n${text(depth.description)}`);
      if (brief.value.trim()) parts.push(`Мой бриф:\n${brief.value.trim()}`);
      prompt.value = parts.join('\n\n');
      status.textContent = '';
      depthFigure.hidden = !depth;
      if (depth) {
        setImage(depthImage, depth, 'Пространственная подача');
        depthCaption.replaceChildren(node('strong', '', text(depth.name)), document.createTextNode(text(depth.description)));
      }
    }
    select.addEventListener('change', update);
    brief.addEventListener('input', update);
    update();
  }
  let opener;
  const dialog = $('style-dialog');
  function openStyle(style, button) {
    opener = button;
    $('dialog-title').textContent = text(style.name);
    $('dialog-origin').textContent = originLabel(style);
    $('dialog-description').textContent = text(style.description);
    setImage($('dialog-image'), style, 'Статическое превью стиля');
    const authored = style.previewKind === 'authored-svg';
    $('image-kind').textContent = authored ? 'Собственная векторная демонстрация · не анимация' : 'AI-generated: статическая иллюстрация направления · не анимация';
    $('dialog-disclaimer').textContent = authored
      ? 'Авторская SVG-демонстрация визуальных принципов. Это статическое превью собственной рецептуры, не видеоролик и не результат рендера.'
      : 'Статическая иллюстрация, созданная с помощью AI для собственного визуального направления. Это не видеоролик, не проверка анимации и не гарантия результата выбранного инструмента.';
    addSources($('dialog-sources'), style.sources);
    makeComposer($('dialog-composer'), style);
    dialog.showModal();
    document.body.classList.add('dialog-open');
    dialog.scrollTop = 0;
  }
  $('close-dialog').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => {
    document.body.classList.remove('dialog-open');
    if (opener && opener.isConnected) opener.focus();
  });
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
  });
  const category = $('category');
  [...new Set(styles.map(style => text(style.category)).filter(Boolean))].sort((a,b) => a.localeCompare(b,'ru')).forEach(value => category.append(new Option(value,value)));
  function render() {
    const query = $('search').value.trim().toLocaleLowerCase('ru');
    const visible = styles.filter(style => (!category.value || style.category === category.value)
      && (!$('origin').value || style.collection === $('origin').value)
      && [style.name,style.description,style.category,...(Array.isArray(style.tags) ? style.tags : [])].map(text).join(' ').toLocaleLowerCase('ru').includes(query));
    $('gallery').replaceChildren();
    visible.forEach(style => {
      const article = node('article','style-card');
      const button = node('button','card-button');
      button.type = 'button';
      button.setAttribute('aria-haspopup','dialog');
      button.setAttribute('aria-label',`Открыть направление «${text(style.name)}»`);
      const imageBox = node('div','card-image');
      const image = node('img');
      image.loading = 'lazy';
      image.decoding = 'async';
      imageBox.append(node('span','image-unavailable','Превью недоступно'),image);
      setImage(image,style,'Статическое превью стиля');
      const heading = node('div','card-heading');
      heading.append(node('h3','',text(style.name)),node('span','card-number',String(styles.indexOf(style)+1).padStart(2,'0')));
      button.append(imageBox,heading);
      button.addEventListener('click',() => openStyle(style,button));
      const meta = node('div','card-meta');
      meta.append(node('span',`badge ${style.origin === 'original' ? 'original' : ''}`,originLabel(style)));
      if (text(style.category)) meta.append(node('span','badge',style.category));
      meta.append(node('span','static-label','Статическое превью стиля'));
      article.append(button,node('p','card-description',text(style.description)),meta);
      $('gallery').append(article);
    });
    $('result-count').textContent = `Показано ${visible.length} из ${styles.length}`;
    $('empty').hidden = visible.length > 0 || !styles.length;
  }
  ['search','category','origin'].forEach(id => $(id).addEventListener(id === 'search' ? 'input' : 'change',render));
  $('reset').addEventListener('click',() => {
    $('search').value = ''; category.value = ''; $('origin').value = ''; render(); $('search').focus();
  });
  const tabs = [$('tab-library'),$('tab-free')];
  function activateTab(tab) {
    tabs.forEach(item => {
      const active = item === tab;
      item.setAttribute('aria-selected',String(active));
      item.tabIndex = active ? 0 : -1;
      $(item.getAttribute('aria-controls')).hidden = !active;
    });
  }
  tabs.forEach((tab,index) => {
    tab.addEventListener('click',() => activateTab(tab));
    tab.addEventListener('keydown',event => {
      if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
      event.preventDefault();
      const next = tabs[event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length-1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
      activateTab(next); next.focus();
    });
  });
  $('catalog-error').hidden = styles.length > 0;
  makeComposer($('free-composer'),null);
  render();
})();
