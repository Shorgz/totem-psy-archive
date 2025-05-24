'use strict';

const cheerio = require('cheerio');

console.log('Instant View script loaded');

hexo.extend.filter.register('after_render:html', function(str, data) {
  console.log('Processing path:', data.path);
  console.log('Layout:', data.layout);
  console.log('Is post:', data.is_post);

  // Проверяем, является ли страница постом
  const isPost = (
    data.layout === 'post' ||
    data.is_post ||
    (data.path && data.path.match(/^\d{4}\/\d{2}\/\d{2}\/[^\/]+\/index\.html$/))
  );

  console.log('Determined as post:', isPost);

  // Пропускаем страницы, не являющиеся постами, или с путями iv-articles
  if (!isPost) {
    console.log('Skipping: not a post');
    return str;
  }
  if (data.path && data.path.includes('iv-articles')) {
    console.log('Skipping: iv-articles path');
    return str;
  }

  console.log('Loading HTML with cheerio');
  const $ = cheerio.load(str, { decodeEntities: false });

  // Добавление мета-тегов и скрипта для консоли браузера
  const addMetaTags = ($) => {
    console.log('Adding meta tags');
    const $head = $('head');
    
    // Удаляем существующие мета-теги, чтобы избежать дублирования
    $head.find('meta[property="al:android:app_name"]').remove();
    $head.find('meta[property="article:published_time"]').remove();
    $head.find('meta[property="og:type"]').remove();
    $head.find('meta[property="og:site_name"]').remove();
    $head.find('meta[property="og:description"]').remove();
    $head.find('meta[property="og:image"]').remove();
    $head.find('meta[name="author"]').remove();
    $head.find('meta[name="telegram:channel"]').remove();
    $head.find('meta[name="twitter:card"]').remove();

    // Форматируем дату публикации в ISO 8601
    const publishedDate = data.date ? new Date(data.date).toISOString() : new Date().toISOString();
    console.log('Published date:', publishedDate);

    // Обязательные теги для Medium
    $head.append('<meta property="al:android:app_name" content="Medium">');
    $head.append(`<meta property="article:published_time" content="${publishedDate}">`);
    $head.append('<meta property="og:type" content="article">');

    // Опциональные теги
    const siteName = data.site?.title || 'My Blog';
    const description = data.description || data.excerpt || 'Article description';
    const author = data.author || 'Anonymous';
    const telegramChannel = data.telegram_channel || '@YourChannel';

    $head.append(`<meta property="og:site_name" content="${siteName}">`);
    $head.append(`<meta property="og:description" content="${description}">`);
    $head.append(`<meta name="author" content="${author}">`);
    $head.append(`<meta name="telegram:channel" content="${telegramChannel}">`);
    $head.append('<meta name="twitter:card" content="summary_large_image">');

    // Извлечение og:image из <section class="is-imageBackgrounded">
    const baseUrl = hexo.config.url || 'https://totem-psy-archive.vercel.app';
    console.log('Using base URL for og:image:', baseUrl);
    let ogImage = '';
    const $coverSection = $('section.is-imageBackgrounded').first();
    if ($coverSection.length) {
      const $img = $coverSection.find('figure img').first();
      if ($img.length) {
        let src = $img.attr('src') || $img.attr('data-src');
        console.log('Found cover image src:', src);
        if (src) {
          // Преобразуем относительный путь в абсолютный
          if (!src.match(/^https?:\/\//)) {
            console.log('Converting relative og:image path to absolute');
            src = new URL(src, baseUrl).href;
            console.log('New og:image src:', src);
          }
          // Проверяем, что src не .svg
          if (!src.endsWith('.svg')) {
            ogImage = src;
            console.log('Set og:image:', ogImage);
          } else {
            console.log('og:image is SVG, skipping');
          }
        }
      } else {
        console.log('No img found in cover section');
      }
    } else {
      console.log('No cover section found');
    }

    // Запасной вариант: cover_image или thumbnail из front-matter
    if (!ogImage && (data.cover_image || data.thumbnail)) {
      ogImage = data.cover_image || data.thumbnail;
      console.log('Using front-matter cover_image/thumbnail for og:image:', ogImage);
    }

    if (ogImage) {
      $head.append(`<meta property="og:image" content="${ogImage}">`);
      console.log('og:image meta tag added');
    } else {
      console.log('No valid og:image found, skipping meta tag');
    }

    // Добавляем скрипт для вывода в консоль браузера
    console.log('Adding browser console script');
    const imageDebugInfo = JSON.stringify(
      $articleContent.find('img').map((i, el) => ({
        src: $(el).attr('src') || $(el).attr('data-src'),
        inFigure: $(el).parent().is('figure'),
        isCover: i === 0 && $(el).parents('section.is-imageBackgrounded').length > 0
      })).get()
    );
    $head.append(`
      <script>
        console.log('Instant View script is working');
        console.log('Image debug info:', ${imageDebugInfo});
      </script>
    `);
    console.log('Browser console script added with image debug info');
  };

  // Поиск контента
  const $articleContent = $('.article-content');
  console.log('Article content found:', $articleContent.length > 0);

  if ($articleContent.length === 0) {
    console.log('No article content, returning original HTML');
    return str;
  }

  // Очистка неподдерживаемых элементов
  const cleanUnsupportedElements = ($articleContent, $) => {
    console.log('Cleaning unsupported elements');
    const removedElements = $articleContent.find('script, style, iframe, video, audio, form, input, button, embed, object').length;
    $articleContent.find('script, style, iframe, video, audio, form, input, button, embed, object').remove();
    console.log('Removed unsupported elements:', removedElements);
    const styledElements = $articleContent.find('[style]').length;
    $articleContent.find('[style]').removeAttr('style');
    console.log('Removed style attributes from elements:', styledElements);
    $articleContent.find('[class]').each(function() {
      const $el = $(this);
      const classes = $el.attr('class').split(' ').filter(c => !c.startsWith('redefine-') && c !== 'article-content' && c !== 'markdown-body');
      $el.attr('class', classes.join(' '));
    });
    console.log('Cleaned redefine-specific classes');
  };

  // Обработка изображений
  const processImages = ($articleContent, $) => {
    console.log('Processing images');
    const images = $articleContent.find('img');
    console.log('Found images:', images.length);
    
    // Базовый URL сайта
    const baseUrl = hexo.config.url || 'https://totem-psy-archive.vercel.app';
    console.log('Using base URL for images:', baseUrl);

    images.each(function(i) {
      const $img = $(this);
      let src = $img.attr('src') || $img.attr('data-src') || '';
      
      console.log(`Processing image ${i + 1}: src=${src}, data-src=${$img.attr('data-src')}`);

      // Логируем исходные атрибуты
      console.log(`Image ${i + 1}: Original attributes`, {
        src: $img.attr('src'),
        dataSrc: $img.attr('data-src'),
        inFigure: $img.parent().is('figure'),
        isCover: $img.parents('section.is-imageBackgrounded').length > 0
      });

      // Если src отсутствует, но есть data-src, используем его
      if (!src && $img.attr('data-src')) {
        src = $img.attr('data-src');
        console.log(`Image ${i + 1}: Using data-src as src=${src}`);
      }

      // Преобразуем относительный путь в абсолютный
      if (src && !src.match(/^https?:\/\//)) {
        try {
          console.log(`Image ${i + 1}: Converting relative path to absolute`);
          src = new URL(src, baseUrl).href;
          console.log(`Image ${i + 1}: New src=${src}`);
        } catch (e) {
          console.log(`Image ${i + 1}: Failed to convert path, keeping original src=${src}, error=`, e.message);
        }
      }

      // Проверяем валидность src
      if (!src || src.endsWith('.svg')) {
        console.log(`Image ${i + 1}: Invalid or unsupported src, keeping for debugging (src=${src})`);
        // Не удаляем, чтобы понять, почему изображения пропадают
        $img.attr('data-original-src', src || 'empty');
        $img.attr('src', src || ''); // Сохраняем даже пустой src
      } else {
        console.log(`Image ${i + 1}: Setting src=${src}, removing attributes`);
        $img.attr('src', src).removeAttr('data-src lazyload loading style class alt width height');
      }

      const $parent = $img.parent();
      if (!$parent.is('figure')) {
        console.log(`Image ${i + 1}: Wrapping in figure`);
        const $figure = $('<figure></figure>').append($img.clone()).append('<figcaption></figcaption>');
        if (i === 0 && data.cover_image && src === data.cover_image) {
          console.log(`Image ${i + 1}: Wrapping as cover image`);
          const $section = $('<section class="is-imageBackgrounded"></section>').append($figure);
          $img.replaceWith($section);
        } else {
          $img.replaceWith($figure);
        }
      } else {
        console.log(`Image ${i + 1}: Already in figure, preserving`);
        if (!$parent.find('figcaption').length) {
          console.log(`Image ${i + 1}: Adding figcaption`);
          $parent.append('<figcaption></figcaption>');
        }
        $parent.removeAttr('class style');
        if (i === 0 && data.cover_image && src === data.cover_image && !$parent.parent().is('section.is-imageBackgrounded')) {
          console.log(`Image ${i + 1}: Wrapping figure as cover image`);
          const $section = $('<section class="is-imageBackgrounded"></section>').append($parent.clone());
          $parent.replaceWith($section);
        }
      }
    });
  };

  // Фильтрация подозрительных ссылок
  const filterLinks = ($articleContent, $) => {
    console.log('Filtering links');
    const suspiciousDomains = [
      'rutracker.org', 'ucoz.ru', 't.me', 'telegram.me', 'dropbox.com', 'mega.nz',
      'yandex.net', 'drive.google.com', 'zippyshare.com', 'mediafire.com', '4shared.com'
    ];
    const links = $articleContent.find('a');
    console.log('Found links:', links.length);
    links.each(function(i) {
      const $link = $(this);
      const href = $link.attr('href');
      
      console.log(`Processing link ${i + 1}: href=${href}`);
      if (!href || suspiciousDomains.some(domain => href.includes(domain)) || href.match(/\.(torrent|zip|rar|exe|apk)$/i)) {
        console.log(`Link ${i + 1}: Suspicious or empty, replacing with text`);
        $link.replaceWith($link.text());
      } else {
        console.log(`Link ${i + 1}: Adding rel=nofollow and medium-link class`);
        $link.attr('rel', 'nofollow').addClass('medium-link').removeAttr('style target class');
      }
    });
  };

  // Очистка эмодзи в заголовках
  const cleanEmojisInHeaders = ($articleContent, $) => {
    console.log('Cleaning emojis in headers');
    const headers = $articleContent.find('h1, h2, h3, h4, h5, h6');
    console.log('Found headers:', headers.length);
    headers.each(function(i) {
      const $header = $(this);
      const originalText = $header.text();
      const cleanedText = originalText.replace(/[\u{1F300}-\u{1F9FF}]/gu, '');
      if (originalText !== cleanedText) {
        console.log(`Header ${i + 1}: Removed emojis, new text=${cleanedText}`);
        $header.text(cleanedText);
      } else {
        console.log(`Header ${i + 1}: No emojis found`);
      }
    });
  };

  // Убедимся, что структура article существует
  const ensureArticleStructure = ($articleContent, $) => {
    console.log('Checking article structure');
    const $existingArticle = $articleContent.find('article.tl_article_content');
    if ($existingArticle.length) {
      console.log('Article structure already exists');
      return;
    }

    console.log('Creating new article structure');
    const $contentElement = $articleContent.find('.markdown-body');
    let content;
    if ($contentElement.length) {
      console.log('Markdown-body found, using its content');
      content = $contentElement.html();
      $contentElement.empty();
    } else {
      console.log('No markdown-body, using article-content directly');
      content = $articleContent.html();
      $articleContent.empty();
    }

    // Проверяем наличие h1, если нет — добавляем из title
    const $temp = cheerio.load(content);
    if (!$temp('h1').length && data.title) {
      console.log('No h1 found, adding from post title');
      content = `<h1>${data.title}</h1>${content}`;
    }

    console.log('Wrapping content in article.tl_article_content');
    $articleContent.html(
      $('<article class="tl_article_content" id="_tl_editor"></article>').html(content)
    );
  };

  // Форматирование элементов
  const formatElements = ($articleContent, $) => {
    console.log('Formatting elements');
    console.log('Adding medium-code class to pre:', $articleContent.find('pre').length);
    $articleContent.find('pre').addClass('medium-code').removeAttr('style');
    console.log('Adding medium-inline-code class to code:', $articleContent.find('code').length);
    $articleContent.find('code').addClass('medium-inline-code').removeAttr('style');
    console.log('Adding medium-blockquote class to blockquote:', $articleContent.find('blockquote').length);
    $articleContent.find('blockquote').addClass('medium-blockquote').removeAttr('style');
    console.log('Adding medium-heading class to headers:', $articleContent.find('h1, h2, h3, h4, h5, h6').length);
    $articleContent.find('h1, h2, h3, h4, h5, h6').addClass('medium-heading').removeAttr('style');
    console.log('Adding medium-paragraph class to p:', $articleContent.find('p').length);
    $articleContent.find('p').addClass('medium-paragraph').removeAttr('style');
    console.log('Adding medium-list class to ul/ol:', $articleContent.find('ul, ol').length);
    $articleContent.find('ul, ol').addClass('medium-list').removeAttr('style');
    console.log('Adding medium-list-item class to li:', $articleContent.find('li').length);
    $articleContent.find('li').addClass('medium-list-item').removeAttr('style');
  };

  // Выполняем все обработки
  console.log('Starting content processing');
  addMetaTags($);
  cleanUnsupportedElements($articleContent, $);
  ensureArticleStructure($articleContent, $);
  processImages($articleContent, $);
  filterLinks($articleContent, $);
  cleanEmojisInHeaders($articleContent, $);
  formatElements($articleContent, $);

  // Удаляем ненужные элементы вне article
  console.log('Cleaning non-article content');
  $('header, footer, nav, aside, .redefine-box, .redefine-sidebar, .redefine-footer').remove();
  console.log('Removed header/footer/nav/aside/redefine-specific elements');

  console.log('Returning processed HTML');
  return $.html();
});

// Хелпер для форматирования даты
console.log('Registering medium_date_format helper');
hexo.extend.helper.register('medium_date_format', function(date) {
  if (!date) {
    console.log('medium_date_format: No date provided');
    return '';
  }
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const d = new Date(date);
  console.log('medium_date_format: Formatting date', date, 'to', `${monthNames[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`);
  return `${monthNames[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
});