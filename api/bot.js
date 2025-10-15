const TelegramBot = require('node-telegram-bot-api');
const similarity = require('string-similarity');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  const token = process.env.TELEGRAM_TOKEN;
  if (!token) {
    console.error('TELEGRAM_TOKEN not set');
    return res.status(500).send('Server Error: Missing TELEGRAM_TOKEN');
  }

  const bot = new TelegramBot(token);

  try {
    const update = req.body;
    if (update.message) {
      const chatId = update.message.chat.id;
      const userId = update.message.from.id;
      const text = update.message.text;

      // Загружаем config
      const configResponse = await fetch('https://totem-psy-archive.vercel.app/config.json');
      if (!configResponse.ok) throw new Error('Failed to fetch config.json');
      const config = await configResponse.json();

      // Проверка доступа
      const member = await bot.getChatMember(chatId, userId);
      const userStatus = member.status;
      const allowed = {
        all: true,
        moderators: ['administrator', 'creator', 'restricted'].includes(userStatus),
        admins: ['administrator', 'creator'].includes(userStatus)
      }[config.access_level];
      if (!allowed) {
        await bot.sendMessage(chatId, 'У вас нет доступа к этой команде.');
        return res.status(200).send('OK');
      }

      if (text === '/articles') {
        let articlesUrl = config.articles_mode === 'manual' ? config.manual_articles_url : 'https://totem-psy-archive.vercel.app/articles.json';
        const articlesResponse = await fetch(articlesUrl);
        if (!articlesResponse.ok) throw new Error('Failed to fetch articles.json');
        const articles = await articlesResponse.json();
        let response = 'Список статей:\n';
        articles.forEach((a, i) => {
          const escapedTitle = a.title.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
          response += `${i + 1}. <a href="${a.url}">${escapedTitle}</a>\n`;
        });
        await bot.sendMessage(chatId, response, { parse_mode: 'HTML' });
      } else if (text.startsWith('/at ')) {
        const queryTag = text.slice(4).trim().toLowerCase();
        if (!queryTag) {
          await bot.sendMessage(chatId, 'Укажите тег: /at {тег}');
          return res.status(200).send('OK');
        }

        // Загружаем articles
        let articlesUrl = config.articles_mode === 'manual' ? config.manual_articles_url : 'https://totem-psy-archive.vercel.app/articles.json';
        const articlesResponse = await fetch(articlesUrl);
        if (!articlesResponse.ok) throw new Error('Failed to fetch articles.json');
        const articles = await articlesResponse.json();

        // Поиск по синонимам и fuzzy
        const allSynonyms = Object.entries(config.tag_synonyms).reduce((acc, [key, synonyms]) => {
          acc[key.toLowerCase()] = synonyms.map(s => s.toLowerCase());
          return acc;
        }, {});
        const querySynonyms = Object.keys(allSynonyms).find(k => allSynonyms[k].includes(queryTag)) ? allSynonyms[Object.keys(allSynonyms).find(k => allSynonyms[k].includes(queryTag))] : [queryTag];

        const matchedArticles = articles.filter(article => {
          return article.tags.some(tag => {
            const normTag = tag.toLowerCase();
            // Точное совпадение с тегом или синонимом
            if (querySynonyms.includes(normTag)) return true;
            // Fuzzy match для тега или синонимов
            return querySynonyms.some(syn => similarity.compareTwoStrings(syn, normTag) > 0.6);
          });
        });

        if (matchedArticles.length === 0) {
          await bot.sendMessage(chatId, `Статей с тегом "${queryTag}" не найдено.`);
        } else {
          let response = `Статьи по тегу "${queryTag}":\n`;
          matchedArticles.forEach((a, i) => {
            const escapedTitle = a.title.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
            response += `${i + 1}. <a href="${a.url}">${escapedTitle}</a>\n`;
          });
          await bot.sendMessage(chatId, response, { parse_mode: 'HTML' });
        }
      }
    }
    res.status(200).send('OK');
  } catch (error) {
    console.error('Error in bot function:', error.message);
    res.status(500).send('Error');
  }
};