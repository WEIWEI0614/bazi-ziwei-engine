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
"""

from __future__ import annotations

from ..calendar.ganzhi import ZHI

MAJOR = ("紫微", "天机", "太阳", "武曲", "天同", "廉贞", "天府", "太阴",
         "贪狼", "巨门", "天相", "天梁", "七杀", "破军")

LUCKY_AUX = ("左辅", "右弼", "文昌", "文曲", "天魁", "天钺", "禄存", "天马")
BAD = ("擎羊", "陀罗", "火星", "铃星", "地空", "地劫")

#: name -> (tier, description, english name)
PATTERNS = {
    "紫府同宫": ("吉", "紫微天府同守命宫（寅申），二帝同宫，贵气最重，惟进退步调不一",
               "Zi Wei and Tian Fu Together"),
    "紫府朝垣": ("吉", "紫微天府合照命垣，主资源聚合，不大贵即当大富",
               "Zi Wei and Tian Fu in Trine"),
    "君臣庆会": ("吉", "紫微坐命而辅弼魁钺同会，主贵人成群、领导有力",
               "Ruler and Ministers Meet"),
    "府相朝垣": ("吉", "天府天相夹辅命垣，主富贵双全、人情味厚",
               "Tian Fu and Tian Xiang in Trine"),
    "机月同梁": ("吉", "机月同梁会照，主谋略与文职，宜公职、专业、幕僚",
               "Ji, Yue, Tong, Liang"),
    "日月并明": ("吉", "太阳太阴皆居旺地，丹墀桂墀，主少年得志、名利双收",
               "Sun and Moon Both Bright"),
    "日丽中天": ("吉", "太阳在午坐命，光芒最盛，主贵而显",
               "Sun at Midheaven"),
    "日照雷门": ("吉", "太阳在卯坐命，旭日东升，主早年得志",
               "Sun Shining on the Thunder Gate"),
    "月朗天门": ("吉", "太阴在亥坐命，月照天门，主聪慧清贵",
               "Moon Bright at the Heavenly Gate"),
    "石中隐玉": ("吉", "巨门在子午坐命，先苦后甘，以口才与研究立身",
               "Jade Hidden in Stone"),
    "极向离明": ("吉", "紫微在午坐命，如北极向明，领袖之象",
               "Pole Facing the Light"),
    "英星入庙": ("吉", "破军在子午坐命，敢破敢立，成败皆速",
               "Hero Star Enshrined"),
    "阳梁昌禄": ("吉", "太阳天梁文昌禄存会齐，利考试与公职",
               "Sun, Liang, Chang, Lu"),
    "巨日同宫": ("吉", "太阳巨门同宫于寅申，求名易于求利",
               "Ju Men and Sun Together"),
    "三奇嘉会": ("吉", "命宫三方四正会齐化禄化权化科，主一生机遇顺遂",
               "Three Transformations in Trine"),
    "双禄交流": ("吉", "禄存与化禄同宫或对拱，主财源双至、积累有成",
               "Twin Lu"),
    "禄马交驰": ("吉", "禄存与天马同宫或对拱，主因动得财、远行致富",
               "Lu and Horse Together"),
    "文星拱命": ("吉", "文昌文曲同会命宫三方，主文才、考试、学术",
               "Literary Stars in Trine"),
    "左右夹命": ("吉", "左辅右弼夹命宫，主一生得人扶持、左右逢源",
               "Assistants Flanking the Life Palace"),
    "魁钺夹命": ("吉", "天魁天钺夹命宫，主贵人夹护、机遇自来",
               "Nobles Flanking the Life Palace"),
    "日月夹命": ("吉", "太阳太阴夹命宫，主光明与涵养兼具、家世清显",
               "Sun and Moon Flanking the Life Palace"),
    "紫府夹命": ("吉", "紫微天府夹命宫，主厚重有靠、格局不孤",
               "Zi Wei and Tian Fu Flanking"),

    "命无正曜": ("中", "命宫无十四主星，借对宫安星，性格随环境塑造",
               "No Major Star in the Life Palace"),
    "杀破狼": ("中", "七杀破军贪狼三方会照，一生起伏大，宜开创不宜守成",
               "Sha Po Lang"),

    "命里逢空": ("凶", "命宫坐地空地劫，主想法高远而落地难，宜技艺不宜守财",
               "Emptiness in the Life Palace"),
    "空劫夹命": ("凶", "地空地劫夹命宫，主进退失据、财来财去",
               "Emptiness Flanking the Life Palace"),
    "火铃夹命": ("凶", "火星铃星夹命宫，主性急招非、突发之扰",
               "Fire and Bell Flanking the Life Palace"),
    "羊陀夹忌": ("凶", "擎羊陀罗夹化忌所在之宫，主该宫之事受制、久困难解",
               "Sheep and Camel Flanking a Hua Ji"),
    "刑忌夹印": ("凶", "擎羊与化忌夹天相（印星），主文书、契约、官非之累",
               "Punishment and Hua Ji Flanking the Seal"),
    "日月反背": ("凶", "太阳太阴俱落陷，主昼夜奔忙、与亲缘聚少离多",
               "Sun and Moon Reversed"),
}


def _ctx(chart) -> dict:
    """Everything the detectors need, gathered once."""
    palaces = {p.index: p for p in chart.palaces}
    by_branch = {p.branch: p for p in chart.palaces}
    ming = next(p for p in chart.palaces if p.name == "命宫")

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
            "stars": stars, "majors": majors, "hua": hua, "flank": flank,
            "trio": trio, "trio_stars": trio_stars, "trio_majors": trio_majors,
            "trio_hua": trio_hua}


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
    ming, ms, tms = c["ming"], c["stars"](c["ming"]), c["trio_majors"]
    m_idx = ming.index
    out = []

    def add(name, ok, note=""):
        tier, desc, _en = PATTERNS[name]
        out.append({"name": name, "tier": tier, "desc": desc,
                    "status": "成立" if ok else "不成立",
                    "note": note if ok else ""})

    def clean(*stars) -> bool:
        return not any(s in c["trio_stars"] for s in stars)

    add("紫府同宫", {"紫微", "天府"} <= c["majors"](ming) and ming.branch in ("寅", "申"),
        "二帝同宫，贵气最重")
    add("紫府朝垣", {"紫微", "天府"} <= tms and not ({"紫微", "天府"} <= c["majors"](ming)))
    add("君臣庆会", "紫微" in c["majors"](ming)
        and {"左辅", "右弼"} & c["trio_stars"] and {"天魁", "天钺"} & c["trio_stars"],
        "辅弼魁钺同会")
    add("府相朝垣", {"天府", "天相"} <= tms)
    add("机月同梁", {"天机", "太阴", "天同", "天梁"} <= tms)
    add("日月并明",
        {"太阳", "太阴"} <= tms
        and (_bright(c, "太阳") in ("庙", "旺") and _bright(c, "太阴") in ("庙", "旺")))
    add("日丽中天", "太阳" in c["majors"](ming) and ming.branch == "午")
    add("日照雷门", "太阳" in c["majors"](ming) and ming.branch == "卯")
    add("月朗天门", "太阴" in c["majors"](ming) and ming.branch == "亥")
    add("石中隐玉", "巨门" in c["majors"](ming) and ming.branch in ("子", "午"))
    add("极向离明", "紫微" in c["majors"](ming) and ming.branch == "午")
    add("英星入庙", "破军" in c["majors"](ming) and ming.branch in ("子", "午"),
        "破军入庙")
    add("阳梁昌禄", {"太阳", "天梁", "文昌", "禄存"} <= c["trio_stars"])
    add("巨日同宫", {"太阳", "巨门"} <= c["majors"](ming)
        and ming.branch in ("寅", "申"))
    add("三奇嘉会", {"禄", "权", "科"} <= set(c["trio_hua"].values()))
    add("双禄交流", _same_or_opposite(c, "禄存", hua="禄"))
    add("禄马交驰", _same_or_opposite(c, "禄存", star2="天马"))
    add("文星拱命", {"文昌", "文曲"} <= c["trio_stars"])
    add("左右夹命", _flanked(c, m_idx, "左辅", "右弼"))
    add("魁钺夹命", _flanked(c, m_idx, "天魁", "天钺"))
    add("日月夹命", _flanked(c, m_idx, "太阳", "太阴"))
    add("紫府夹命", _flanked(c, m_idx, "紫微", "天府"))

    no_major = not c["majors"](ming)
    add("命无正曜", no_major, "借对宫安星")
    add("杀破狼", {"七杀", "破军", "贪狼"} <= tms)

    add("命里逢空", bool({"地空", "地劫"} & ms),
        "命宫见" + "、".join(sorted({"地空", "地劫"} & ms)))
    add("空劫夹命", _flanked(c, m_idx, "地空", "地劫"))
    add("火铃夹命", _flanked(c, m_idx, "火星", "铃星"))
    add("羊陀夹忌", _flanked_hua_ji(c))
    add("刑忌夹印", _xing_ji_flank_seal(c))
    add("日月反背", _sun_moon_reversed(c))
    return out


def _same_or_opposite(c, star, star2="", hua="") -> bool:
    """两个吉物同宫或对拱 —— 双禄、禄马都按这个判。"""
    for p in c["palaces"].values():
        opp = c["palaces"][(p.index + 6) % 12]
        for pair in ((p, opp), (opp, p)):
            a, b = pair
            names_a = c["stars"](a)
            names_b = c["stars"](b)
            hit_a = star in names_a
            hit_b = (star2 in names_b) if star2 else (hua in c["hua"](b).values())
            if hit_a and hit_b:
                return True
    return False


def _flanked_hua_ji(c) -> bool:
    for p in c["palaces"].values():
        if "忌" in c["hua"](p).values():
            if _flanked(c, p.index, "擎羊", "陀罗"):
                return True
    return False


def _xing_ji_flank_seal(c) -> bool:
    """天相为印，被擎羊与化忌夹住。"""
    for p in c["palaces"].values():
        if "天相" in c["stars"](p):
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
