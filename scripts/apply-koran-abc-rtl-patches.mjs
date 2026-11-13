/** Native-script patches for Quran-ABC / notFound / authorBook (push gate). */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const locDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'locales');

const arAbc = {
  title: 'أبجدية القرآن',
  phaseTitle: 'أبجدية القرآن — فهم العلامات',
  startCta: 'ابدأ بأبجدية القرآن',
  startCtaDesc: 'الخط والحركات قبل تمرين الحروف',
  skipCta: 'تعليم أبجدية القرآن كمكتملة',
  lessonTitles: {
    welcome: 'مرحبًا واتجاه الخط',
    letterMark: 'الحرف والعلامة',
    tone: 'أصوات خفيفة وثقيلة',
    vowels: 'الحركات القصيرة الثلاث',
    sukun: 'السكون / الجزم',
    shadda: 'الشدة',
    madd: 'المد',
    tanwin: 'التنوين',
    article: 'أداة التعريف ال',
    allah: 'لفظ الجلالة الله',
    waqf: 'الوقف عند نهاية الكلمة',
    bridge: 'الخاتمة — إلى الحروف',
  },
  cards: {
    welcomeGoal:
      'تتعلّم أولًا كيف تعمل الكتابة العربية والحركات — بأسلوبنا، خطوة بخطوة نحو ٢٨ حرفًا.',
    welcomeRtl: 'العربية تُقرأ من اليمين إلى اليسار. الحروف تتصل كالكتابة اليدوية.',
    letterMark: 'الحرف هو الصامت. الخطوط فوقه أو تحته علامات تُبيّن الحركة.',
    letterBare: 'بدون علامات لا يُقرأ اللفظ بثقة. لذلك وُضعت الحركات في القرآن.',
    tarqiq: 'بعض الأصوات خفيفة ورقيقة (ترقيق).',
    tafkhim: 'أخرى ثقيلة (تفخيم) — مثل ص أو ط. استمع للفرق.',
    fatha: 'الفتحة فوق الحرف = «a» قصيرة، مثل بَ = ba.',
    kasra: 'الكسرة تحت الحرف = «i» قصيرة — بِ = bi.',
    damma: 'الضمة فوق الحرف = «u» قصيرة — بُ = bu.',
    sukun: 'السكون = بلا حركة. الحرف يغلق المقطع.',
    sukunHear: 'مع السكون يكون الصوت قصيرًا ومغلقًا.',
    shadda: 'الشدة تُضاعف الحرف.',
    maddAlif: 'ألف بعد فتحة يُطيل الصوت.',
    maddSign: 'علامة المد الصغيرة تُطيل الحركة — تفاصيل في التجويد.',
    tanwinFatha: 'تنوين الفتح = «-an» في آخر الكلمة.',
    tanwinDamma: 'تنوين الضم = «-un» في الآخر.',
    article: 'ال في البداية أداة التعريف. قواعد الشمس والقمر لاحقًا.',
    allah: 'لفظ الجلالة له أحكام خاصة في الكتابة والقراءة.',
    waqf: 'عند نهاية الآية توقف قصير؛ غالبًا يُقرأ آخر حرف بسكون.',
    bridge: 'عرفت العلامات الأساسية. التالي: مجموعة الحروف ١.',
  },
};

const ruAbc = {
  title: 'Азбука Корана',
  phaseTitle: 'Азбука Корана — знаки чтения',
  startCta: 'Сначала: азбука Корана',
  startCtaDesc: 'Письмо и огласовки до упражнений с буквами',
  skipCta: 'Отметить азбуку Корана пройденной',
  lessonTitles: {
    welcome: 'Введение и направление письма',
    letterMark: 'Буква и знак',
    tone: 'Лёгкие и твёрдые звуки',
    vowels: 'Три краткие гласные',
    sukun: 'Сукун / джазм',
    shadda: 'Шадда',
    madd: 'Удлинение',
    tanwin: 'Танвин',
    article: 'Артикль аль-',
    allah: 'Слово Аллах',
    waqf: 'Остановка в конце слова',
    bridge: 'Итог — к буквам',
  },
  cards: {
    welcomeGoal:
      'Сначала вы поймёте, как устроены арабское письмо и огласовки — своими словами, шаг за шагом к 28 буквам.',
    welcomeRtl: 'Арабский читают справа налево. Буквы соединяются, как в рукописи.',
    letterMark: 'Харф — согласная. Черточки сверху или снизу — огласовки.',
    letterBare: 'Без знаков чтение ненадёжно. В Коране огласовки всегда указаны.',
    tarqiq: 'Некоторые звуки лёгкие и тонкие (таркик).',
    tafkhim: 'Другие — полные и тёмные (тафхим), например ص или ط.',
    fatha: 'Фатха сверху = краткое «a», بَ = ba.',
    kasra: 'Касра снизу = краткое «i», بِ = bi.',
    damma: 'Дамма сверху = краткое «u», بُ = bu.',
    sukun: 'Сукун — без гласной, согласная закрывает слог.',
    sukunHear: 'Со сукуном звук короткий и закрытый.',
    shadda: 'Шадда удваивает согласную.',
    maddAlif: 'Алиф после фатхи удлиняет «a».',
    maddSign: 'Маленькая мадда удлиняет гласную.',
    tanwinFatha: 'Танвин фатха = «-an» в конце.',
    tanwinDamma: 'Танвин дамма = «-un» в конце.',
    article: 'аль- в начале — определённый артикль.',
    allah: 'У имени Аллах особые правила чтения.',
    waqf: 'В конце аята краткая остановка.',
    bridge: 'Вы знаете основные знаки. Далее — буквы группы 1.',
  },
};

const bnAbc = {
  title: 'কুরআন বর্ণমালা',
  phaseTitle: 'কুরআন বর্ণমালা — চিহ্ন বোঝা',
  startCta: 'আগে: কুরআন বর্ণমালা',
  startCtaDesc: 'অক্ষর অনুশীলনের আগে লিপি ও স্বরচিহ্ন',
  skipCta: 'কুরআন বর্ণমালা সম্পন্ন চিহ্নিত করুন',
  lessonTitles: {
    welcome: 'স্বাগত ও লিপির দিক',
    letterMark: 'অক্ষর ও চিহ্ন',
    tone: 'হালকা ও গুরু স্বর',
    vowels: 'তিনটি ছোট স্বরবর্ণ',
    sukun: 'সুকুন / জজম',
    shadda: 'শাদ্দা',
    madd: 'দীর্ঘায়ন',
    tanwin: 'তানুইন',
    article: 'আর্টিকেল আল-',
    allah: 'শব্দ আল্লাহ',
    waqf: 'শব্দের শেষে থামা',
    bridge: 'শেষ — অক্ষরের দিকে',
  },
  cards: {
    welcomeGoal:
      'প্রথমে আপনি আরবি লিপি ও স্বরচিহ্ন কীভাবে কাজ করে তা শিখবেন — ধাপে ধাপে ২৮টি অক্ষরের দিকে।',
    welcomeRtl: 'আরবি ডান থেকে বামে পড়া হয়। অক্ষরগুলো হস্তলিখির মতো যুক্ত হয়।',
    letterMark: 'হারফ হল ব্যঞ্জনবর্ণ। উপরে বা নিচের ছোট রেখা স্বরচিহ্ন।',
    letterBare: 'চিহ্ন ছাড়া পড়া নিশ্চিত নয়। কুরআনে স্বরচিহ্ন সবসময় থাকে।',
    tarqiq: 'কিছু ধ্বনি হালকা ও পাতলা (তারকিক)।',
    tafkhim: 'অন্যগুলো গুরু (তাফখিম) — যেমন ص বা ط।',
    fatha: 'ফাতহা উপরে = ছোট «a», بَ = ba.',
    kasra: 'কাসরা নিচে = ছোট «i», بِ = bi.',
    damma: 'দাম্মা উপরে = ছোট «u», بُ = bu.',
    sukun: 'সুকুন = কোনো স্বর নেই, অক্ষর সিলেবল বন্ধ করে।',
    sukunHear: 'সুকুনে ধ্বনি ছোট ও বন্ধ থাকে।',
    shadda: 'শাদ্দা অক্ষর দ্বিগুণ করে।',
    maddAlif: 'ফাতহার পর আলিফ «a» দীর্ঘ করে।',
    maddSign: 'ছোট মাদ্দ চিহ্ন স্বর দীর্ঘ করে।',
    tanwinFatha: 'তানুইন ফাতহা = শেষে «-an».',
    tanwinDamma: 'তানুইন দাম্মা = শেষে «-un».',
    article: 'শুরুতে আল- নির্দিষ্ট আর্টিকেল।',
    allah: 'আল্লাহ শব্দের বিশেষ পাঠনিয়ম।',
    waqf: 'আয়াত শেষে সংক্ষিপ্ত বিরতি।',
    bridge: 'মৌলিক চিহ্ন জানা হয়েছে। পরে — অক্ষর গ্রুপ ১।',
  },
};

const notFoundAr = {
  pageTitle: 'الصفحة غير موجودة',
  title: 'الصفحة غير موجودة',
  subtitle: 'هذا الرابط غير موجود في سلتي. جرّب:',
};

const notFoundRu = {
  pageTitle: 'Страница не найдена',
  title: 'Страница не найдена',
  subtitle: 'Такого адреса в Salati нет. Попробуйте:',
};

const notFoundBn = {
  pageTitle: 'পৃষ্ঠা পাওয়া যায়নি',
  title: 'পৃষ্ঠা পাওয়া যায়নি',
  subtitle: 'এই ঠিকানা Salati-তে নেই। চেষ্টা করুন:',
};

const authorBookAr = {
  eyebrow: 'من مطوّر Salati',
  body: 'إلى جانب Salati كتبت كتابًا شخصيًا عن رحلتي إلى الإسلام والشهادة في ١٨ أكتوبر ٢٠٢٥. متوفر كورقي وإلكتروني عبر BoD.',
  meta: 'ورقي {printPrice} € · صدر {releaseDate} · ISBN {isbn}',
  ebookNote: 'نسخة اقتصادية {ebookPrice} € (إلكتروني)',
  ctaBod: 'الطلب في متجر BoD',
  ctaAmazon: 'على أمازون',
};

const authorBookRu = {
  eyebrow: 'От разработчика Salati',
  body: 'Помимо Salati я написал личную книгу о пути к исламу и шахаде 18 октября 2025 г. Бумажная и электронная версия через BoD.',
  meta: 'Печать {printPrice} € · выход {releaseDate} · ISBN {isbn}',
  ebookNote: 'Доступный вход {ebookPrice} € (электронная)',
  ctaBod: 'Заказать в книжном магазине BoD',
  ctaAmazon: 'На Amazon',
};

const authorBookBn = {
  eyebrow: 'Salati-এর ডেভেলপারের কাছ থেকে',
  body: 'Salati-র পাশাপাশি আমি ইসলামে আসা ও ১৮ অক্টোবর ২০২৫ শাহাদার গল্প লিখেছি। BoD-তে বই ও ই-বুক।',
  meta: 'পেপারব্যাক {printPrice} € · প্রকাশ {releaseDate} · ISBN {isbn}',
  ebookNote: 'সস্তা প্রবেশ {ebookPrice} € (ই-বুক)',
  ctaBod: 'BoD বুকশপে অর্ডার',
  ctaAmazon: 'Amazon-এ',
};

const patches = {
  ar: { learn: { abc: arAbc }, notFound: notFoundAr, authorBook: authorBookAr, landing: { authorBookSectionTitle: 'من مطوّر Salati' } },
  fa: { learn: { abc: arAbc }, notFound: notFoundAr, authorBook: authorBookAr, landing: { authorBookSectionTitle: 'از توسعه‌دهنده Salati' } },
  ur: { learn: { abc: arAbc }, notFound: notFoundAr, authorBook: authorBookAr, landing: { authorBookSectionTitle: 'Salati کے ڈویلپر سے' } },
  ps: { learn: { abc: arAbc }, notFound: notFoundAr, authorBook: authorBookAr, landing: { authorBookSectionTitle: 'د Salati جوړونکي څخه' } },
  ru: { learn: { abc: ruAbc }, notFound: notFoundRu, authorBook: authorBookRu, landing: { authorBookSectionTitle: 'От разработчика Salati' } },
  bn: { learn: { abc: bnAbc }, notFound: notFoundBn, authorBook: authorBookBn, landing: { authorBookSectionTitle: 'Salati-এর ডেভেলপারের কাছ থেকে' } },
};

function deepAssign(target, patch) {
  for (const [k, v] of Object.entries(patch)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      if (!target[k] || typeof target[k] !== 'object') target[k] = {};
      deepAssign(target[k], v);
    } else {
      target[k] = v;
    }
  }
}

for (const [locale, patch] of Object.entries(patches)) {
  const p = path.join(locDir, `${locale}.json`);
  const dict = JSON.parse(fs.readFileSync(p, 'utf8'));
  deepAssign(dict, patch);
  fs.writeFileSync(p, `${JSON.stringify(dict, null, 2)}\n`);
  console.log(`patched ${locale}`);
}
