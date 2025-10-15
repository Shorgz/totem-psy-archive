const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');

const postsDir = path.join(__dirname, '../source/_posts');
const publicDir = path.join(__dirname, '../public');

if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

let articles = [];
if (fs.existsSync(postsDir)) {
  articles = fs.readdirSync(postsDir).map(file => {
    if (!file.endsWith('.md')) return null;
    const content = fs.readFileSync(path.join(postsDir, file), 'utf8');
    const { data } = matter(content);
    return {
      title: data.title || 'Untitled',
      url: `https://totem-psy-archive.vercel.app/${file.replace('.md', '')}`,
      tags: data.tags || []  // Массив тегов из front-matter
    };
  }).filter(Boolean);
} else {
  console.warn('Папка source/_posts не найдена. Список статей пуст.');
}

fs.writeFileSync(path.join(publicDir, 'articles.json'), JSON.stringify(articles, null, 2));
console.log('articles.json сгенерирован успешно.');