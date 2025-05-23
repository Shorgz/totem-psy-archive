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

    // Извлечение og:image из thumbnail в front-matter
    const baseUrl = hexo.config.url || process.env.HEXO_URL || 'https://totem-psy-archive.vercel.app';
    console.log('Using base URL for og:image:', baseUrl);
    let ogImage = '';
    if (data.thumbnail) {
      let src = data.thumbnail;
      console.log('Found thumbnail:', src);
      if (src && src !== 'null') {
        // Преобразуем относительный путь в абсолютный
        if (!src.match(/^https?:\/\//)) {
          console.log('Converting relative thumbnail path to absolute');
          src = new URL(src, baseUrl).href;
          console.log('New og:image src:', src);
        }
        // Проверяем, что src не .svg
        if (!src.endsWith('.svg')) {
          ogImage = src;
          console.log('Set og:image:', ogImage);
        } else {
          console.log('Thumbnail is SVG, skipping');
        }
      } else {
        console.log('Thumbnail is null or invalid, skipping');
      }
    } else {
      console.log('No thumbnail found in front-matter');
    }

    if (ogImage) {
      $head.append(`<meta property="og:image" content="${ogImage}">`);
      console.log('og:image meta tag added');
    } else {
      console.log('No valid og:image found, skipping meta tag');
    }

    // Добавляем скрипт для вывода в консоль браузера
    console.log('Adding browser console script');
    try {
      const imageDebugInfo = JSON.stringify(
        $articleContent.find('img').map((i, el) => ({
          src: $(el).attr('src') || null,
          dataSrc: $(el).attr('data-src') || null,
          dataOriginalSrc: $(el).attr('data-original-src') || null,
          inFigure: $(el).parent().is('figure'),
          isCover: $(el).parents('section.is-imageBackgrounded').length > 0
        })).get(),
        null,
        2
      );
      $head.append(`
        <script>
          console.log('Instant View script is working');
          console.log('Image debug info:', ${imageDebugInfo});
        </script>
      `);
      console.log('Browser console script added with image debug info');
    } catch (e) {
      console.error('Failed to generate image debug info:', e.message);
      $head.append(`
        <script>
          console.log('Instant View script is working');
          console.log('Error generating image debug info:', '${e.message}');
        </script>
      `);
    }
  };

  // Поиск контента
  const $articleContent = $('.article-content');
  console.log('Article content found:', $articleContent.length > 0);
  console.log('Article content HTML length:', $articleContent.html()?.length || 0);

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
      const classes = $el.attr('class')?.split(' ').filter(c => !c.startsWith('redefine-') && c !== 'article-content' && c !== 'markdown-body') || [];
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
    const baseUrl = hexo.config.url || process.env.HEXO_URL || 'https://totem-psy-archive.vercel.app';
    console.log('Using base URL for images:', baseUrl);

    images.each(function(i) {
      const $img = $(this);
      const isCoverImage = $img.parents('section.is-imageBackgrounded').length > 0;

      console.log(`Processing image ${i + 1}: isCoverImage=${isCoverImage}`);

      // Пропускаем изображения в <section class="is-imageBackgrounded">
      if (isCoverImage) {
        console.log(`Image ${i + 1}: Skipping because it is inside is-imageBackgrounded section`);
        return;
      }

      let src = $img.attr('src');
      let dataSrc = $img.attr('data-src');
      
      console.log(`Processing image ${i + 1}: src=${src}, data-src=${dataSrc}`);

      // Логируем исходные атрибуты
      console.log(`Image ${i + 1}: Original attributes`, {
        src,
        dataSrc,
        inFigure: $img.parent().is('figure'),
        isCover: isCoverImage
      });

      // Если src="null" или отсутствует, пробуем data-src
      if (!src || src === 'null') {
        if (dataSrc && dataSrc !== 'null') {
          src = dataSrc;
          console.log(`Image ${i + 1}: Using data-src as src=${src}`);
        } else {
          src = '';
          console.log(`Image ${i + 1}: No valid src or data-src, keeping for debugging`);
        }
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
        $img.attr('data-original-src', src || 'empty');
        $img.removeAttr('src');
      } else {
        console.log(`Image ${i + 1}: Setting src=${src}, removing attributes`);
        $img.attr('src', src).removeAttr('data-src lazyload loading style class alt width height');
      }

      const $parent = $img.parent();
      if (!$parent.is('figure')) {
        console.log(`Image ${i + 1}: Wrapping in figure`);
        const $figure = $('<figure></figure>').append($img.clone()).append('<figcaption></figcaption>');
        $img.replaceWith($figure);
      } else {
        console.log(`Image ${i + 1}: Already in figure, preserving`);
        if (!$parent.find('figcaption').length) {
          console.log(`Image ${i + 1}: Adding figcaption`);
          $parent.append('<figcaption></figcaption>');
        }
        $parent.removeAttr('class style');
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
    let content = '';
    if ($contentElement.length) {
      console.log('Markdown-body found, using its content');
      content = $contentElement.html() || '';
      console.log('Markdown-body content length:', content.length);
    } else {
      console.log('No markdown-body, using article-content directly');
      content = $articleContent.html() || '';
      console.log('Article-content content length:', content.length);
    }

    // Проверяем наличие h1, если нет — добавляем из title
    const $temp = cheerio.load(content, { decodeEntities: false });
    if (!$temp('h1').length && data.title) {
      console.log('No h1 found, adding from post title');
      content = `<h1>${data.title}</h1>${content}`;
    }

    // Проверяем, есть ли контент
    if (!content.trim()) {
      console.log('Warning: No content found for article, using fallback');
      content = `<h1>${data.title || 'Untitled'}</h1><p>No content available.</p>`;
    }

    console.log('Wrapping content in article.tl_article_content');
    $articleContent.html(
      $('<article class="tl_article_content" id="_tl_editor"></article>').html(content)
    );
    console.log('Article structure created, new content length:', $articleContent.html().length);
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
  const removedElementsCount = $('header, footer, nav, aside, .redefine-box, .redefine-sidebar, .redefine-footer').length;
  $('header, footer, nav, aside, .redefine-box, .redefine-sidebar, .redefine-footer').remove();
  console.log('Removed non-article elements:', removedElementsCount);

  // Проверяем итоговый HTML
  const finalHtml = $.html();
  console.log('Final HTML length:', finalHtml.length);
  if (!finalHtml.includes('<body') || !finalHtml.includes('.article-content')) {
    console.error('Warning: Final HTML may be incomplete');
  }

  console.log('Returning processed HTML');
  return finalHtml;
});

// Хелпер для форматирования даты
console.log('Registering medium_date_format helper');
hexo.extend.helper.register('medium_date_format', function(date) {
  console.log('medium_date_format: Received date:', date);
  if (!date) {
    console.log('medium_date_format: No date provided');
    return '';
  }
  const d = new Date(date);
  if (isNaN(d.getTime())) {
    console.log('medium_date_format: Invalid date:', date);
    return '';
  }
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const formattedDate = `${monthNames[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  console.log('medium_date_format: Formatted date:', date, 'to', formattedDate);
  return formattedDate;
});