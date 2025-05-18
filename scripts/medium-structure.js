const cheerio = require('cheerio');

// Hook для модификации HTML после его генерации
hexo.extend.filter.register('after_render:html', function(htmlContent) {
  // Применяем только к страницам статей
  if (htmlContent.includes('<article class="article-content markdown-body"')) {
    const $ = cheerio.load(htmlContent);
    
    // Добавляем div с классом article в начало содержимого статьи
    $('article.article-content.markdown-body').wrap('<div class="article"></div>');
    
    // Если есть заглавное изображение, добавляем структуру для него
    if ($('.article-title img').length) {
      const imgSrc = $('.article-title img').attr('src');
      
      // Создаем обертку для изображения в стиле Medium
      const imageWrapper = `
        <section class="is-imageBackgrounded">
          <figure>
            <img src="${imgSrc}"/>
          </figure>
        </section>
      `;
      
      // Вставляем обертку с изображением перед содержимым статьи
      $('.article').prepend(imageWrapper);
    }
    
    // Добавляем id '_tl_editor' к блоку с содержимым статьи
    $('article.article-content.markdown-body').attr('id', '_tl_editor');
    
    return $.html();
  }
  
  return htmlContent;
}); 