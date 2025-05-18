/**
 * Medium Converter для Hexo Redefine
 * Скрипт трансформирует все статьи в формат Medium для Telegram Instant View
 */

'use strict';

const cheerio = require('cheerio');

hexo.extend.filter.register('after_render:html', function(str, data) {
  // Проверяем, является ли страница статьей (постом)
  if (data.path && (data.layout === 'post' || data.is_post || str.includes('article-content-container'))) {
    const $ = cheerio.load(str);
    
    // Пропускаем страницы из iv-articles, там уже есть нужная структура
    if (data.path && data.path.includes('iv-articles')) {
      return str;
    }
    
    // Добавляем классы Medium к существующим элементам без замены оригинальных классов
    $('.article-content').addClass('medium-article');
    
    // ВАЖНО: Проверяем есть ли уже структура article.tl_article_content, если нет - создаем
    if ($('.article-content article.tl_article_content').length === 0) {
      // Создаем правильную структуру для содержимого
      const $contentElement = $('.article-content .markdown-body');
      
      if ($contentElement.length > 0) {
        // Сохраняем содержимое и очищаем контейнер
        const content = $contentElement.html();
        $contentElement.empty();
        
        // Создаем нужную структуру и вставляем содержимое
        const $articleContainer = $('<div class="article medium-article"></div>');
        const $articleElement = $('<article class="tl_article_content" id="_tl_editor"></article>');
        
        $articleElement.html(content);
        $articleContainer.append($articleElement);
        $contentElement.append($articleContainer);
      }
    }
    
    // Дополнительная обработка всех элементов с любыми inline стилями
    $('.article-content [style]').each(function() {
      const $el = $(this);
      const style = $el.attr('style') || '';
      
      // Проверяем есть ли изображение внутри элемента со стилями
      const $img = $el.find('img');
      if ($img.length > 0) {
        // Если внутри элемента со стилями есть изображение, заменяем элемент на figure
        const $figure = $('<figure></figure>');
        
        // Копируем изображение
        const $imgClone = $img.clone();
        
        // Очищаем атрибуты изображения, оставляя только src
        const src = $imgClone.attr('data-src') || $imgClone.attr('src');
        $imgClone.attr('src', src);
        
        // Удаляем все остальные атрибуты, которые могут мешать Telegram
        $imgClone.removeAttr('data-src');
        $imgClone.removeAttr('lazyload');
        $imgClone.removeAttr('loading');
        $imgClone.removeAttr('style');
        $imgClone.removeAttr('class');
        $imgClone.removeAttr('alt');
        
        // Добавляем изображение в figure
        $figure.append($imgClone);
        
        // Добавляем пустой figcaption (нужен для Medium)
        $figure.append('<figcaption></figcaption>');
        
        // Заменяем элемент со стилями на figure
        $el.replaceWith($figure);
      }
    });
    
    // Подготовительная работа - сначала обрабатываем все контейнеры с изображениями
    // которые обернуты в div с style="text-align: center" и другими стилями
    $('.article-content div[style*="text-align"]').each(function() {
      const $div = $(this);
      const $img = $div.find('img');
      
      if ($img.length > 0) {
        // Если внутри div есть изображение, заменяем div на figure
        const $figure = $('<figure></figure>');
        
        // Копируем изображение
        const $imgClone = $img.clone();
        
        // Очищаем атрибуты изображения, оставляя только src
        const src = $imgClone.attr('data-src') || $imgClone.attr('src');
        $imgClone.attr('src', src);
        
        // Удаляем все остальные атрибуты, которые могут мешать Telegram
        $imgClone.removeAttr('data-src');
        $imgClone.removeAttr('lazyload');
        $imgClone.removeAttr('loading');
        $imgClone.removeAttr('style');
        $imgClone.removeAttr('class');
        $imgClone.removeAttr('alt');
        
        // Добавляем изображение в figure
        $figure.append($imgClone);
        
        // Добавляем пустой figcaption (нужен для Medium)
        $figure.append('<figcaption></figcaption>');
        
        // Заменяем div на figure
        $div.replaceWith($figure);
      }
    });
    
    // Обрабатываем все остальные изображения
    $('.article-content img').each(function() {
      const $img = $(this);
      
      // Если изображение не внутри figure, оборачиваем его в figure
      if (!$img.parent().is('figure')) {
        // Клонируем изображение
        const $imgClone = $img.clone();
        
        // Очищаем атрибуты изображения, оставляя только src
        const src = $imgClone.attr('data-src') || $imgClone.attr('src');
        $imgClone.attr('src', src);
        
        // Удаляем все остальные атрибуты
        $imgClone.removeAttr('data-src');
        $imgClone.removeAttr('lazyload');
        $imgClone.removeAttr('loading');
        $imgClone.removeAttr('style');
        $imgClone.removeAttr('class');
        $imgClone.removeAttr('alt');
        
        // Создаем figure с изображением и пустым figcaption
        const $figure = $('<figure></figure>');
        $figure.append($imgClone);
        $figure.append('<figcaption></figcaption>');
        
        // Заменяем исходное изображение на figure
        $img.replaceWith($figure);
      } else {
        // Если изображение уже внутри figure, просто очищаем атрибуты
        const src = $img.attr('data-src') || $img.attr('src');
        $img.attr('src', src);
        
        // Удаляем все остальные атрибуты
        $img.removeAttr('data-src');
        $img.removeAttr('lazyload');
        $img.removeAttr('loading');
        $img.removeAttr('style');
        $img.removeAttr('class');
        $img.removeAttr('alt');
        
        // Проверяем, есть ли figcaption, если нет - добавляем
        const $figure = $img.parent('figure');
        if ($figure.find('figcaption').length === 0) {
          $figure.append('<figcaption></figcaption>');
        }
        
        // Удаляем классы у figure
        $figure.removeAttr('class');
      }
    });
    
    // Форматируем блоки кода
    $('.article-content pre').addClass('medium-code');
    $('.article-content code').addClass('medium-inline-code');
    
    // Обрабатываем блоки цитат
    $('.article-content blockquote').addClass('medium-blockquote');
    
    // Улучшаем обработку видео и iframe
    $('.article-content iframe').each(function() {
      const $iframe = $(this);
      
      // Если iframe не в figure, оборачиваем
      if (!$iframe.parent().is('figure')) {
        const $figure = $('<figure></figure>');
        $figure.append($iframe.clone());
        $iframe.replaceWith($figure);
      }
    });
    
    // Добавляем классы заголовкам
    $('.article-content h1, .article-content h2, .article-content h3, .article-content h4, .article-content h5, .article-content h6').addClass('medium-heading');
    
    // Обрабатываем ссылки
    $('.article-content a').addClass('medium-link');
    
    // Обрабатываем параграфы
    $('.article-content p').addClass('medium-paragraph');
    
    // Обрабатываем списки
    $('.article-content ul, .article-content ol').addClass('medium-list');
    $('.article-content li').addClass('medium-list-item');
    
    return $.html();
  }
  
  return str;
});

// Хелпер для преобразования даты в формат Medium
hexo.extend.helper.register('medium_date_format', function(date) {
  if (!date) return '';
  
  const monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];
  
  const d = new Date(date);
  return `${monthNames[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}); 