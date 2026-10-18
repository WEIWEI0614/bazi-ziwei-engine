"""用神体系与格局喜忌 —— 《子平真诠》口径。

旧版的喜忌只有一个开关：日主强弱。身强取食伤财官，身弱取印比，再把调候
主用塞进喜用，于是「喜用」动辄三四个五行、忌神两个 —— 五个五行全被分类，
命局里再没有「闲神」。结果每一年都被判成吉或凶，读数在两端来回跳，用户
自然觉得「大运流年不准」。

这一版按古法重建，四条原则：

1. **格局定用神**。「八字用神，专求月令」。月令所透之十神决定用神是哪一
   个五行；财官印食为善用神顺用，杀伤枭刃为不善用神逆用。
2. **相神与忌神**。生用神者为喜神（相神），克用神者为忌神，其余为闲神。
   闲神不论吉凶 —— 这才是「平年」的来源，也是分档能否拉开的前提。
3. **强弱只作救应**。身弱则印比不列忌神，单列「扶助」；身强则印比加重。
   强弱不改格局结论，只影响成败（与《子平真诠》「格局为主、扶抑为辅」一致）。
4. **十神吉凶随格局变**。正官格见财为喜、见伤官为忌；伤官格见伤官却是
   驾御之象。固定吉神表在这一点上必错，故此处按格局查表。
"""

from __future__ import annotations

from ..calendar.ganzhi import (GAN, GAN_WUXING, HIDDEN, KE, SHENG, ZHI,
                               ZHI_WUXING, shishen)

CLASSES = ("比劫", "食伤", "财", "官杀", "印")

EL_CLASS = {}          # 五行 -> 相对日主的十神大类，运行时填充
for _k in ("木", "火", "土", "金", "水"):
    EL_CLASS[_k] = {
        "木": {"木": "比劫", "火": "食伤", "土": "财", "金": "官杀", "水": "印"},
        "火": {"火": "比劫", "土": "食伤", "金": "财", "水": "官杀", "木": "印"},
        "土": {"土": "比劫", "金": "食伤", "水": "财", "木": "官杀", "火": "印"},
        "金": {"金": "比劫", "水": "食伤", "木": "财", "火": "官杀", "土": "印"},
        "水": {"水": "比劫", "木": "食伤", "火": "财", "土": "官杀", "金": "印"},
    }[_k]

# 具体十神 -> 大类
GOD_CLASS = {
    "比肩": "比劫", "劫财": "比劫",
    "食神": "食伤", "伤官": "食伤",
    "正财": "财", "偏财": "财",
    "正官": "官杀", "七杀": "官杀",
    "正印": "印", "偏印": "印",
}

# 格局名 -> 查表键
GE_KEY = {
    "正官格": "正官", "七杀格": "七杀", "正财格": "正财", "偏财格": "偏财",
    "食神格": "食神", "伤官格": "伤官", "正印格": "正印", "偏印格": "偏印",
    "建禄格": "建禄", "月刃格": "月刃", "比劫格": "比劫",
    "比肩格": "比劫", "劫财格": "比劫", "杂气格": "杂气",
    "从格（从势/从财杀）": "从格",
    "曲直仁寿格": "专旺", "炎上格": "专旺", "稼穑格": "专旺",
    "从革格": "专旺", "润下格": "专旺",
}

# 《子平真诠》八格喜忌：like 顺用之十神，dislike 逆用之十神
GE_PREF = {
    "正官": {"like": ["正财", "偏财", "正印", "偏印"], "dislike": ["伤官", "七杀"]},
    "七杀": {"like": ["食神", "伤官", "正印", "偏印"], "dislike": ["正财", "偏财"]},
    "正财": {"like": ["食神", "伤官", "正官"], "dislike": ["比肩", "劫财"]},
    "偏财": {"like": ["食神", "伤官", "正官", "七杀"], "dislike": ["比肩", "劫财"]},
    "正印": {"like": ["正官", "七杀", "比肩"], "dislike": ["正财", "偏财"]},
    "偏印": {"like": ["正官", "七杀"], "dislike": ["偏财", "正财"]},
    "食神": {"like": ["正财", "偏财", "食神"], "dislike": ["偏印"]},
    "伤官": {"like": ["正财", "偏财", "正印"], "dislike": ["正官"]},
    "建禄": {"like": ["正官", "七杀", "正财", "食神"], "dislike": ["比肩", "劫财", "正印", "偏印"]},
    "月刃": {"like": ["正官", "七杀"], "dislike": ["比肩", "劫财", "正印", "偏印"]},
    "比劫": {"like": ["正官", "七杀", "正财"], "dislike": ["比肩", "劫财"]},
    "杂气": {"like": [], "dislike": []},
    "从格": {"like": [], "dislike": []},
    "专旺": {"like": [], "dislike": []},
}

ZH_CLASS = {"比劫": "比劫", "食伤": "食伤", "财": "财", "官杀": "官杀", "印": "印"}
CLASS_ZH = {"比劫": "比劫（同党）", "食伤": "食伤（泄秀）", "财": "财（耗身）",
            "官杀": "官杀（制身）", "印": "印（生身）"}


def el_of_class(dm_wx: str, cls: str) -> str:
    """某个十神大类对应的五行。"""
    if cls == "比劫":
        return dm_wx
    if cls == "食伤":
        return SHENG[dm_wx]
    if cls == "财":
        return KE[dm_wx]
    if cls == "官杀":
        return [k for k in KE if KE[k] == dm_wx][0]
    return [k for k in SHENG if SHENG[k] == dm_wx][0]


def _present(chart) -> set:
    els = {GAN_WUXING[GAN.index(g)] for g in chart.all_gan()}
    els |= {GAN_WUXING[GAN.index(h)] for h in chart.hidden_all()}
    return els


def _strongest_element(chart, exclude: str = "") -> str:
    es = chart.element_scores
    cand = [k for k in ("木", "火", "土", "金", "水") if k != exclude]
    return max(cand, key=lambda k: es.get(k, 0.0))


def ge_key(name: str) -> str:
    return GE_KEY.get(name, "杂气")


def useful_system(chart) -> dict:
    """返回用神体系：主用 / 喜神 / 忌神 / 扶助 / 闲神，附判词。

    用神由**强弱定方向、格局定先后**：
      · 身强 —— 在格局所喜的财、官杀、食伤里，按格局喜忌的顺序取第一个有根者；
      · 身弱 —— 取印、比，格局喜忌不再决定用神，只用于十神层面加减。
    这样喜用稳定在一两个五行，忌神也只有一个，剩下的才是闲神。旧版把三个
    喜类全塞进 favor，等于「什么都好」，流年自然分不出好坏。
    """
    dm_wx = chart.day_master_wx
    ge = ge_key(chart.structure.get("name", ""))
    pref = GE_PREF.get(ge, {"like": [], "dislike": []})
    present = _present(chart)
    es = chart.element_scores
    strong = chart.strength >= 50
    why = []

    # ---- 1) 主用五行 ----------------------------------------------------
    primary, primary_cls = "", ""
    if ge == "专旺":
        primary, primary_cls = dm_wx, "比劫"
        why.append(f"专旺格以{dm_wx}为体，顺其旺势，不逆不克")
    elif ge == "从格":
        primary = _strongest_element(chart, exclude=dm_wx)
        primary_cls = EL_CLASS[dm_wx][primary]
        why.append(f"从格弃命从势，顺势取{primary}（{CLASS_ZH[primary_cls]}）")
    else:
        # 强弱定方向
        if chart.strength >= 62:
            order = ["正官", "七杀", "正财", "偏财", "食神", "伤官"]
            why.append(f"日主偏强（同党 {chart.strength:.1f}%），宜泄宜克")
        elif chart.strength < 42:
            order = ["正印", "偏印", "比肩", "劫财"]
            why.append(f"日主偏弱（同党 {chart.strength:.1f}%），宜生宜扶")
        else:
            # 中和：回到格局本意
            order = list(pref["like"]) or ["正官", "正财", "食神"]
            why.append(f"日主中和（同党 {chart.strength:.1f}%），依格局取用")
        # 格局定先后：格局所喜者提到前面
        order = [g for g in order if g in pref["like"]] + \
                [g for g in order if g not in pref["like"]]
        for god in order:
            cls = GOD_CLASS[god]
            el = el_of_class(dm_wx, cls)
            if el in present and el not in (primary,):
                primary, primary_cls = el, cls
                why.append(f"取{god}所属之{el}（{CLASS_ZH[cls]}）为用，命局有根")
                break
        if not primary:
            primary = _strongest_element(chart, exclude="")
            primary_cls = EL_CLASS[dm_wx][primary]
            why.append(f"喜用不见于四柱，就命局最旺之{primary}论用，用神虚而力薄")

    # ---- 2) 相神（生用神者）与忌神（克用神者）---------------------------
    xiang = [k for k in SHENG if SHENG[k] == primary][0]      # 生用神
    ji = [k for k in KE if KE[k] == primary][0]               # 克用神
    favor, avoid = [primary], [ji]
    if xiang != ji and xiang not in avoid:
        favor.append(xiang)

    # ---- 3) 身强身弱只作救应 --------------------------------------------
    rescue = []
    yin = [k for k in SHENG if SHENG[k] == dm_wx][0]
    if chart.strength < 42:
        for el in (yin, dm_wx):
            if el in avoid:
                avoid.remove(el)
            if el not in favor:
                rescue.append(el)
        why.append("印比转为扶助，不作忌神论")
    elif chart.strength >= 62:
        # 印比加忌，但忌神总数封顶两个 —— 忌神铺满三个五行就回到
        # 「年年都凶」的老毛病，与旧版「什么都好」是同一个错误的镜像
        room = 2 - len(avoid)
        if room > 0:
            cand = sorted((yin, dm_wx), key=lambda k: -es.get(k, 0))
            added = False
            for el in cand[:room]:
                if el not in favor and el not in avoid:
                    avoid.append(el)
                    added = True
            if added:
                why.append("印比加重为忌")

    # 忌神不得为空：空则无事可忌，每年都成了吉年
    if not avoid:
        for el in ([k for k in KE if KE[k] == primary][0], SHENG[primary]):
            if el not in favor:
                avoid.append(el)
                break

    # ---- 4) 闲神：不作吉凶论 --------------------------------------------
    ents = ("木", "火", "土", "金", "水")
    neutral = [k for k in ents if k not in favor and k not in avoid and k not in rescue]
    if not neutral and len(favor) > 1:
        # 保险：五个全部分完就没有「平年」了，把用神旁边的弱支放回闲神
        weakest = min(favor, key=lambda k: es.get(k, 0.0))
        favor.remove(weakest)
        neutral.append(weakest)
        why.append(f"{weakest}在局中最弱，降为闲神，不作吉凶论")

    # ---- 5) 十神层面的喜忌（供流年判十神用）-----------------------------
    like_gods = set(pref["like"])
    dislike_gods = set(pref["dislike"])

    # 调候：主用若与格局用神不同，只作辅助说明，不进喜忌
    th = chart.tiaohou or {}
    seq = th.get("sequence", "") or ""
    tiaohou_el = GAN_WUXING[GAN.index(seq[0])] if seq else ""

    return {
        "primary": primary, "primary_class": primary_cls,
        "favor": favor, "avoid": avoid, "rescue": rescue, "neutral": neutral,
        "like_gods": like_gods, "dislike_gods": dislike_gods,
        "tiaohou_element": tiaohou_el,
        "ge": ge, "strength": chart.strength, "strong": strong,
        "why": why,
    }


def describe(sysd: dict) -> str:
    """一句话判词，供 CLI / 页面展示。"""
    return (f"用神{sysd['primary']}（{CLASS_ZH[sysd['primary_class']]}），"
            f"喜 {''.join(sysd['favor'])}，忌 {''.join(sysd['avoid']) or '—'}，"
            f"闲 {''.join(sysd['neutral']) or '—'}"
            + (f"；扶助 {''.join(sysd['rescue'])}" if sysd["rescue"] else ""))


def rel_sign(sysd: dict, zhi: str) -> int:
    """被作用之支是喜是忌：+1 去病（冲合忌神为吉），-1 伤用（冲合喜神为凶），0 闲。"""
    el = ZHI_WUXING[ZHI.index(zhi)] if zhi in ZHI else ""
    if el in sysd["favor"]:
        return -1
    if el in sysd["avoid"]:
        return 1
    return 0


def god_score(god: str, sysd: dict, el_favor: bool, el_avoid: bool) -> float:
    """十神吉凶：五行喜忌打底，格局喜忌修正。

    el_favor/el_avoid 由该十神所在五行的喜忌决定，god 本身再按格局表加减 ——
    正官格见伤官是破格，伤官格见伤官是驾御，同一十神两样结论。
    """
    base = 5.0 if el_favor else (-5.0 if el_avoid else 0.0)
    if god in sysd["like_gods"]:
        base += 2.5
    if god in sysd["dislike_gods"]:
        base -= 3.0
    return base
