const fs = require('fs');
const path = require('path');

hexo.extend.helper.register('getImages', function() {
  const imageDir = 'source/images/masonry/';
  const images = fs.readdirSync(imageDir)
    .filter(file => /\.(jpg|jpeg|png|gif)$/.test(file))
    .map(file => ({
      image: `/images/${file}`,
      title: file.replace(/\.[^/.]+$/, ''),
      description: `Description for ${file}`
    }));
  return images;
});

hexo.extend.helper.register('getPageTitle', function(page) {
  return page.title || 'Masonry Gallery';
});