const cheerio = require('cheerio');

// Конфигурация для обработки медиа
const mediaConfig = {
  pic: {
    selector: 'img',
    command: 'pic',
    removeAttrs: ['data-src', 'lazyload', 'loading', 'style', 'alt'],
    addAttrs: { class: 'iv_pic' }, // Без height для пропорций
    srcPriority: ['data-src', 'src'],
    template: (src, srcset) => `<figure><img class="iv_pic" src="${src}" ${srcset ? `srcset="${srcset}" sizes="(max-width: 800px) 1280px, 1920px"` : ""}><figcaption></figcaption></figure>`
  },
  vid: {
    selector: 'video, video source',
    command: 'vid',
    removeAttrs: ['data-src', 'lazyload', 'loading', 'style', 'class'],
    addAttrs: { class: 'iv_vid', controls: '', width: '560', height: '315' },
    srcPriority: ['data-src', 'src'],
    template: (src) => `<figure><video class="iv_vid" controls><source src="${src}" type="video/mp4"></video><figcaption></figcaption></figure>`
  },
  iframe: {
    selector: 'iframe',
    command: 'iframe',
    removeAttrs: ['style', 'width', 'height', 'title', 'frameborder', 'allow', 'referrerpolicy'],
    addAttrs: { class: 'iv_iframe', width: '560', height: '315' },
    srcPriority: ['src'],
    srcTransform: (src) => `https://www.youtube.com/embed/${src}`,
    template: (src) => `<figure><iframe class="iv_iframe" src="${src}"></iframe><figcaption></figcaption></figure>`
  },
  anc: {
    command: 'anc',
    template: (id) => `<a name="${id}"></a>`
  }
};

// Функция для получения src с приоритетом
function getSrc($element, config) {
  for (const attr of config.srcPriority) {
    const src = config.selector.includes('source') ? $element.find('source').attr(attr) || $element.attr(attr) : $element.attr(attr);
    if (src) return src;
  }
  return '';
}

// Функция для обработки HTML-элемента
function processElement($element, config, $) {
  const isNested = config.selector.includes('source');
  const $target = isNested ? $element.is('video') ? $element : $element.parent('video') : $element;
  const src = getSrc($target, config);

  if (!$target.parent().is('figure')) {
    const $figure = $('<figure>');
    $target.attr('src', src);
    if (isNested) $target.find('source').attr('src', src);
    config.removeAttrs.forEach(attr => {
      $target.removeAttr(attr);
      if (isNested) $target.find('source').removeAttr(attr);
    });
    Object.entries(config.addAttrs).forEach(([key, value]) => $target.attr(key, value));
    $figure.append($target.clone());
    $figure.append('<figcaption></figcaption>');
    $target.replaceWith($figure);
  } else {
    $target.attr('src', src);
    if (isNested) $target.find('source').attr('src', src);
    config.removeAttrs.forEach(attr => {
      $target.removeAttr(attr);
      if (isNested) $target.find('source').removeAttr(attr);
    });
    Object.entries(config.addAttrs).forEach(([key, value]) => $target.attr(key, value));
    const $figure = $target.parent('figure');
    if ($figure.find('figcaption').length === 0) {
      $figure.append('<figcaption></figcaption>');
    }
    $figure.removeAttr('class style');
  }
}

// Функция для обработки команд [[pic()]], [[vid()]], [[iframe()]], [[anc()]]
function processCommands(html, config) {
  const commandRegex = /\[\[(pic|vid|iframe|anc)\(([^)]+)\)\]\]/g;
  return html.replace(commandRegex, (match, type, value) => {
    value = value.trim();
    const media = Object.values(config).find(c => c.command === type);
    if (media) {
      if (type === 'anc') {
        return media.template(value);
      } else if (type === 'pic') {
        const src = value; // Оригинальный путь, например, /images/фото-1.jpg
        const fileNameBase = src.split('/').pop().replace(/(-[0-9]+w)?\.([a-zA-Z]+)$/, '');
        const srcset = [
          `/images/optimized/${fileNameBase}-1280w.webp 1280w`,
          `/images/optimized/${fileNameBase}-1920w.webp 1920w`
        ].join(', ');
        return media.template(src, srcset); // src — оригинальный, srcset — оптимизированный
      }
      const transformedSrc = media.srcTransform ? media.srcTransform(value) : value;
      return media.template(transformedSrc);
    }
    return match;
  });
}

hexo.extend.filter.register('after_render:html', function(str, data) {
  // Проверяем, является ли страница постом
  if (data.layout === 'post' || data.is_post || str.includes('article-content')) {
    // Пропускаем страницы из iv-articles
    if (data.path && data.path.includes('iv-articles')) {
      return str;
    }

    const $ = cheerio.load(str, { decodeEntities: true });

    // Обработка команд
    $('.article-content').each(function() {
      const $content = $(this);
      let html = $content.html();
      html = processCommands(html, mediaConfig);
      $content.html(html);
    });

    // Обработка существующих элементов
    Object.values(mediaConfig).forEach(config => {
      if (config.command === 'pic') {
        let imgIndex = 0;
        $(`.article-content ${config.selector}`).each(function() {
          const $img = $(this);
          if (
            !$img.hasClass('author-avatar') &&
            !$img.hasClass('no-iv')
          ) {
            const src = getSrc($img, config);
            if (src && src.startsWith('/images/')) {
              const fileNameBase = src.split('/').pop().replace(/(-[0-9]+w)?\.([a-zA-Z]+)$/, '');
              const srcset = [
                `/images/optimized/${fileNameBase}-1280w.webp 1280w`,
                `/images/optimized/${fileNameBase}-1920w.webp 1920w`
              ].join(', ');
              $img.attr('src', src); // Оставляем оригинальный src
              $img.attr('srcset', srcset);
              $img.attr('sizes', '(max-width: 800px) 1280px, 1920px');
              processElement($img, config, $);
            }
          }
          imgIndex++;
        });
      } else if (config.command !== 'anc') {
        $(`.article-content ${config.selector}`).each(function() {
          processElement($(this), config, $);
        });
      }
    });

    return $.html();
  }

  return str;
});