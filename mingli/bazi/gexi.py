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

#: 相神 = 用神之外、**与用神同方向**的两类十神。
#:
#: 旧版这里是「十神生克」表，把「克用神者」当忌神。单看十神生克没错，但
#: 套到扶抑上就翻车：丙火身旺、取官杀（水）为用，表里写「食伤克官 → 土为忌」，
#: 而土正是泄旺火之物。于是「喜水金、忌土火」——把药当成了病，而真正的病
#: （印木、比劫火）反而落到闲神。用户一眼就看出来了。
#:
#: 正确的分法只有一条：身旺则印比为病、泄克耗为药；身弱反之。用神只决定
#: 「药里先吃哪一味」，不决定「哪些是药」。
SAME_DIRECTION = {
    "官杀": ("财", "食伤"),
    "财": ("食伤", "官杀"),
    "食伤": ("财", "官杀"),
    "印": ("比劫",),
    "比劫": ("印",),
}

#: 一个五行占到全局这个比例，就已经是「病」而不是「药」，不能再取为用神。
#: 旧版没有这一条，于是 42% 的官杀照样被取为用神，流年再加官杀反而加分。
DOMINANT_SHARE = 34.0

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
        # 格局定先后：格局所喜者排前；同档之内按「局中谁最缺」排。
        order = [g for g in order if g in pref["like"]] + \
                [g for g in order if g not in pref["like"]]
        cands, seen = [], set()
        for god in order:
            cls = GOD_CLASS[god]
            el = el_of_class(dm_wx, cls)
            if el not in present or el in seen:
                continue
            seen.add(el)
            cands.append((god, cls, el, 0 if god in pref["like"] else 1,
                          es.get(el, 0.0)))
        # 已经当令的五行不能当用神：占四成的官杀是病，不是药。
        fit = [c for c in cands if c[4] <= DOMINANT_SHARE]
        pool = fit or cands
        pool.sort(key=lambda c: (c[3], c[4]))
        if pool:
            god, primary_cls, primary, _rank, share = pool[0]
            why.append(f"取{god}所属之{primary}（{CLASS_ZH[primary_cls]}）为用，"
                       f"局中占 {share:.1f}%")
            if len(cands) > len(fit):
                dropped = [c[2] for c in cands if c[4] > DOMINANT_SHARE]
                why.append(f"{''.join(dropped)}已过旺（> {DOMINANT_SHARE:.0f}%），"
                           f"不作用神")
        else:
            primary = _strongest_element(chart, exclude="")
            primary_cls = EL_CLASS[dm_wx][primary]
            why.append(f"喜用不见于四柱，就命局最旺之{primary}论用，用神虚而力薄")

    # ---- 2) 相神与忌神：方向由扶抑定 -----------------------------------
    # favor 是**有序**的：第 1 个是用神，后面依次是相神、次喜。
    # 顺序就是权重，评分层按 favor_weight() 取值，不是「在列表里就算满分」。
    favor = [primary]
    for cls in SAME_DIRECTION.get(primary_cls, ()):
        el = el_of_class(dm_wx, cls)
        if el != primary and el not in favor:
            favor.append(el)

    yin_el = [k for k in SHENG if SHENG[k] == dm_wx][0]
    avoid = []
    if strong:
        # 身旺：生我（印）与同我（比劫）是病
        for el in (yin_el, dm_wx):
            if el not in favor and el not in avoid:
                avoid.append(el)
    else:
        # 身弱：克我、我克、我生 三者为病，取局中最旺的两个
        cand = [el_of_class(dm_wx, c) for c in ("官杀", "财", "食伤")]
        cand = [e for e in cand if e not in favor and e not in avoid]
        cand.sort(key=lambda e: -es.get(e, 0.0))
        avoid = cand[:2]

    # ---- 3) 扶助（身弱专用）--------------------------------------------
    rescue = [el for el in (yin_el, dm_wx) if el not in favor and el not in avoid][:2]
    if avoid:
        why.append("忌" + "".join(avoid) + "（" +
                   ("生我、同我，加重偏旺" if strong else "克我、耗我、泄我") + "）")

    # 忌神不得为空：空则无事可忌，每年都成了吉年
    if not avoid:
        for el in ([k for k in KE if KE[k] == primary][0], SHENG[primary]):
            if el not in favor:
                avoid.append(el)
                break

    # ---- 4) 闲神：不作吉凶论 --------------------------------------------
    ents = ("木", "火", "土", "金", "水")
    neutral = [k for k in ents if k not in favor and k not in avoid and k not in rescue]
    # 闲神**允许为空**。旧版强留至少一个闲神，结果是把第三味药降级成平年，
    # 于是「身旺三喜两忌」的盘永远有一个该吉的五行被判成无吉无凶。
    # 五行分完不是问题：favor 内部本来就有主次（favor_weight）。

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


#: favor 列表内部的分量：用神 1.0，第一相神 0.65，次喜 0.40。
#: 没有这一层，「三喜」的盘每个喜神都按满分算，分数会一律偏高。
FAVOR_W = (1.0, 0.65, 0.40)


def favor_weight(sysd: dict, el: str) -> float:
    """单个五行对本盘的吉凶分量：+1 用神 … -1 忌神，0 闲神。"""
    f = sysd.get("favor") or []
    if el in f:
        return FAVOR_W[min(f.index(el), len(FAVOR_W) - 1)]
    if el in (sysd.get("avoid") or []):
        return -1.0
    if el in (sysd.get("rescue") or []):
        return 0.5
    return 0.0


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


def god_score(god: str, sysd: dict, el_favor, el_avoid: bool = False) -> float:
    """十神吉凶：五行喜忌打底，格局喜忌修正。

    el_favor 收 **0–1 的权重**（favor_weight 的返回值，用神 1.0 / 相神 0.65 /
    次喜 0.40）。旧版是布尔，三喜的盘三个喜神同分；次喜与用神等权，正好把
    「土为次喜」抬到和「水为用神」一样重。布尔 True 仍按 1.0 处理。
    """
    if el_favor is True:
        w = 1.0
    elif el_favor is False or el_favor is None:
        w = 0.0
    else:
        w = float(el_favor)
    # 五行方向只给 ±2，**不再给 ±5**。
    # 这一项的「这个五行是喜是忌」已经被「用神」项算过一次（±20 那一项），
    # 再按 ±5 算一遍，等于同一个事实罚两遍：丙午年丙火为忌，用神项扣一次，
    # 比肩七杀再扣一次，两项叠加就把总分直接压到下限。
    # 这里只保留「十神层面的增量」——格局喜忌（正官格见伤官是破格这类）。
    base = 2.0 * w if w > 0 else (-2.0 if el_avoid else 0.0)
    if god in sysd["like_gods"]:
        base += 2.5
    if god in sysd["dislike_gods"]:
        base -= 3.0
    return base
