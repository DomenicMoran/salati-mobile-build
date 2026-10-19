#!/usr/bin/env python3
"""Generate study/data/pflichtwissen.json (8 lessons, 14 locales).

Explicit source-lesson map, never keyword-ranked questions. Include every
teaching section belonging to a question. Content remains under scholarly
review; neither inherited citations nor structural tests prove correctness.

Run: cd apps/mobile && python scripts/generate_pflichtwissen_course.py
"""
from __future__ import annotations

import json
import re
from pathlib import Path

HERE = Path(__file__).resolve().parent
MOBILE = HERE.parent
KI = MOBILE / "src" / "features" / "ki"
STUDY_DATA = MOBILE / "src" / "features" / "study" / "data"
OUT = STUDY_DATA / "pflichtwissen.json"

LOCALES = ["de", "en", "tr", "ar", "es", "fr", "id", "bn", "fa", "ms", "ur", "sw", "ru", "ps"]


def L(**kwargs: str) -> dict[str, str]:
    missing = [loc for loc in LOCALES if not (kwargs.get(loc) or "").strip()]
    if missing:
        raise ValueError(f"Missing locales: {missing}")
    return {loc: kwargs[loc].strip() for loc in LOCALES}


def load_wissen() -> dict[str, dict[str, dict[str, str]]]:
    """id -> locale -> {titel, text}"""
    out: dict[str, dict[str, dict[str, str]]] = {}
    for path in KI.glob("wissen-*.json"):
        name = path.stem
        locale = "de" if name == "wissen-de" else name.removeprefix("wissen-")
        if locale not in LOCALES:
            continue
        data = json.loads(path.read_text(encoding="utf-8"))
        for entry in data.get("eintraege", []):
            eid = entry["id"]
            out.setdefault(eid, {})[locale] = {
                "titel": entry.get("titel", ""),
                "text": entry.get("text", ""),
            }
    return out


def expand_wissen(
    wissen: dict[str, dict[str, dict[str, str]]],
    ref: str,
    title_override: dict[str, str] | None = None,
) -> dict:
    if ref not in wissen:
        raise KeyError(f"Unknown wissen ref: {ref}")
    title: dict[str, str] = {}
    text: dict[str, str] = {}
    for loc in LOCALES:
        block = wissen[ref].get(loc) or wissen[ref].get("en") or wissen[ref]["de"]
        title[loc] = (title_override or {}).get(loc) or block["titel"]
        text[loc] = block["text"]
    return {"title": title, "text": text}


def load_story_segments(course: str, lesson_id: str, indices: list[int]) -> list[dict]:
    path = STUDY_DATA / f"{course}.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    lesson = next(l for l in data["lessons"] if l["id"] == lesson_id)
    story = lesson.get("story") or []
    return [story[i] for i in indices if i < len(story)]


def load_quiz_pool() -> list[dict]:
    pool: list[dict] = []
    for path in sorted(STUDY_DATA.glob("*.json")):
        if path.name == "pflichtwissen.json":
            continue
        data = json.loads(path.read_text(encoding="utf-8"))
        for lesson in data.get("lessons", []):
            for item in lesson.get("storyQuiz") or []:
                if not item.get("q") or len(item.get("options") or []) != 4:
                    continue
                if not all(item["q"].get(loc, "").strip() for loc in LOCALES):
                    continue
                if not all(opt.get(loc, "").strip() for loc in LOCALES for opt in item["options"]):
                    continue
                pool.append(item)
    return pool


def score_quiz(item: dict, keywords: list[str]) -> int:
    hay = (item["q"].get("de") or "").lower()
    for opt in item["options"]:
        hay += " " + (opt.get("de") or "").lower()
    score = 0
    for kw in keywords:
        if kw.lower() in hay:
            score += 2
    return score


def pick_quizzes(pool: list[dict], keywords: list[str], count: int, used: set[str]) -> list[dict]:
    ranked = sorted(pool, key=lambda it: score_quiz(it, keywords), reverse=True)
    picked: list[dict] = []
    for item in ranked:
        key = item["q"]["de"]
        if key in used:
            continue
        if score_quiz(item, keywords) < 2:
            continue
        used.add(key)
        picked.append({"q": item["q"], "options": item["options"]})
        if len(picked) >= count:
            break
    if len(picked) < count:
        for item in ranked:
            key = item["q"]["de"]
            if key in used:
                continue
            used.add(key)
            picked.append({"q": item["q"], "options": item["options"]})
            if len(picked) >= count:
                break
    return picked


INTROS = [
    L(
        de="Islamisches Pflichtwissen ist das, was jeder verantwortungsfähige Muslim über Glaube und Praxis wissen und umsetzen muss — genug, um Gebet, Schahada und zentrale Gebote und Verbote sicher zu leben. Diese Lektion führt ein, warum Lernen hier Pflicht ist und nicht bloß Kür.",
        en="Essential Islamic knowledge is what every accountable Muslim must know and practice about faith and worship — enough to live prayer, the shahada, and core commands and prohibitions with confidence. This lesson introduces why learning here is a duty, not a hobby.",
        tr="İslam farz ilmi, her mükellef Müslümanın iman ve ibadet hakkında bilmesi ve uygulaması gereken asgari bilgidir — namaz, kelime-i şehadet ve temel emir-yasakları güvenle yaşamak için. Bu ders, öğrenmenin burada farz olduğunu anlatır.",
        ar="العلم الواجب هو ما يجب على كل مسلم مكلف أن يعرفه ويعمل به في العقيدة والعبادة — بقدر يكفيه للصلاة والشهادة والأحكام الأساسية. هذه الحلقة تمهّد لماذا التعلّم هنا واجب لا ترف.",
        es="El saber obligatorio es lo que todo musulmán responsable debe conocer y practicar de fe y culto — lo bastante para vivir la oración, la shahada y los mandatos centrales. Esta lección explica por qué aprender aquí es deber, no opción.",
        fr="Le savoir obligatoire est ce que tout musulman responsable doit connaître et pratiquer en matière de foi et d'adoration — assez pour vivre la prière, la chahada et les ordres essentiels. Cette leçon montre pourquoi apprendre ici est un devoir.",
        id="Ilmu wajib adalah apa yang setiap Muslim mukallaf wajib tahu dan amalkan tentang iman dan ibadah — cukup untuk menjalankan salat, syahadat, dan hukum pokok. Pelajaran ini memperkenalkan mengapa belajar di sini adalah kewajiban.",
        bn="ফরজ ইলিম হলো প্রতিটি দায়িত্বশীল মুসলman's ঈমান ও ইবাদত সম্পর্কে জানা ও মেনে চলা — namaz, shahada ও মূল বিধি-নিষেধে নিশ্চিত থাকার মতো। এই পাঠে কেন এখানে শেখা farz তা বোঝানো হয়।",
        fa="علم واجب آنچه است که هر مسلمان مکلّف باید در ایمان و عبادت بداند و به کار بندد — به اندازهٔ کافی برای نماز، شهادتین و احکام اصلی. این درس می‌گوید چرا یادگیری اینجا واجب است.",
        ms="Ilmu fardu ialah apa yang setiap Muslim baligh wajib tahu dan amalkan tentang iman dan ibadah — cukup untuk salat, syahadah dan hukum asas. Pelajaran ini memperkenalkan mengapa belajar di sini adalah fardu.",
        ur="فرض علم وہ ہے جو ہر مکلف مسلمان کو ایمان و عبادت کے بارے میں جاننا اور عمل میں لانا چاہیے — نماز، شہادت اور بنیادی احکام کے لیے کافی۔ یہ سبق بتاتا ہے کہ یہاں سیکھنا فرض کیوں ہے۔",
        sw="Elimu ya lazima ni kile kila Muislamu mwenye wajibu lazima ajue na akitekeleze kuhusu imani na ibada — kutosha kwa swala, shahada na amri/msingi. Somo hili linaeleza kwa nini kujifunza hapa ni wajibu.",
        ru="Обязательное знание — то, что каждый совершеннолетний мусульманин должен знать и применять в вере и поклонении — достаточно для молитвы, шахады и основных предписаний. Урок объясняет, почему учёба здесь — долг.",
        ps="فرض علم هغه دی چې هر مکلف مسلمان باید په ایمان او عبادت کې پوه شي او عمل وکړي — د لمانځه، شهادت او بنسټیزو احکامو لپاره کافي. دا درس ښيي ولې دلته زده کړه فرض ده.",
    ),
    L(
        de="Glaube und Gotteslehre drehen sich um Allah allein: Er erschafft, versorgt und ist würdig jeder aufrichtigen Anbetung. Du lernst den Unterschied zwischen reinem Monotheismus (Tauhid) und dem, wovor der Koran warnt — Allah Partner beizugesellen.",
        en="Faith and theology center on Allah alone: He creates, provides, and alone deserves sincere worship. You learn the difference between pure monotheism (tawhid) and what the Quran warns against — associating partners with Allah.",
        tr="Akide ve Allah bilgisi yalnızca Allah etrafında döner: O yaratır, rızık verir ve yalnızca O'na ibadet edilir. Saf tevhid ile Kur'an'ın uyardığı şirk arasındaki farkı öğrenirsin.",
        ar="العقيدة تدور حول الله وحده: يخلق ويرزق ويستحق العبادة. تتعلّم الفرق بين التوحيد الخالص وبين ما حذّر منه القرآن من الشرك.",
        es="La fe y la doctrina giran en torno a Allah solo: crea, sustenta y merece la adoración. Aprendes la diferencia entre el monoteísmo puro (tawhid) y lo que el Corán advierte: el shirk.",
        fr="La foi et la théologie tournent autour d'Allah seul : Il crée, pourvoit et mérite l'adoration. Tu apprends la différence entre le tawhid pur et le shirk que le Coran avertit.",
        id="Aqidah berkisar pada Allah saja: Dia menciptakan, memberi rezeki, dan berhak disembah. Kamu mempelajari perbedaan tauhid murni dan syirik yang diperingatkan Al-Qur'an.",
        bn="আকিদা আল্লাহকে কেন্দ্র করে: তিনি সৃষ্টি করেন, রিযিক দেন, ইবাদতের হকদার। তাওহিদ ও শিরকের পার্থক্য এখানে স্পষ্ট হয়।",
        fa="عقیده حولِ الله است: آفریدگار، روزی‌دهنده و شایستهٔ عبادت. تفاوت توحید خالص و شرکی که قرآن هشدار می‌دهد را می‌آموزی.",
        ms="Aqidah berpusat pada Allah: Dia mencipta, memberi rezeki, dan berhak disembah. Perbezaan tauhid tulen dan syirik yang diberi amaran al-Quran dipelajari.",
        ur="عقیدہ صرف اللہ کے گرد ہے: وہ پیدا کرتا، رزق دیتا، عبادت کا مستحق ہے۔ توحید اور شرکِ جس سے قرآن نے روکا اس کا فرق سیکھتے ہیں۔",
        sw="Imani na mafundisho yanazunguka Allah peke yake: huumba, huruzuku, anastahili ibada. Unajifunza tofauti ya tawhid na shirk anayoonya Qur'ani.",
        ru="Вера и богословие — об одном Аллахе: Он творит, наделяет и один достоин поклонения. Ты узнаешь различие между чистым таухидом и ширком, которого предостерегает Коран.",
        ps="عقیده یوازې حول الله ده: هغه پیدا کوي، رزق ورکوي، عبادت یې حق دی. توحید او هغه شرک چې قرآن ورته خبرداری ورکوي توپیر زده کړئ.",
    ),
    L(
        de="Allah sandte Propheten und Engel; in der Schöpfung liegen Zeichen für den Sinnigen. Wunder (Muʿjizāt) bestätigen die Wahrheit der Gesandten — Karamāt sind besondere Gunst an Fromme, ohne dass sie Prophetentum beanspruchen.",
        en="Allah sent prophets and angels; creation holds signs for people of insight. Miracles (mu'jizat) confirm the truth of messengers — karamat are special favors to the righteous, not a claim to prophethood.",
        tr="Allah peygamberler ve melekler gönderdi; yaratılışta basiret sahipleri için ayetler vardır. Mucizeler peygamberi doğrular; kerametler veli kullara özel lütuftur, peygamberlik iddiası değildir.",
        ar="أرسل الله الأنبياء والملائكة، وفي الخلق آيات لأولي الألباب. المعجزات تؤكد صدق الرسل، والكرامات فضل للصالحين دون ادعاء نبوة.",
        es="Allah envió profetas y ángeles; en la creación hay signos. Los milagros confirman a los mensajeros; las karamat son favores a los piadosos, no profecía.",
        fr="Allah a envoyé prophètes et anges ; la création contient des signes. Les miracles confirment les messagers ; les karamat sont des faveurs aux pieux, pas la prophétie.",
        id="Allah mengutus nabi dan malaikat; ciptaan penuh tanda. Mu'jizat menguatkan rasul; karamah karunia kepada saleh, bukan klaim kenabian.",
        bn="আল্লাহ রাসূল ও ফেরেশতা পাঠিয়েছেন; সৃষ্টিতে নিদর্শন রয়েছে। মু'জিযা রাসূলকে সত্য প্রমাণ করে; কেরামাত ওলীদের জন্য, নবুয়ত নয়।",
        fa="الله پیامبران و فرشتگان فرستاد؛ در آفرینش نشانه‌هاست. معجزه رسول را تأیید می‌کند؛ کرامت برای صالحان است، نه ادعای نبوت.",
        ms="Allah utus nabi dan malaikat; ciptaan penuh tanda. Mu'jizat sahkan rasul; karamah kurniaan kepada soleh, bukan nubuwah.",
        ur="اللہ نے رسول اور فرشتے بھیجے؛ مخلوق میں نشانیاں ہیں۔ معجزات رسول کی تصدیق؛ کرامات اولیاء کے لیے، نبوت کا دعویٰ نہیں۔",
        sw="Allah alituma mitume na malaika; uumbaji una ishara. Miujiza inathibitisha mitume; karamat ni neema kwa wema, si unabii.",
        ru="Аллах отправил пророков и ангелов; в творении — знамения. Чудеса подтверждают посланников; карамат — милость праведным, не пророчество.",
        ps="الله رسولان او پرښتگان لېږلي؛ په مخلوق کې نښې دي. معجزې رسول تاییدوي؛ کرامت صالحانو ته برکت دی، نه نبوت.",
    ),
    L(
        de="Nach dem Tod beginnt das Barzach — die Zeit im Grab — bis zur Auferstehung und Rechenschaft. Das Herz beruhigt sich, wenn man Jenseits, Waage der Taten und Barmherzigkeit Allahs in richtigem Maß kennt, ohne Gruselmythen.",
        en="After death comes the barzakh — life in the grave — until resurrection and reckoning. The heart finds calm when you know the hereafter, the weighing of deeds, and Allah's mercy in balance, without scare stories.",
        tr="Ölümden sonra kabir hayatı (berzah) gelir; kıyamet ve hesap onu izler. Ahireti, amellerin tartılmasını ve Allah'ın rahmetini dengeli bilmek kalbi yatıştırır.",
        ar="بعد الموت برزخ القبر حتى البعث والحساب. يطمئن القلب بمعرفة الآخرة وميزان الأعمال ورحمة الله بلا أوهام مرعبة.",
        es="Tras la muerte viene el barzaj en la tumba hasta la resurrección y el juicio. Conocer el más allá, la balanza y la misericordia de Allah serena el corazón.",
        fr="Après la mort vient le barzakh dans la tombe jusqu'à la résurrection et le jugement. Connaître l'au-delà, la balance et la miséricorde d'Allah apaise le cœur.",
        id="Setelah mati ada barzakh di kubur hingga bangkit dan hisab. Mengenal akhirat, timbangan amal, dan rahmat Allah menenteramkan hati.",
        bn="মৃত্যুর পর কবরের বরযাখ, তারপর কিয়ামত ও হিসাব। আখিরাত, আমলের মীজান ও আল্লাহর রহমত জানলে অন্তর প্রশান্ত হয়।",
        fa="پس از مرگ برزخ قبر است تا قیامت و حساب. شناخت آخرت، میزان اعمال و رحمت الله دل را آرام می‌کند.",
        ms="Selepas mati ada barzakh di kubur sehingga bangkit dan hisab. Mengenal akhirat, timbangan amal dan rahmat Allah tenangkan hati.",
        ur="موت کے بعد قبر کا برزخ، پھر قیامت و حساب۔ آخرت، میزانِ اعمال اور اللہ کی رحمت جاننے سے دل سکون پاتا ہے۔",
        sw="Baada ya kifo kuna barzakh kaburini hadi kufufuka na hisab. Kujua akhera, mizani ya matendo na rehema ya Allah hutuliza moyo.",
        ru="После смерти — барзах в могиле до воскресения и суда. Знание о загробной жизни, весах дел и милости Аллаха успокаивает сердце.",
        ps="له مرګ وروسته د قبر برزخ، بیا قیامت او حساب. آخرت، میزان او د الله رحمت پوهیدل زړه آراموي.",
    ),
    L(
        de="Reinheit ist die Tür zum Gebet: Wudu, Ghusl oder Tayammum, wenn Wasser fehlt oder schadet. Wer die Schritte kennt und weiß, was sie bricht, betet ruhiger — und vermeidet das häufige „Ich war unsicher, ob mein Gebet galt“.",
        en="Purity is the door to prayer: wudu, ghusl, or tayammum when water is missing or harmful. Knowing the steps and what breaks them lets you pray with calm — and avoids the common „Was my prayer even valid?“",
        tr="Taharet namazın kapısıdır: abdest, gusül veya su yoksa/ zarar veriyorsa teyemmüm. Adımları ve bozanları bilmek namazı huzurla kılar.",
        ar="الطهارة باب الصلاة: الوضوء والغسل والتيمم عند عدم الماء أو ضرره. معرفة الأركان والنواقض تطمئن المصلّي.",
        es="La pureza es la puerta de la oración: wudu, ghusl o tayammum sin agua o si daña. Conocer pasos e invalidantes da tranquilidad al rezar.",
        fr="La pureté est la porte de la prière : wudu, ghusl ou tayammum sans eau ou si elle nuit. Connaître les étapes et annulateurs rassure.",
        id="Thaharah pintu salat: wudu, ghusl, atau tayammum jika air tidak ada atau membahayakan. Mengenal langkah dan pembatal menenteramkan salat.",
        bn="তাহারাত নামাজের দ্বার: ওযু, গোসল বা পানি না থাকলে/ ক্ষতিকর হলে তায়াম্মু। ধাপ ও ভঙ্গurator জানলে নামাজে প্রশান্তি।",
        fa="طهارت در نماز: وضو، غسل یا تیمم وقتی آب نیست یا ضرر دارد. شناخت مراحل و مبطلات آرامش در نماز می‌آورد.",
        ms="Taharah pintu solat: wudu, ghusl atau tayammum jika tiada air atau membahayakan. Mengenal langkah dan pembatal tenangkan solat.",
        ur="طہارت نماز کا دروازہ: وضو، غسل یا پani نہ ہو/ضرر ہو تو تیمم۔ مراحل و مبطلات جاننے سے نماز مطمئن ہوتی ہے۔",
        sw="Usafi ni mlango wa swala: wudu, ghusl au tayammum bila maji au yanapoathiri. Kujua hatua na vinavyovunja hutuliza swala.",
        ru="Чистота — дверь к молитве: вudu, гhusl или tayammum без воды или когда она вредит. Знание шагов и нарушителей успокаивает в намазе.",
        ps="طهارت د لمانځ در: وضو، غسل یا تیمم کله چې اوبه نشته یا ضرر کوي. ګامونه او مبطلونه پوهیدل لمانځ آراموي.",
    ),
    L(
        de="Islam beginnt im Herzen: die Absicht (Niyya) entscheidet, ob eine Tat ibadah oder Gewohnheit ist. Aufrichtigkeit (Ikhlas) schützt davor, gute Werke nur für den Applaus der Menschen zu tun — ein Thema, das der Prophet ﷺ gleich zu Beginn der Überlieferung betont.",
        en="Islam begins in the heart: intention (niyya) decides whether a deed is worship or habit. Sincerity (ikhlas) guards against doing good merely for people's applause — a theme the Prophet ﷺ stressed early in the tradition.",
        tr="İslam kalpte başlar: niyet amelin ibadet mi alışkanlık mı olduğunu belirler. İhlas, iyiliği yalnızca alkış için yapmaktan korur.",
        ar="الإسلام يبدأ من القلب: النية تُفرّق العبادة عن العادة. الإخلاص يحمي من فعل الخير للتصفيق لا لله.",
        es="El Islam empieza en el corazón: la intención distingue adoración de costumbre. La ikhlas evita hacer el bien solo por aplauso.",
        fr="L'Islam commence dans le cœur : l'intention distingue adoration et habitude. L'ikhlas protège du bien fait pour les applaudissements.",
        id="Islam dimulai dari hati: niat membedakan ibadah dan kebiasaan. Ikhlas melindungi dari amal baik demi tepuk tangan.",
        bn="Islam হৃদয় থেকে: নিয়ত ibadah ও অভ্যাসের পার্থক্য করে। ইখলাস শুধু প্রশংসার জন্য ভালো কাজ থেকে রক্ষা করে।",
        fa="اسلام از دل آغاز می‌شود: نیت عبادت را از عادت جدا می‌کند. اخلاص از کار نیک برای تشویق مردم می‌پردازد.",
        ms="Islam bermula di hati: niat bezakan ibadah dan tabiat. Ikhlas lindungi dari amal baik untuk tepukan.",
        ur="Islam دل سے شروع: نیت عبادت و عادت میں فرق کرتی ہے۔ اخلاص صرف تعریف کے لیے نیکی سے بچاتا ہے۔",
        sw="Uislamu unaanza moyoni: nia hutofautisha ibada na mazoea. Ikhlas hulinda dhidi ya wema kwa makofi tu.",
        ru="Ислам начинается в сердце: намерение отделяет поклонение от привычки. Ихlas оберегает от добра ради аплодисментов.",
        ps="اسلام زړه کې پیلېږي: نیت عبادت له عادت جلا کوي. اخلاص یوازې د ستاينې لپاره نیکي څخه ساتي.",
    ),
    L(
        de="Die Zunge kann Paradies oder Feuer näher bringen: Wahrheit, Schweigen wenn nötig, Amr bil-Maʿruf — und das Vermeiden von Ghiba, Beleidigung und Streit. Rechte der Menschen (Amanah, Versprechen, Nachbarschaft) hängen oft an dem, was wir sagen.",
        en="The tongue can bring Paradise or Fire closer: truth, silence when needed, enjoining good — and avoiding ghibah, insult, and quarrel. People's rights (trust, promises, neighbors) often hang on what we say.",
        tr="Dil cenneti veya cehennemi yaklaştırır: doğruluk, gerektiğinde susmak, iyiliği emretmek; gıybet, hakaret ve kavgadan kaçınmak. Emanet, söz ve komşuluk hakları çoğu zaman sözle bağlıdır.",
        ar="اللسان يُقرب الجنة أو النار: صدق وصمت عند الحاجة وأمر بالمعروف، واجتناب الغيبة والسب والخصومة. حقوق الناس كالأمانة والوعد والجوار تتعلق بالقول.",
        es="La lengua acerca paraíso o fuego: verdad, silencio cuando conviene, mandar el bien; evitar guiba, insulto y riña. Confianza, promesa y vecinos dependen de lo que decimos.",
        fr="La langue rapproche le paradis ou le feu : vérité, silence utile, ordre du bien ; fuir ghiba, insulte et querelle. Confiance, promesse et voisinage tiennent à nos paroles.",
        id="Lisan bisa mendekatkan surga atau neraka: jujur, diam jika perlu, amar ma'ruf; hindari gibah, hinaan, pertengkaran. Amanah, janji, tetangga sering bergantung pada ucapan.",
        bn="জিহ্বা জান্নাত বা জাহান্নাম কাছে আনতে পারে: সত্য, প্রয়োজনে চুপ, ভালোর আদেশ; গিবত, গালি, ঝগড়া এড়ানো। আমানত, প্রতিশ্রুতি, প্রতিবেশীর হক কথায় জড়িত।",
        fa="زبان بهشت یا آتش را نزدیک می‌کند: راستی، سکوت در موقع، امر به معروف؛ دوری از غیبت، فحش و نزاع. امانت، وعده و همسایه با گفتار گره می‌خورد.",
        ms="Lidah boleh dekatkan syurga atau neraka: benar, diam bila perlu, amar ma'ruf; elak ghibah, hinaan, pertengkaran. Amanah, janji, jiran bergantung pada kata-kata.",
        ur="زبان جنت یا آگ قریب کر سکتی ہے: سچ، ضرورت پر خاموشی، نیکی کا حکم؛ غیبت، گali، جھگڑے سے بچاؤ۔ امانت، وعدے، پڑوسی حقوق گفتار سے جڑے ہیں۔",
        sw="Ulimi unaweza ukaribishe peponi au moto: kweli, ukimya inapohitajika, amri ya mema; epuka ghibah, matusi, ugomvi. Amana, ahadi, jirani hutegemea maneno.",
        ru="Язык может приблизить Рай или Огонь: правда, молчание когда нужно, призыв к добру; избегать гибы, оскорблений, ссор. Доверие, обещания, соседи зависят от слов.",
        ps="ژبه جنت یا اور نږدې کوي: رښتیا، اړتیا خاموشي، معروف؛ له غیبت، سپکاوي، شخړې ډډه. امانت، وعده، ګاونډي په خبرو تړلي دي.",
    ),
    L(
        de="Bittgebet (Duʿā) ist der Moment, in dem der Diener Allah mit seinen Worten anruft — nach Pflichtgebeten, in Not und in Dankbarkeit. Aufrichtige Reue (Tauba) öffnet die Tür zurück; ein balanciertes Leben in der Welt hält den Muslim nützlich, ohne vom Jenseits abgelenkt zu werden.",
        en="Supplication (du'a) is when the servant calls on Allah in his own words — after obligatory prayers, in need and in gratitude. Sincere repentance (tawbah) opens the way back; a balanced worldly life keeps the Muslim useful without forgetting the hereafter.",
        tr="Dua, kulun Allah'ı kendi sözleriyle çağırmasıdır — farz namazlardan sonra, ihtiyaçta ve şükürde. Samimi tövbe kapıyı açar; dengeli dünya hayatı ahireti unutturmaz.",
        ar="الدعاء مُناجاة العبد لربّه بكلامه — بعد الفرائض وفي الحاجة والشكر. التوبة الصادقة تفتح الباب، وحياة دنيا متزنة لا تُنسي الآخرة.",
        es="La súplica (du'a) es invocar a Allah con palabras propias — tras lo obligatorio, en necesidad y gratitud. El arrepentimiento sincero abre la puerta; vida equilibrada sin olvidar el más allá.",
        fr="La du'a, c'est appeler Allah avec ses propres mots — après les obligations, dans le besoin et la gratitude. Le tawbah sincère rouvre la porte ; une vie d'ici-bas équilibrée sans oublier l'au-delà.",
        id="Doa memanggil Allah dengan kata-kata sendiri — setelah fardu, dalam hajat dan syukur. Taubat tulus membuka pintu; kehidupan dunia seimbang tanpa melupakan akhirat.",
        bn="দুআ নিজ কথায় Allah-কে ডাকা — farz-এর পর, প্রয়োজন ও শুকরিয়ায়। আন্তরিক তাওবা দরজা খোলে; সুষম দুনিয়ার জীবন আখিরাত ভুলায় না।",
        fa="دعا خواندن الله با سخن خود — پس از فرائض، در نیاز و شکر. توبهٔ صادق در را می‌گشاید؛ زندگی متعادل دنیا آخرت را فراموش نمی‌کند.",
        ms="Doa menyeru Allah dengan kata sendiri — selepas fardu, dalam hajat dan syukur. Taubat ikhlas buka pintu; kehidupan dunia seimbang tanpa lupa akhirat.",
        ur="دعا اپنے الفاظ میں اللہ کو پکارنا — farz کے بعد، حاجت و شکر میں۔ سچی توبہ دروازہ کھولتی ہے؛ متوازن دنیاوی زندگی آخرت نہ بھلائے۔",
        sw="Dua ni kumwita Allah kwa maneno yako — baada ya faradhi, katika haja na shukrani. Toba ya dhati hufungua mlango; maisha ya dunia yasiyo na kupindukia hayasahau akhera.",
        ru="Дуа — обращение к Аллаhu своими словами — после фard, в нужде и благодарности. Искреннее покаяние открывает дверь; умеренная жизнь в мире не забывает о загробном.",
        ps="دعا د خپلو ټکو سره الله بلل — له فرضو وروسته، په اړتیا او شکر کې. رښتینې توبه در پرانیزي؛ متوازن دنیاوی ژوند آخرت هیروي نه.",
    ),
]

LESSON_TITLES = [
    L(
        de="Einleitung und Pflichtwissen",
        en="Introduction and essential knowledge",
        tr="Giriş ve farz ilim",
        ar="مقدمة والعلم الواجب",
        es="Introducción y saber obligatorio",
        fr="Introduction et savoir obligatoire",
        id="Pengantar dan ilmu wajib",
        bn="ভূমিকা ও farz ইলিম",
        fa="مقدمه و علم واجب",
        ms="Pengenalan dan ilmu fardu",
        ur="تعارف اور فرض علم",
        sw="Utangulizi na elimu ya lazima",
        ru="Введение и обязательное знание",
        ps="مقدمه او فرض علم",
    ),
    L(
        de="Glaube und Gotteslehre",
        en="Faith and theology",
        tr="İman ve Allah bilgisi",
        ar="العقيدة ومعرفة الله",
        es="Fe y doctrina de Dios",
        fr="Foi et connaissance de Dieu",
        id="Iman dan ilmu tauhid",
        bn="ঈমান ও আকিদা",
        fa="ایمان و شناخت خدا",
        ms="Iman dan ilmu tauhid",
        ur="ایمان و توحید",
        sw="Imani na ujuzi wa Mwenyezi Mungu",
        ru="Вера и богословие",
        ps="ایمان او د الله پوهنه",
    ),
    L(
        de="Schöpfung, Wunder und Karamah",
        en="Creation, miracles and karamat",
        tr="Yaratılış, mucize ve keramet",
        ar="الخلق والمعجزات والكرامات",
        es="Creación, milagros y karamat",
        fr="Création, miracles et karamat",
        id="Ciptaan, mukjizat dan karamah",
        bn="সৃষ্টি, মু'জিযা ও কেরামাত",
        fa="آفرینش، معجزه و کرامت",
        ms="Ciptaan, mukjizat dan karamah",
        ur="تخلیق، معجزات و کرامات",
        sw="Uumbaji, miujiza na karamat",
        ru="Творение, чудеса и карамат",
        ps="پیدایښت، معجزې او کرامات",
    ),
    L(
        de="Tod, Grab und Jenseits",
        en="Death, the grave and the hereafter",
        tr="Ölüm, kabir ve ahiret",
        ar="الموت والقبر والآخرة",
        es="Muerte, tumba y más allá",
        fr="Mort, tombe et au-delà",
        id="Mati, kubur dan akhirat",
        bn="মৃত্যু, কবর ও আখিরাত",
        fa="مرگ، قبر و آخرت",
        ms="Mati, kubur dan akhirat",
        ur="موت، قبر و آخرت",
        sw="Kifo, kaburi na akhera",
        ru="Смерть, могила и загробная жизнь",
        ps="مرګ، قبر او آخرت",
    ),
    L(
        de="Reinheit und Gebet",
        en="Purity and prayer",
        tr="Taharet ve namaz",
        ar="الطهارة والصلاة",
        es="Pureza y oración",
        fr="Pureté et prière",
        id="Thaharah dan salat",
        bn="তাহারাত ও নামাজ",
        fa="طهارت و نماز",
        ms="Taharah dan solat",
        ur="طہارت و نماز",
        sw="Usafi na swala",
        ru="Чистота и молитва",
        ps="طهارت او لمانځ",
    ),
    L(
        de="Herz und Absicht",
        en="Heart and intention",
        tr="Kalp ve niyet",
        ar="القلب والنية",
        es="Corazón e intención",
        fr="Cœur et intention",
        id="Hati dan niat",
        bn="হৃদয় ও নিয়ত",
        fa="قلب و نیت",
        ms="Hati dan niat",
        ur="دل و نیت",
        sw="Moyo na nia",
        ru="Сердце и намерение",
        ps="زړه او نیت",
    ),
    L(
        de="Zunge und zwischenmenschliche Rechte",
        en="The tongue and people's rights",
        tr="Dil ve insan hakları",
        ar="اللسان وحقوق العباد",
        es="La lengua y derechos de las personas",
        fr="La langue et droits des gens",
        id="Lisan dan hak sesama",
        bn="জিহ্বা ও মানুষের হক",
        fa="زبان و حقوق مردم",
        ms="Lidah dan hak manusia",
        ur="زبان و حقوق العباد",
        sw="Ulimi na haki za watu",
        ru="Язык и права людей",
        ps="ژبه او د خلکو حقونه",
    ),
    L(
        de="Bittgebet, Buße und Leben in der Welt",
        en="Supplication, repentance and worldly life",
        tr="Dua, tövbe ve dünya hayatı",
        ar="الدعاء والتوبة والحياة الدنيا",
        es="Súplica, arrepentimiento y vida en el mundo",
        fr="Du'a, repentir et vie d'ici-bas",
        id="Doa, taubat dan kehidupan dunia",
        bn="দুআ, তাওবা ও দুনিয়ার জীবন",
        fa="دعا، توبه و زندگی دنیا",
        ms="Doa, taubat dan kehidupan dunia",
        ur="دعا، توبہ و دنیاوی زندگی",
        sw="Dua, toba na maisha ya duniani",
        ru="Дуа, покаяние и жизнь в мире",
        ps="دعا، توبه او دنیاوی ژوند",
    ),
]

LESSON_SOURCES = [
    "Koran 98:5; Sahih al-Bukhari 1",
    "Koran 112:1-4; Koran 6:102",
    "Koran 21:30; Sahih Muslim 8",
    "Koran 23:100; Koran 99:7-8",
    "Koran 5:6; Sahih al-Bukhari 135",
    "Sahih al-Bukhari 1; Sahih Muslim 1907",
    "Quran 49:12; an-Nawawi Nr. 15",
    "Koran 40:60; Koran 66:8",
]

WISSEN_REFS = [
    ["schahada", "wie-werde-ich-muslim", "fuenf-saeulen"],
    ["wer-ist-allah", "tauhid", "schirk"],
    ["engel", "propheten-allgemein", "letzter-prophet"],
    ["jenseits", "paradies-hoelle", "qadar"],
    ["wudu-kurz", "wudu-bricht", "gebet-ablauf", "tayammum"],
    [],  # borrowed from akhlaq-04
    [],  # borrowed from akhlaq-11
    ["die-fuenf-gebete", "sadaqa", "fasten-ramadan"],
]

BORROW = [
    None,
    None,
    None,
    None,
    None,
    ("akhlaq", "akhlaq-04", [0, 1, 2]),
    ("akhlaq", "akhlaq-11", [0, 1, 2]),
    None,
]

QUIZ_KEYWORDS = [
    ["schahada", "muslim", "säule", "iman", "glaubensbekenntnis", "pflicht"],
    ["allah", "tauhid", "schirk", "einz", "anbetung", "schöpfer"],
    ["engel", "prophet", "buch", "offenbar", "gesandt"],
    ["tod", "grab", "jenseits", "paradies", "hölle", "aufersteh", "barzach"],
    ["wudu", "gebet", "reinheit", "ghusl", "tayammum", "waschung", "salat", "namaz"],
    ["absicht", "niyya", "niyet", "ihlas", "aufrichtig", "intention"],
    ["zunge", "ghiba", "nachrede", "lüge", "wahrhaft", "amanah", "vertrauen"],
    ["dua", "bittgebet", "tauba", "reue", "fasten", "zakat", "spende", "welt"],
]

QUIZ_COUNT = 9


def intro_segment(intro: dict[str, str]) -> dict:
    return {
        "title": L(
            de="Kurz zusammengefasst",
            en="In brief",
            tr="Kısaca",
            ar="باختصار",
            es="En breve",
            fr="En bref",
            id="Singkatnya",
            bn="সংক্ষেপে",
            fa="خلاصه",
            ms="Ringkasnya",
            ur="مختصر",
            sw="Kwa ufupi",
            ru="Кратко",
            ps="لنډه",
        ),
        "text": intro,
    }


def build_lessons(wissen: dict, pool: list[dict]) -> list[dict]:
    # Old parameters retained for callers; no implicit knowledge or quiz search.
    del wissen, pool
    lessons = []
    for i in range(8):
        notice = json.loads((HERE / 'data/pflichtwissen-review-notice.json').read_text(encoding='utf-8'))
        story = [notice]
        quizzes = []
        references = []
        origins = []
        for course, lid in SOURCE_LESSONS[i]:
            data = json.loads((STUDY_DATA / f'{course}.json').read_text(encoding='utf-8'))
            source = next(l for l in data['lessons'] if l['id'] == lid)
            if not source.get('source') or not source.get('story') or not source.get('storyQuiz'):
                raise ValueError(f'Incomplete source lesson: {lid}')
            references.append(source['source'])
            origins.append(lid)
            story.extend({**s, 'source': s.get('source') or source['source'], 'originLessonId': lid} for s in source['story'])
            quizzes.extend({**q, 'source': q.get('source') or source['source'], 'originLessonId': lid} for q in source['storyQuiz'])
        lessons.append(
            {
                "id": f"pflichtwissen-{i+1:02d}",
                "kind": "story",
                "title": LESSON_TITLES[i],
                "source": ' | '.join(dict.fromkeys(references)),
                "story": story,
                "storyQuiz": quizzes,
                "editorialReview": {
                    "status": "in_progress", "date": "2026-10-12",
                    "allSchoolsVerified": False, "allBooksRead": False,
                    "sourceLessonIds": origins,
                    "audioMatchesCourse": False,
                },
            }
        )
    return lessons


# Preserve the eight existing lesson IDs/progress keys. No source section is
# silently dropped. Each quiz is attached to the source lesson taught here.
SOURCE_LESSONS = [
    [('aqida', 'aqida-01'), ('fiqh-ibadat', 'fiqh-01')],
    [('aqida', 'aqida-02'), ('aqida', 'aqida-03')],
    [('aqida', f'aqida-{n:02d}') for n in range(4, 8)],
    [('aqida', 'aqida-08'), ('aqida', 'aqida-09')],
    [('fiqh-ibadat', f'fiqh-{n:02d}') for n in range(2, 18)],
    [('akhlaq', f'akhlaq-{n:02d}') for n in [4, 5, 10, 12, 13]],
    [('akhlaq', f'akhlaq-{n:02d}') for n in [1, 6, 7, 9, 11]],
    [('akhlaq', 'akhlaq-14')] + [('fiqh-ibadat', f'fiqh-{n:02d}') for n in range(18, 25)],
]


def validate(lessons: list[dict]) -> None:
    for lesson in lessons:
        if len(lesson["story"]) < 2:
            raise ValueError(f"{lesson['id']}: need 2+ story segments")
        if len(lesson["storyQuiz"]) < 8:
            raise ValueError(f"{lesson['id']}: need 8+ quiz items, got {len(lesson['storyQuiz'])}")
        for seg in lesson["story"]:
            for loc in LOCALES:
                if not seg["title"].get(loc, "").strip() or not seg["text"].get(loc, "").strip():
                    raise ValueError(f"{lesson['id']}: story missing {loc}")
        for q in lesson["storyQuiz"]:
            if not any(s.get('originLessonId') == q.get('originLessonId') for s in lesson['story']):
                raise ValueError(f"{lesson['id']}: question has no taught source lesson")
            for loc in LOCALES:
                if not q["q"].get(loc, "").strip():
                    raise ValueError(f"{lesson['id']}: quiz q missing {loc}")
            if len(q["options"]) != 4:
                raise ValueError(f"{lesson['id']}: quiz needs 4 options")
            for opt in q["options"]:
                for loc in LOCALES:
                    if not opt.get(loc, "").strip():
                        raise ValueError(f"{lesson['id']}: quiz option missing {loc}")


def main() -> None:
    lessons = build_lessons({}, [])
    validate(lessons)
    payload = {"lessons": lessons}
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    counts = [len(l["storyQuiz"]) for l in lessons]
    print(f"Wrote {OUT} — {len(lessons)} lessons, quiz counts: {counts}, total quizzes: {sum(counts)}")


if __name__ == "__main__":
    main()
