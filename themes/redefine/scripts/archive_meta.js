const cheerio = require('cheerio');

hexo.extend.filter.register('after_render:html', function(str, data) {
  // Проверяем, что это страница /archives/
  if (data.path === 'archives/index.html' || data.path === 'archives/') {
    const $ = cheerio.load(str, { decodeEntities: true });

    // Удаляем существующие мета-теги, чтобы избежать дублирования
    $('meta[name="charset"], meta[name="viewport"], meta[name="android-app-name"], meta[property^="og:"], meta[name="article:published_time"]').remove();

    // Добавляем новые мета-теги
    $('head').append(`
            <meta charset="UTF-8">
        
        
            <meta property="al:android:app_name" content="Medium">
        
        
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
        
        
            <meta property="og:title" content="PsyГрибоАрхив Экзотики">
        
        
            <meta property="og:description" content="Официальное открытие «Архива в Сети»">
        
        
            <meta property="article:published_time" content="2022-09-01T14:46:56+0000">
        
        
            <meta property="og:image" content="/images/start-head.jpg">
        
        
            <meta property="telegram:channel" content="@Nikto_Archive">
        
    `);

    return $.html();
  }
  return str;
});