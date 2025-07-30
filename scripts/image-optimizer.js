const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;
const glob = require('glob');

// Конфигурация оптимизации
const imageConfig = {
  quality: 80, // Качество WebP
  resolutions: [
    // { width: 320, suffix: '-320w' }, // Для мобильных
    { width: 1024, suffix: '-1280w' }, // Чтоб наверняка
    { width: 1920, suffix: '-1920w' } // В идеале
  ],
  format: 'webp', // Формат: WebP
  inputDir: 'source/images', // Входная папка
  outputDir: 'public/images/optimized', // Выходная папка
  maxFileSize: 1 * 1024 * 1024 // Максимальный размер файла: 1 МБ
};

// Функция для оптимизации изображения
async function optimizeImage(inputPath, outputPath, width) {
  try {
    // Проверяем, существует ли входной файл
    await fs.access(inputPath);
    
    // Получаем метаданные изображения
    const metadata = await sharp(inputPath).metadata();
    
    // Пропускаем изображения с разрешением <320px
    if (metadata.width < 320 || metadata.height < 320) {
      console.log(`Skipping low-resolution image: ${inputPath} (${metadata.width}x${metadata.height})`);
      return false;
    }

    // Пропускаем иконки/эмодзи
    if (metadata.width < 100 || metadata.height < 100) {
      console.log(`Skipping icon/emoji: ${inputPath}`);
      return false;
    }

    // Проверяем, существует ли выходной файл
    try {
      await fs.access(outputPath);
      console.log(`Skipping existing: ${outputPath}`);
      return true;
    } catch (err) {
      // Файл не существует, продолжаем
    }

    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    
    // Оптимизируем изображение
    let sharpInstance = sharp(inputPath)
      .resize({
        width: width,
        fit: 'inside', // Сохранить пропорции
        withoutEnlargement: true // Не увеличивать маленькие изображения
      })
      .toFormat(imageConfig.format, { quality: imageConfig.quality });

    // Проверяем размер файла
    let buffer = await sharpInstance.toBuffer();
    let fileSize = buffer.length;

    // Если размер превышает maxFileSize, уменьшаем качество
    let currentQuality = imageConfig.quality;
    while (fileSize > imageConfig.maxFileSize && currentQuality > 50) {
      currentQuality -= 5;
      console.log(`Reducing quality to ${currentQuality} for ${inputPath} at ${width}px`);
      sharpInstance = sharp(inputPath)
        .resize({
          width: width,
          fit: 'inside',
          withoutEnlargement: true
        })
        .toFormat(imageConfig.format, { quality: currentQuality });
      buffer = await sharpInstance.toBuffer();
      fileSize = buffer.length;
    }

    // Сохраняем файл
    await sharpInstance.toFile(outputPath);
    console.log(`Optimized: ${inputPath} -> ${outputPath} (${(fileSize / 1024).toFixed(2)} KB)`);
    return true;
  } catch (err) {
    console.error(`Error optimizing ${inputPath}:`, err);
    return false;
  }
}

// Регистрируем фильтр для запуска после генерации
hexo.extend.filter.register('after_generate', async function() {
  try {
    const files = glob.sync(`${imageConfig.inputDir}/**/*.{jpg,jpeg,png,gif}`);
    console.log(`Found ${files.length} images to process`);

    for (const inputPath of files) {
      const fileNameBase = path.basename(inputPath, path.extname(inputPath));
      for (const res of imageConfig.resolutions) {
        const fileName = `${fileNameBase}${res.suffix}.webp`;
        const outputPath = path.join(imageConfig.outputDir, fileName);
        await optimizeImage(inputPath, outputPath, res.width);
      }
    }
    console.log('Image optimization completed');
  } catch (err) {
    console.error('Error during optimization:', err);
  }
});