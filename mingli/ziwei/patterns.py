"""Zi Wei pattern detection — the whole table, good and bad.

Why this file exists
--------------------
The browser engine tested patterns against traditional star names (破軍, 貪狼,
天機) while the star tables are simplified, so most of them never fired. The
page therefore showed one or two patterns on almost every chart, which is not
what a 紫微 reading looks like.

Everything here is one table, evaluated the same way for every chart, and each
result carries a status:

    成立    the conditions are met and the chart is clean enough to carry it
    有瑕    the shape is there but something breaks it (煞星同会、化忌冲)
    不成立  not present

Patterns are never hidden when they fail: a reading that lists only hits cannot
be argued with, and the user cannot tell whether the absence means anything.

Coverage
--------
53 patterns: 34 auspicious, 4 neutral, 15 adverse. That is not the whole
tradition — no table is — but it covers everything a practitioner names in a
normal reading, including the ones that only fire on a specific palace
(火贪、铃贪、武贪、马头带箭) and the purely structural ones
(命无正曜、身命同宫、天罗地网).
"""

from __future__ import annotations

from ..calendar.ganzhi import ZHI          # noqa: F401  (kept for callers)

MAJOR = ("紫微", "天机", "太阳", "武曲", "天同", "廉贞", "天府", "太阴",
         "贪狼", "巨门", "天相", "天梁", "七杀", "破军")

LUCKY_AUX = ("左辅", "右弼", "文昌", "文曲", "天魁", "天钺", "禄存", "天马")
BALEFUL = ("擎羊", "陀罗", "火星", "铃星", "地空", "地劫")
BAD = BALEFUL                              # 旧名，别处还在引用

#: name -> (tier, description, english name)
PATTERNS = {
    # ---------------- 吉格：紫微系 ----------------
    "紫府同宫": ("吉", "紫微天府同守命宫于寅申，二帝同宫，贵气最重，惟进退步调不一",
               "Zi Wei and Tian Fu Together"),
    "紫府朝垣": ("吉", "紫微天府合照命垣，主资源聚合，不大贵即当大富",
               "Zi Wei and Tian Fu in Trine"),
    "君臣庆会": ("吉", "紫微坐命而辅弼魁钺同会，主贵人成群、领导有力",
               "Ruler and Ministers Meet"),
    "极向离明": ("吉", "紫微在午坐命，如北极向明，领袖之象；得辅弼更贵",
               "Pole Facing the Light"),
    "紫府夹命": ("吉", "紫微天府夹命宫，主厚重有靠、格局不孤",
               "Zi Wei and Tian Fu Flanking"),

    # ---------------- 双星同宫：十四主星的基本组合 ----------------
    # 论格以命宫三方四正为准，不要求坐命 —— 与「府相朝垣」同一个道理。
    "紫贪同宫": ("中", "紫微贪狼同宫，主才干与欲望俱强，宜专业不宜纯守",
               "Zi Wei and Tan Lang Together"),
    "紫相同宫": ("中", "紫微天相同宫，主得辅佐而受牵制，宜副手、宜稳健",
               "Zi Wei and Tian Xiang Together"),
    "紫杀同宫": ("中", "紫微七杀同宫，主威权与独断，宜开创、忌孤行",
               "Zi Wei and Seven Killings Together"),
    "紫破同宫": ("中", "紫微破军同宫，主变革与重整，宜破旧立新，忌守成",
               "Zi Wei and Po Jun Together"),
    "机阴同宫": ("中", "天机太阴同宫，主心思细密、长于策划，忌多虑",
               "Tian Ji and Tai Yin Together"),
    "机梁同宫": ("吉", "天机天梁同宫，主善谋能断、宜幕僚与专业，惟带孤意",
               "Tian Ji and Tian Liang Together"),
    "日月同宫": ("中", "太阳太阴同宫，主内外兼顾而心境易反覆",
               "Sun and Moon Together"),
    "阳梁同宫": ("吉", "太阳天梁同宫，主正直有名望，宜公职、教育、医法",
               "Sun and Tian Liang Together"),
    "武府同宫": ("吉", "武曲天府同宫于子午，财库相守，主积累有成、善守财",
               "Wu Qu and Tian Fu Together"),
    "财印交驰": ("吉", "武曲天相同宫于寅申，财与印并得，主财权兼具、宜金融与实业",
               "Wealth and Seal Together"),
    "武杀同宫": ("中", "武曲七杀同宫，主刚烈决断、成败皆速，宜技术与管理",
               "Wu Qu and Seven Killings Together"),
    "武破同宫": ("中", "武曲破军同宫，主破而后立，宜重整、忌守旧",
               "Wu Qu and Po Jun Together"),
    "同阴同宫": ("中", "天同太阴同宫，主温和细腻，宜文教与服务业，忌优柔",
               "Tian Tong and Tai Yin Together"),
    "同巨同宫": ("中", "天同巨门同宫，主口才与情绪并重，易生是非，宜专业立身",
               "Tian Tong and Ju Men Together"),
    "同梁同宫": ("吉", "天同天梁同宫，主福寿与清贵，宜公职、教育与顾问",
               "Tian Tong and Tian Liang Together"),
    "廉府同宫": ("吉", "廉贞天府同宫于辰戌，财库得守，主理财有度、宜财务与管理",
               "Lian Zhen and Tian Fu Together"),
    "廉贪同宫": ("凶", "廉贞贪狼同宫于巳亥，桃花与欲望并起，主感情多波折，忌投机",
               "Lian Zhen and Tan Lang Together"),
    "廉相同宫": ("中", "廉贞天相同宫，主谨慎自守，宜行政与协调",
               "Lian Zhen and Tian Xiang Together"),
    "廉杀同宫": ("中", "廉贞七杀同宫，主刚烈而易伤，宜纪律性工作，忌冲动",
               "Lian Zhen and Seven Killings Together"),
    "廉破同宫": ("凶", "廉贞破军同宫于卯酉，主变动激烈、易有官非与耗损",
               "Lian Zhen and Po Jun Together"),

    # ---------------- 吉格：天府天相系 ----------------
    "府相朝垣": ("吉", "天府天相会照命垣，主富贵双全、人情味厚",
               "Tian Fu and Tian Xiang in Trine"),
    "财荫夹印": ("吉", "天相被天府与天梁夹住，主印绶得护、文书与职位稳当",
               "Wealth and Shelter Flanking the Seal"),

    # ---------------- 吉格：日月系 ----------------
    "日月并明": ("吉", "太阳太阴皆居旺地，丹墀桂墀，主少年得志、名利双收",
               "Sun and Moon Both Bright"),
    "日丽中天": ("吉", "太阳在午坐命，光芒最盛，主贵而显",
               "Sun at Midheaven"),
    "日照雷门": ("吉", "太阳在卯坐命，旭日东升，主早年得志",
               "Sun Shining on the Thunder Gate"),
    "月朗天门": ("吉", "太阴在亥坐命，月照天门，主聪慧清贵",
               "Moon Bright at the Heavenly Gate"),
    "月生沧海": ("吉", "太阴在子坐命，水澄月朗，主清贵，宜文教与远方",
               "Moon over the Deep"),
    "日月夹命": ("吉", "太阳太阴夹命宫，主光明与涵养兼具、家世清显",
               "Sun and Moon Flanking the Life Palace"),

    # ---------------- 吉格：武曲廉贞系 ----------------
    "武曲守垣": ("吉", "武曲坐命于辰戌丑未（庙旺之地），主财权在握、执行果决",
               "Wu Qu Enthroned"),
    "廉贞清白": ("吉", "廉贞在寅申坐命，得地而不陷，主清明自守、宜公职",
               "Lian Zhen Unstained"),
    "武贪同行": ("吉", "武曲贪狼同宫于丑未，主晚发、先贫后富，宜实业",
               "Wu Qu and Tan Lang Together"),

    # ---------------- 吉格：机月同梁系 ----------------
    "机月同梁": ("吉", "机月同梁会照，主谋略与文职，宜公职、专业、幕僚",
               "Ji, Yue, Tong, Liang"),
    "天同戌宫": ("吉", "天同坐命戌宫入庙，主福厚、晚境安泰",
               "Tian Tong in Xu"),
    "巨机同临": ("吉", "巨门天机同宫于卯酉，主辩才与谋略，宜口才、法务、研究",
               "Ju Men and Tian Ji Together"),

    # ---------------- 吉格：太阳天梁 / 巨门系 ----------------
    "阳梁昌禄": ("吉", "太阳天梁文昌禄存会齐，利考试与公职",
               "Sun, Liang, Chang, Lu"),
    "巨日同宫": ("吉", "太阳巨门同宫于寅申，求名易于求利",
               "Ju Men and Sun Together"),
    "石中隐玉": ("吉", "巨门在子午坐命，先苦后甘，以口才与研究立身",
               "Jade Hidden in Stone"),

    # ---------------- 吉格：破军七杀 ----------------
    "英星入庙": ("吉", "破军在子午坐命，敢破敢立，成败皆速",
               "Hero Star Enshrined"),
    "七杀朝斗": ("吉", "七杀坐命寅申子午，向斗而朝，主威权、宜军警与开创",
               "Seven Killings Facing the Dipper"),
    "马头带箭": ("吉", "午宫坐命见擎羊（马头），主威镇边疆、离乡发迹，然辛苦",
               "Arrow at the Horse's Head"),

    # ---------------- 吉格：四化与禄马 ----------------
    "三奇嘉会": ("吉", "命宫三方四正会齐化禄化权化科，主一生机遇顺遂",
               "Three Transformations in Trine"),
    "双禄交流": ("吉", "禄存与化禄同宫或对拱，主财源双至、积累有成",
               "Twin Lu"),
    "双禄朝垣": ("吉", "禄存与化禄分居命宫三方，主财禄拱命、进项不绝",
               "Twin Lu in Trine"),
    "禄马交驰": ("吉", "禄存与天马同宫或对拱，主因动得财、远行致富",
               "Lu and Horse Together"),
    "火贪格": ("吉", "火星与贪狼同宫或对拱，主横发骤富，然来去皆急",
               "Fire and Greedy Wolf"),
    "铃贪格": ("吉", "铃星与贪狼同宫或对拱，主突发之财，宜偏门与投机",
               "Bell and Greedy Wolf"),

    # ---------------- 吉格：辅星 ----------------
    "文星拱命": ("吉", "文昌文曲同会命宫三方，主文才、考试、学术",
               "Literary Stars in Trine"),
    "昌曲夹命": ("吉", "文昌文曲夹命宫，主文名早著、得师长提携",
               "Literary Stars Flanking"),
    "左右同宫": ("吉", "左辅右弼同守命宫，主助力重叠、一生少孤",
               "Both Assistants in the Life Palace"),
    "左右夹命": ("吉", "左辅右弼夹命宫，主一生得人扶持、左右逢源",
               "Assistants Flanking the Life Palace"),
    "魁钺夹命": ("吉", "天魁天钺夹命宫，主贵人夹护、机遇自来",
               "Nobles Flanking the Life Palace"),
    "天乙拱命": ("吉", "天魁天钺同会命宫三方，主贵人相挺、考试得利",
               "Nobles in Trine"),

    # ---------------- 中格：结构 ----------------
    "命无正曜": ("中", "命宫无十四主星，借对宫安星，性格随环境塑造",
               "No Major Star in the Life Palace"),
    "杀破狼": ("中", "七杀破军贪狼三方会照，一生起伏大，宜开创不宜守成",
               "Sha Po Lang"),
    "身命同宫": ("中", "身宫与命宫同宫，主表里如一、亲力亲为，然而劳心",
               "Body and Life in One Palace"),
    "天罗地网": ("中", "命宫坐辰（天罗）或戌（地网），主受限于环境，宜守正待时",
               "Heaven's Net and Earth's Web"),

    # ---------------- 凶格：空劫 ----------------
    "命里逢空": ("凶", "命宫坐地空地劫，主想法高远而落地难，宜技艺不宜守财",
               "Emptiness in the Life Palace"),
    "空劫夹命": ("凶", "地空地劫夹命宫，主进退失据、财来财去",
               "Emptiness Flanking the Life Palace"),
    "两重华盖": ("凶", "命宫与身宫皆见华盖，主孤高、宜宗教艺术，不利俗务",
               "Double Canopy"),

    # ---------------- 凶格：火铃羊陀 ----------------
    "火铃夹命": ("凶", "火星铃星夹命宫，主性急招非、突发之扰",
               "Fire and Bell Flanking the Life Palace"),
    "羊陀夹忌": ("凶", "擎羊陀罗夹化忌所在之宫，主该宫之事受制、久困难解",
               "Sheep and Camel Flanking a Hua Ji"),
    "刑忌夹印": ("凶", "擎羊与化忌夹天相（印星），主文书、契约、官非之累",
               "Punishment and Hua Ji Flanking the Seal"),
    "巨火擎羊": ("凶", "巨门、火星、擎羊同会命宫，主是非、官非与意外，最忌再逢化忌",
               "Ju Men with Fire and Sheep"),
    "天机天梁擎羊会": ("凶", "天机天梁见擎羊同会命宫，主早孤、刑克或体弱",
               "Ji, Liang and Sheep Together"),

    # ---------------- 凶格：化忌 ----------------
    "贪狼化忌": ("凶", "贪狼化忌坐命或会命，主欲望受阻、因贪致损，宜节制",
               "Greedy Wolf Transformed to Ji"),
    "廉贞化忌": ("凶", "廉贞化忌坐命或会命，主血光、官非、情绪困局",
               "Lian Zhen Transformed to Ji"),
    "命宫坐忌": ("凶", "命宫本身坐化忌，主一生所重之事多波折；忌者何事，即何者为患",
               "Hua Ji in the Life Palace"),

    # ---------------- 凶格：日月与孤克 ----------------
    "日月反背": ("凶", "太阳太阴俱落陷，主昼夜奔忙、与亲缘聚少离多",
               "Sun and Moon Reversed"),
    "孤辰寡宿坐命": ("凶", "孤辰或寡宿坐命，主六亲缘薄、宜晚婚或独立",
               "Solitary and Widowed in the Life Palace"),
}


def _ctx(chart) -> dict:
    """Everything the detectors need, gathered once."""
    palaces = {p.index: p for p in chart.palaces}
    by_branch = {p.branch: p for p in chart.palaces}
    ming = next(p for p in chart.palaces if p.name == "命宫")
    shen = next((p for p in chart.palaces if p.is_body), None)

    def stars(p) -> set:
        return {s.name for s in p.stars}

    def majors(p) -> set:
        return {s.name for s in p.stars if s.kind == "主星"}

    def hua(p) -> dict:
        """{star: 禄/权/科/忌} for the stars sitting in one palace."""
        return {s.name: s.hua for s in p.stars if s.hua}

    trio_idx = [ming.index] + [(ming.index + o) % 12 for o in (-4, 4, 6)]
    trio = [palaces[i] for i in trio_idx]
    trio_stars, trio_majors, trio_hua = set(), set(), {}
    for p in trio:
        trio_stars |= stars(p)
        trio_majors |= majors(p)
        trio_hua.update(hua(p))

    def flank(idx: int):
        return palaces[(idx - 1) % 12], palaces[(idx + 1) % 12]

    return {"palaces": palaces, "by_branch": by_branch, "ming": ming,
            "shen": shen, "stars": stars, "majors": majors, "hua": hua,
            "flank": flank, "trio": trio, "trio_stars": trio_stars,
            "trio_majors": trio_majors, "trio_hua": trio_hua}


def _flanked(ctx, idx, a, b) -> bool:
    left, right = ctx["flank"](idx)
    sa, sb = ctx["stars"](left), ctx["stars"](right)
    return (a in sa and b in sb) or (b in sa and a in sb)


def _bright(ctx, star) -> str:
    for p in ctx["trio"]:
        for s in p.stars:
            if s.name == star:
                return s.brightness or ""
    return ""


def detect(chart) -> list:
    """Return every pattern in the table, with a status for each.

    Ordered good-first, then neutral, then bad, so a reader can scan the hits.
    """
    c = _ctx(chart)
    ming = c["ming"]
    ms = c["stars"](ming)
    mm = c["majors"](ming)
    tms = c["trio_majors"]
    tss = c["trio_stars"]
    m_idx = ming.index
    out = []

    #: 三方四正里的煞与忌 —— 「有瑕」的唯一依据
    bad_here = [s for s in BALEFUL if s in tss]
    ji_here = "忌" in set(c["trio_hua"].values())

    def add(name, ok, note="", strict=True, why=""):
        """ok 决定结构成不成立；flaw 单独记瑕疵，不把成立降级。

        上一版把「见两煞」写成 status=有瑕，结果空劫夹命的盘上每一条吉格
        都降级成「有瑕」，页面上一条吉格都不剩。结构成立与成色受损是两件事，
        混在一个字段里，两边都读不出来。
        """
        tier, desc, _en = PATTERNS[name]
        flaw = ""
        if ok and strict and tier == "吉" and (len(bad_here) >= 2 or (bad_here and ji_here)):
            flaw = "、".join(bad_here) + ("及化忌" if ji_here else "") + "同会，成色受损"
        out.append({"name": name, "tier": tier, "desc": desc,
                    "status": "成立" if ok else "不成立",
                    "note": note if ok else "", "flaw": flaw,
                    "why": "" if ok else (why or "")})

    def ming_has(star) -> bool:
        return star in mm

    def ming_pair(a, b) -> bool:
        return a in mm and b in mm

    def same_or_opp(star, star2="", hua="", scope="trio") -> bool:
        """同宫或对拱。scope="trio" 时只认命宫三方四正内的两宫。

        旧版扫全盘：火在官禄、贪狼在夫妻（子午对宫），就判成火贪格 —— 可它
        根本没会到命，与命主无关。禄马、双禄同理，必须会命才算格。
        """
        pool = c["trio"] if scope == "trio" else list(c["palaces"].values())
        for p in pool:
            names = c["stars"](p)
            # 先比同宫 —— 禄马同宫是最常见的形态，只比「对拱」等于把这条格废掉
            same = (star2 in names) if star2 else (hua in c["hua"](p).values())
            if star in names and same:
                return True
            opp = c["palaces"][(p.index + 6) % 12]
            if scope == "trio" and opp not in c["trio"]:
                continue
            if star not in names:
                continue
            nb = c["stars"](opp)
            hit_b = (star2 in nb) if star2 else (hua in c["hua"](opp).values())
            if hit_b:
                return True
        return False

    def where(star) -> str:
        """星所在宫名，用于「为什么不成立」。

        四化（禄/权/科/忌）不是星名而是属性，得先找出是哪颗星化的，
        否则会得到「化禄未入盘」这种明显的错话。
        """
        if star.startswith("化") and len(star) == 2:
            star = star[1:]              # 「化禄」与「禄」是同一次查询
        if star in ("禄", "权", "科", "忌"):
            for p in c["palaces"].values():
                owners = [k for k, v in c["hua"](p).items() if v == star]
                if owners:
                    return f"{p.name}（{owners[0]}化{star}）"
            return "未入盘"
        for p in c["palaces"].values():
            if star in c["stars"](p):
                return p.name
        return "未入盘"

    def two_where(a, b) -> str:
        return f"{a}在{where(a)}、{b}在{where(b)}，两宫不相会"

    # ---------- 紫微系 ----------
    add("紫府同宫", ming_pair("紫微", "天府") and ming.branch in ("寅", "申"),
        "紫微天府同守命宫",
        why=f"紫微在{where('紫微')}、天府在{where('天府')}，不同守命宫或不在寅申")
    add("紫府朝垣", {"紫微", "天府"} <= tms and not ming_pair("紫微", "天府"),
        "紫微天府合照三方",
        why=(f"三方只见{''.join(sorted({'紫微','天府'} & tms))}，紫府未合照"
             if {'紫微','天府'} & tms else "三方四正不见紫微天府"))
    add("君臣庆会", ming_has("紫微")
        and bool({"左辅", "右弼"} & tss) and bool({"天魁", "天钺"} & tss),
        "紫微坐命，辅弼魁钺同会",
        why="紫微不坐命" if not ming_has("紫微")
            else f"三方只补{''.join(sorted(({'左辅','右弼'} | {'天魁','天钺'}) & tss)) or '无'}，君臣未齐")
    add("极向离明", ming_has("紫微") and ming.branch == "午", "紫微在午")
    add("紫府夹命", _flanked(c, m_idx, "紫微", "天府"), "紫微天府夹命")

    # 双星同宫：命宫三方四正之内，两颗主星落在同一宫
    def pair_in_trio(a, b, pairs) -> bool:
        for p in c["trio"]:
            if {a, b} <= c["majors"](p) and p.branch in pairs:
                return True
        return False

    for name, a, b, branches in (
            ("紫贪同宫", "紫微", "贪狼", ("卯", "酉")),
            ("紫相同宫", "紫微", "天相", ("辰", "戌")),
            ("紫杀同宫", "紫微", "七杀", ("巳", "亥")),
            ("紫破同宫", "紫微", "破军", ("丑", "未")),
            ("机阴同宫", "天机", "太阴", ("寅", "申")),
            ("机梁同宫", "天机", "天梁", ("辰", "戌")),
            ("日月同宫", "太阳", "太阴", ("辰", "戌")),
            ("阳梁同宫", "太阳", "天梁", ("卯", "酉")),
            ("武府同宫", "武曲", "天府", ("子", "午")),
            ("财印交驰", "武曲", "天相", ("寅", "申")),
            ("武杀同宫", "武曲", "七杀", ("卯", "酉")),
            ("武破同宫", "武曲", "破军", ("巳", "亥")),
            ("同阴同宫", "天同", "太阴", ("子", "午")),
            ("同巨同宫", "天同", "巨门", ("丑", "未")),
            ("同梁同宫", "天同", "天梁", ("寅", "申")),
            ("廉府同宫", "廉贞", "天府", ("辰", "戌")),
            ("廉贪同宫", "廉贞", "贪狼", ("巳", "亥")),
            ("廉相同宫", "廉贞", "天相", ("子", "午")),
            ("廉杀同宫", "廉贞", "七杀", ("丑", "未")),
            ("廉破同宫", "廉贞", "破军", ("卯", "酉"))):
        add(name, pair_in_trio(a, b, branches), f"{a}{b}同宫{branches[0]}{branches[1]}",
            why=f"{a}在{where(a)}、{b}在{where(b)}，不同宫或不在{branches[0]}{branches[1]}")

    # ---------- 天府天相系 ----------
    add("府相朝垣", {"天府", "天相"} <= tms, "天府天相会照")
    add("财荫夹印", _xiang_flanked_by_fu_liang(c), "天相为天府天梁所夹")

    # ---------- 日月系 ----------
    add("日月并明", {"太阳", "太阴"} <= tms
        and _bright(c, "太阳") in ("庙", "旺")
        and _bright(c, "太阴") in ("庙", "旺"), "日月皆旺")
    add("日丽中天", ming_has("太阳") and ming.branch == "午", "太阳在午")
    add("日照雷门", ming_has("太阳") and ming.branch == "卯", "太阳在卯")
    add("月朗天门", ming_has("太阴") and ming.branch == "亥", "太阴在亥")
    add("月生沧海", ming_has("太阴") and ming.branch == "子", "太阴在子")
    add("日月夹命", _flanked(c, m_idx, "太阳", "太阴"), "日月夹命")

    # ---------- 武曲廉贞系 ----------
    add("武曲守垣", ming_has("武曲") and ming.branch in ("辰", "戌", "丑", "未"),
        "武曲坐命四墓之地")
    add("廉贞清白", ming_has("廉贞") and ming.branch in ("寅", "申"), "廉贞在寅申")
    add("武贪同行", ming_pair("武曲", "贪狼") and ming.branch in ("丑", "未"),
        "武曲贪狼同宫")

    # ---------- 机月同梁系 ----------
    add("机月同梁", {"天机", "太阴", "天同", "天梁"} <= tms, "四星会齐")
    add("天同戌宫", ming_has("天同") and ming.branch == "戌", "天同在戌入庙")
    add("巨机同临", ming_pair("巨门", "天机") and ming.branch in ("卯", "酉"),
        "巨门天机同宫")

    # ---------- 太阳天梁 / 巨门系 ----------
    add("阳梁昌禄", {"太阳", "天梁", "文昌", "禄存"} <= tss, "四星会齐")
    add("巨日同宫", ming_pair("太阳", "巨门") and ming.branch in ("寅", "申"),
        "太阳巨门同宫")
    add("石中隐玉", ming_has("巨门") and ming.branch in ("子", "午"), "巨门在子午")

    # ---------- 破军七杀 ----------
    add("英星入庙", ming_has("破军") and ming.branch in ("子", "午"), "破军入庙")
    add("七杀朝斗", ming_has("七杀") and ming.branch in ("寅", "申", "子", "午"),
        "七杀向斗")
    add("马头带箭", ming.branch == "午" and "擎羊" in ms, "午宫擎羊")

    # ---------- 四化与禄马 ----------
    hua_vals = set(c["trio_hua"].values())
    add("三奇嘉会", {"禄", "权", "科"} <= hua_vals, "禄权科会齐",
        why=(f"三方只得{''.join(sorted(hua_vals))}，三化未齐" if hua_vals
             else "三方四正无化禄化权化科"))
    add("双禄交流", same_or_opp("禄存", hua="禄"), "禄存与化禄同宫或对拱（会命）",
        why=two_where("禄存", "化禄"))
    add("双禄朝垣", bool({"禄存"} & tss)
        and any(v == "禄" for v in c["trio_hua"].values()),
        "禄存与化禄同在三方")
    add("禄马交驰", same_or_opp("禄存", star2="天马"), "禄存与天马同宫或对拱",
        why=two_where("禄存", "天马"))
    add("火贪格", same_or_opp("火星", star2="贪狼"), "火星与贪狼同宫或对拱",
        why=two_where("火星", "贪狼"))
    add("铃贪格", same_or_opp("铃星", star2="贪狼"), "铃星与贪狼同宫或对拱",
        why=two_where("铃星", "贪狼"))

    # ---------- 辅星 ----------
    add("文星拱命", {"文昌", "文曲"} <= tss, "昌曲会命",
        why=f"昌曲在{where('文昌')}，不在命宫三方")
    add("昌曲夹命", _flanked(c, m_idx, "文昌", "文曲"), "昌曲夹命")
    add("左右同宫", {"左辅", "右弼"} <= ms, "辅弼同守命宫")
    add("左右夹命", _flanked(c, m_idx, "左辅", "右弼"), "辅弼夹命")
    add("魁钺夹命", _flanked(c, m_idx, "天魁", "天钺"), "魁钺夹命")
    add("天乙拱命", {"天魁", "天钺"} <= tss, "魁钺会命")

    # ---------- 中格 ----------
    add("命无正曜", not mm, "借对宫安星")
    add("杀破狼", {"七杀", "破军", "贪狼"} <= tms, "三星会照")
    add("身命同宫", c["shen"] is not None and c["shen"].index == m_idx, "身宫即命宫")
    add("天罗地网", ming.branch in ("辰", "戌"),
        "命宫在" + ming.branch + ("（天罗）" if ming.branch == "辰" else "（地网）"))

    # ---------- 凶格 ----------
    add("命里逢空", bool({"地空", "地劫"} & ms),
        "命宫见" + "、".join(sorted({"地空", "地劫"} & ms)), strict=False)
    add("空劫夹命", _flanked(c, m_idx, "地空", "地劫"), "空劫夹命", strict=False)
    add("两重华盖", _double_canopy(c), "命身皆坐华盖", strict=False)
    add("火铃夹命", _flanked(c, m_idx, "火星", "铃星"), "火铃夹命", strict=False)
    add("羊陀夹忌", _flanked_hua_ji(c), "羊陀夹化忌之宫", strict=False)
    add("刑忌夹印", _xing_ji_flank_seal(c), "擎羊与化忌夹天相", strict=False)
    add("巨火擎羊", {"巨门", "火星", "擎羊"} <= tss, "巨火羊同会", strict=False)
    add("天机天梁擎羊会", {"天机", "天梁", "擎羊"} <= tss,
        "机梁羊同会", strict=False)
    add("贪狼化忌", c["trio_hua"].get("贪狼") == "忌", "贪狼化忌会命", strict=False)
    add("廉贞化忌", c["trio_hua"].get("廉贞") == "忌", "廉贞化忌会命", strict=False)
    add("命宫坐忌", "忌" in set(c["hua"](ming).values()),
        "命宫坐" + "、".join(k for k, v in c["hua"](ming).items() if v == "忌"),
        strict=False)
    add("日月反背", _sun_moon_reversed(c), "日月俱陷", strict=False)
    add("孤辰寡宿坐命", bool({"孤辰", "寡宿"} & ms),
        "命宫见" + "、".join(sorted({"孤辰", "寡宿"} & ms)), strict=False)
    return out


def _xiang_flanked_by_fu_liang(c) -> bool:
    """天相（印）左右分别为天府与天梁 —— 财荫夹印。"""
    for p in c["palaces"].values():
        if "天相" not in c["stars"](p):
            continue
        left, right = c["flank"](p.index)
        ls, rs = c["stars"](left), c["stars"](right)
        if ("天府" in ls and "天梁" in rs) or ("天梁" in ls and "天府" in rs):
            return True
    return False


def _double_canopy(c) -> bool:
    shen = c["shen"]
    if shen is None:
        return False
    return "华盖" in c["stars"](c["ming"]) and "华盖" in c["stars"](shen)


def _flanked_hua_ji(c) -> bool:
    for p in c["palaces"].values():
        if "忌" in c["hua"](p).values():
            if _flanked(c, p.index, "擎羊", "陀罗"):
                return True
    return False


def _xing_ji_flank_seal(c) -> bool:
    """天相为印，被擎羊与化忌夹住。"""
    for p in c["palaces"].values():
        if "天相" not in c["stars"](p):
            continue
        left, right = c["flank"](p.index)
        ls, rs = c["stars"](left), c["stars"](right)
        lj = "忌" in c["hua"](left).values()
        rj = "忌" in c["hua"](right).values()
        if ("擎羊" in ls and rj) or ("擎羊" in rs and lj):
            return True
    return False


def _sun_moon_reversed(c) -> bool:
    sun = _bright(c, "太阳")
    moon = _bright(c, "太阴")
    return sun in ("陷", "不") and moon in ("陷", "不")
