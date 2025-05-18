hexo.extend.filter.register('after_post_render', function(data) {
    if (this.theme.config.articles.style.image_caption !== false) {
        const class_name='image-caption';
        if (data.layout === 'post' || data.layout === 'page' || data.layout === 'about') {
            // Обрабатываем изображения для совместимости с Medium/Telegram
            data.content = data.content.replace(/(<img [^>]*alt="([^"]+)"[^>]*>)/g, `<figure class="${class_name}">$1<figcaption>$2</figcaption></figure>`);
            
            // Дополнительно преобразуем изображения в div[style] в правильный формат 
            // Ищем div со стилями, содержащие img
            data.content = data.content.replace(/<div style="[^"]*">\s*(<img[^>]*>)\s*<\/div>/g, function(match, imgTag) {
                // Очищаем атрибуты img, оставляя только src
                const srcMatch = imgTag.match(/src="([^"]*)"/);
                if (!srcMatch) return match;
                
                const src = srcMatch[1];
                return `<figure><img src="${src}"/><figcaption></figcaption></figure>`;
            });

            // Преобразуем img напрямую в p в правильный формат
            data.content = data.content.replace(/<p>\s*(<img[^>]*>)\s*<\/p>/g, function(match, imgTag) {
                // Очищаем атрибуты img, оставляя только src
                const srcMatch = imgTag.match(/src="([^"]*)"/);
                if (!srcMatch) return match;
                
                const src = srcMatch[1];
                return `<figure><img src="${src}"/><figcaption></figcaption></figure>`;
            });
        }
    }
    return data;
});