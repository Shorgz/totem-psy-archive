const fs = require('fs');
const path = require('path');

hexo.extend.helper.register('getImages', function() {
    const jsonPath = path.join(__dirname, '..', 'source', '_data', 'masonry-images.json'); // Путь к вашему JSON файлу
    try {
        return JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    } catch (err) {
        console.error('Ошибка чтения JSON файла:', err);
        return [];
    }
});