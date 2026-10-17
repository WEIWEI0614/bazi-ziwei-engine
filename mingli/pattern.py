"""格局贵贱判定 —— 与传统命理的「成格 / 破格 / 救应」逻辑对齐。

为什么单独一层
--------------
`scoring.py` 算的是**结构强度**：五行占比、调候命中率、日主旺衰、神煞数量。
那是「量」的问题，加权平均即可。

但传统命理判「上格 / 中格 / 下格」从不看平均分，而是三步：

1. **先看成不成格** —— 《子平真诠》：「八字用神，专求月令，以日干配月令地支，
   而生克不同，格局分焉。」格不成，力量再大也是散兵。
2. **再看有无破** —— 《渊海子平》列正官格九破：伤官克官、官杀混杂、食神合官、
   劫来分福、冲、刑、破害、印重泄气、财印互碍。
3. **最后看救应** —— 《五言独步》：「有病方为贵，无伤不是奇，格中若弃病，
   财禄喜相随。」有破而有救，其贵**反大于**全然无破，因为「病重而药真」。

所以本模块输出的是**格位**（贵贱），scoring 输出的是**强度**（力量），
两者分开显示，互不折算。一个从格可以身弱而格高，一个身强之造也可以格低。

紫微一侧同构：吉格成立要「有禄存、科权禄、左右、昌曲、魁钺加会，无煞方合此格；
见四煞空劫忌诸恶同宫，谓之奴欺主、臣蔽君，反为祸乱，不合此格」。
因此每个吉格都带 `aux_min`（最少吉星加会数）与 `breakers`（破格星）。
"""

from __future__ import annotations

from .calendar.ganzhi import GAN, GAN_WUXING, KE, LU, SHENG, YANGREN, ZHI

_GWX = {GAN[i]: GAN_WUXING[i] for i in range(10)}
_POS = {"year": "年", "month": "月", "day": "日", "hour": "时"}
_LIUHE = {"子": "丑", "丑": "子", "寅": "亥", "亥": "寅", "卯": "戌", "戌": "卯",
          "辰": "酉", "酉": "辰", "巳": "申", "申": "巳", "午": "未", "未": "午"}

# ---------------------------------------------------------------------------
# 格位
# ---------------------------------------------------------------------------

GRADES = [
    (88.0, "上上格", "top"),
    (74.0, "上格", "upper"),
    (60.0, "中上格", "upper-middle"),
    (44.0, "中格", "middle"),
    (28.0, "中下格", "lower-middle"),
    (0.0, "下格", "low"),
]

GRADE_EN = {
    "上上格": "top grade", "上格": "upper grade", "中上格": "upper-middle grade",
    "中格": "middle grade", "中下格": "lower-middle grade", "下格": "low grade",
}


def grade_of(score: float) -> str:
    for cut, name, _ in GRADES:
        if score >= cut:
            return name
    return "下格"


# ---------------------------------------------------------------------------
# 八字：条件表
# ---------------------------------------------------------------------------

# 十神 → 该十神对格局的「正面」权重（见《子平真诠》六格）
_STEM_W = {"年": 1.0, "月": 1.4, "日": 0.6, "时": 0.8}


def _has_root(chart, stem_wx: str) -> bool:
    """该五行在地支（含藏干）是否有根。"""
    for p in chart.pillars:
        for h in p.hidden:
            if _GWX.get(h) == stem_wx:
                return True
    return False


def _branch_wx(chart, wx: str) -> int:
    n = 0
    for p in chart.pillars:
        for h in p.hidden:
            if _GWX.get(h) == wx:
                n += 1
    return n


def _clashed(chart, pos: str) -> bool:
    """某柱地支是否被其他柱冲。"""
    from .calendar.ganzhi import CHONG
    target = getattr(chart, pos).zhi
    for p in chart.pillars:
        if p.position != pos and CHONG.get(target) == p.zhi:
            return True
    return False


def _combined_stem(chart, stem: str) -> str:
    """返回能合走该天干的柱位，没有则空串。"""
    from .calendar.ganzhi import GAN_HE
    pair = GAN_HE.get(stem)
    if not pair:
        return ""
    target = pair[0] if isinstance(pair, tuple) else pair
    for p in chart.pillars:
        if p.gan == target:
            return p.position
    return ""


def _shensha_at(chart, name: str, pos: str | None = None) -> bool:
    v = chart.shensha.get(name)
    if not v:
        return False
    return pos is None or pos in v["positions"]


BAZI_CHECKS_DOC = {
    # 每条：key, 中文名, 权重, 说明（写进报告，供人复核）
}


def bazi_grade(chart) -> dict:
    """逐条检查成格 / 破格 / 救应，返回可复核的明细。"""
    dm = chart.day_master
    dm_wx = chart.day_master_wx
    yin_wx = [k for k in SHENG if SHENG[k] == dm_wx][0]
    shi_wx = SHENG[dm_wx]
    cai_wx = KE[dm_wx]
    guan_wx = [k for k in KE if KE[k] == dm_wx][0]

    items: list[dict] = []          # {kind, name, ok, weight, note}

    def add(kind, name, ok, weight, note):
        items.append({"kind": kind, "name": name, "ok": bool(ok),
                      "weight": weight, "note": note})

    st = chart.structure
    strong = chart.strength >= 52

    # ---- 1. 成格 ----------------------------------------------------------
    add("setup", "取格有据", True, 6,
        f"月令{chart.month.zhi}，{st.get('basis', st['name'])}")
    # 月令本气是否透干（格清）
    clean = bool(st.get("transparent"))
    add("setup", "格清气透", clean, 8,
        "月令藏干透于天干，格象清而不杂" if clean
        else "月令藏干未透，格以本气论，力散而象平")

    # 官 / 财 / 印 / 身 四者是否有根（《子房》上等格之形）
    four = [
        ("官星有根", _branch_wx(chart, guan_wx) >= 1,
         f"{guan_wx}为官杀，藏于地支 {_branch_wx(chart, guan_wx)} 处"),
        ("财星有根", _branch_wx(chart, cai_wx) >= 1,
         f"{cai_wx}为财，藏于地支 {_branch_wx(chart, cai_wx)} 处"),
        ("印星有根", _branch_wx(chart, yin_wx) >= 1,
         f"{yin_wx}为印，藏于地支 {_branch_wx(chart, yin_wx)} 处"),
        ("日主得地", chart.strength >= 45,
         f"日主同党 {chart.strength:.1f}%，{chart.strength_label}"),
    ]
    four_ok = sum(1 for _, ok, _ in four if ok)
    for nm, ok, note in four:
        add("setup", nm, ok, 5, note)
    add("setup", "官财印身俱备", four_ok == 4, 10,
        f"四者得 {four_ok}/4。" + ("合《子平》上等格之形：官财印身四者皆有强根。" if four_ok == 4
                                  else "尚缺其一，格有偏处，需运来补。"))

    # 身格匹配
    if strong:
        match = _branch_wx(chart, cai_wx) >= 1 or _branch_wx(chart, guan_wx) >= 1
        add("setup", "身强能任财官", match, 7,
            "日主偏强而财官有根，担得起" if match else "身强而财官无根，力无所用")
    else:
        add("setup", "身弱得印比扶", _branch_wx(chart, yin_wx) >= 1, 7,
            "日主偏弱而印星有根，扶得起" if _branch_wx(chart, yin_wx) >= 1
            else "身弱而印比无力，格高身弱，福不称格")

    # 贵气
    noble = 0
    noble_names = []
    for nm, w in (("天乙贵人", 5), ("天德贵人", 4), ("月德贵人", 4),
                  ("文昌贵人", 3), ("学堂", 3), ("国印贵人", 3)):
        if _shensha_at(chart, nm):
            noble += w
            noble_names.append(nm)
    add("setup", "命带贵气", noble > 0, min(12, noble),
        ("带 " + "、".join(noble_names) + "，贵气有根") if noble_names
        else "无贵气星，全凭格局本身")

    # 流通
    chain = 0
    ws = ["木", "火", "土", "金", "水"]
    es = chart.element_scores
    for i in range(5):
        if es.get(ws[i], 0) >= 4 and es.get(ws[(i + 1) % 5], 0) >= 4:
            chain += 1
    add("setup", "五行流通", chain >= 3, min(8, chain * 2.2),
        f"相邻相生链 {chain} 条，气脉{'贯通' if chain >= 3 else '偏滞'}")

    # ---- 2. 破格 ----------------------------------------------------------
    # 官星被合
    guan_stems = [p for p in chart.pillars
                  if p.shishen_gan in ("正官", "七杀")]
    b0 = 0
    for p in guan_stems:
        who = _combined_stem(chart, p.gan)
        if who:
            b0 += 7
            add("break", f"{_POS[p.position]}干官星被合", True, 7,
                f"{_POS[p.position]}干{p.gan}（{p.shishen_gan}）被{_POS[who]}干合去，官星失用")
    if not b0 and guan_stems:
        add("break", "官星不受合", False, 0, "官星透干而无人合走，贵气可用")

    # 伤官见官（食神合官已在上一条计入，此处只论伤官，避免重复扣分）
    if b0 == 0 and any(p.shishen_gan == "伤官" for p in chart.pillars) and guan_stems:
        add("break", "伤官见官", True, 5,
            "伤官与官星并见，贵气受损（《渊海子平》九破之一）")

    # 羊刃无制
    if chart.month.zhi == YANGREN.get(dm):
        has_ctrl = any(p.shishen_gan in ("正官", "七杀") for p in chart.pillars)
        add("break", "羊刃无杀制", not has_ctrl, 5,
            "月令帝旺为刃，局中无官杀制之，刚而易折" if not has_ctrl
            else "刃有官杀制，反成贵格（刃杀两停）")

    # 比劫争财
    rivals = [p for p in chart.pillars if p.shishen_gan in ("比肩", "劫财")
              and p.position != "日"]
    if rivals:
        add("break", "比劫争财", _branch_wx(chart, cai_wx) >= 1, 4,
            f"{len(rivals)} 处比劫透干，与日主分争{KE[dm_wx]}财"
            if _branch_wx(chart, cai_wx) >= 1 else "有比劫而无财可争，反主朋友助力")

    # 月令被冲
    add("break", "月令被冲", _clashed(chart, "month"), 6,
        "月令为格之所系，被冲则根气摇动" if _clashed(chart, "month")
        else "月令无冲，格局安稳")

    # 日主被合
    dhe = _combined_stem(chart, dm)
    add("break", "日主被合", bool(dhe), 4,
        f"日主{dm}被{dhe}干合，意志易受牵制" if dhe else "日主不受合，自主性强")

    # 调候全缺
    th = chart.tiaohou
    if th.get("sequence"):
        seq = th["sequence"]
        gans = [p.gan for p in chart.pillars]
        hidden = [h for p in chart.pillars for h in p.hidden]
        SUBST = {"壬": "癸", "癸": "壬", "庚": "辛", "辛": "庚", "甲": "乙", "乙": "甲",
                 "丙": "丁", "丁": "丙", "戊": "己", "己": "戊"}
        got = [c for c in seq if c in gans or c in hidden]
        subs = [SUBST[c] for c in seq if c not in got
                and (SUBST.get(c) in gans or SUBST.get(c) in hidden)]
        if not got and not subs:
            add("break", "调候全缺", True, 5,
                f"调候取{seq}而局中全无，气候失和")
        elif not got:
            add("break", "调候以同类代之", True, 2,
                f"调候{seq}不见，得{''.join(subs)}同类代之，力减而意存")

    # ---- 3. 救应（有病得药，其贵反大）-----------------------------------
    # 制合官之神
    for p in [p for p in chart.pillars if p.shishen_gan in ("食神", "伤官")]:
        ctrl = [q for q in chart.pillars
                if q.shishen_gan in ("偏印", "正印", "七杀")
                and q.position != p.position]
        if ctrl and b0:
            add("rescue", f"{p.position}干食伤被制", True, 7,
                f"{ctrl[0].position}干{ctrl[0].gan}（{ctrl[0].shishen_gan}）"
                f"制{p.gan}（{p.shishen_gan}），官星得以保全——此为一救")

    # 官星有源（财生官）
    if guan_stems and _branch_wx(chart, cai_wx) >= 2:
        add("rescue", "财旺生官", True, 6,
            f"财{KE[dm_wx]}藏支 {_branch_wx(chart, cai_wx)} 处，官星虽被合而源不绝")

    # 食神化劫生财：比劫与财之间若有食伤通关，劫不夺财，反成生财之源
    if rivals and _branch_wx(chart, cai_wx) >= 1:
        bridges = [p for p in chart.pillars
                   if p.shishen_gan in ("食神", "伤官") and p.position != "日"]
        if bridges:
            add("rescue", "食伤通关化劫", True, 5,
                f"{_POS[bridges[0].position]}干{bridges[0].gan}（{bridges[0].shishen_gan}）"
                "通关：比劫之气泄于食伤，食伤转而生财，劫不夺财")

    # 冲而有合解
    if _clashed(chart, "month"):
        mz = chart.month.zhi
        for p in chart.pillars:
            if p.position != "month" and _LIUHE.get(p.zhi) == mz:
                add("rescue", "冲而得合", True, 5,
                    f"{p.position}支{p.zhi}与月令{mz}六合，冲力得解")
                break

    # 忌神有制
    from .scoring import _useful
    _u = _useful(chart)
    favor, avoid = _u[0], _u[1]
    if avoid:
        hit = [p for p in chart.pillars
               if any(_GWX.get(h) in avoid for h in p.hidden)]
        if hit:
            add("rescue", "忌神入墓受制", True, 4,
                f"忌神{''.join(avoid)}落于{hit[0].position}支{hit[0].zhi}，其势受制")

    # ---- 汇总 ------------------------------------------------------------
    setup = sum(i["weight"] for i in items if i["kind"] == "setup" and i["ok"])
    setup_max = sum(i["weight"] for i in items if i["kind"] == "setup") or 1
    brk = sum(i["weight"] for i in items if i["kind"] == "break" and i["ok"])
    res = sum(i["weight"] for i in items if i["kind"] == "rescue" and i["ok"])

    # 成格度（0..1）占 62 分基底；破格按条扣；救应按 1.35 倍回补
    #   —— 1.35 不是随手取的：《五言独步》「有病方为贵」，有救之破不算真破
    ratio = setup / setup_max
    raw = 26.0 + 62.0 * ratio - brk + res * 1.35
    score = max(6.0, min(99.0, raw))

    return {
        "score": round(score, 1),
        "grade": grade_of(score),
        "setup_ratio": round(ratio, 3),
        "setup_score": round(setup, 1), "setup_max": round(setup_max, 1),
        "broken": brk, "rescued": round(res, 1),
        "items": items,
        "structure": st["name"],
    }


# ---------------------------------------------------------------------------
# 紫微：吉格成立条件
# ---------------------------------------------------------------------------

LUCKY_AUX = {"左辅", "右弼", "文昌", "文曲", "天魁", "天钺", "禄存",
             "天马", "三台", "八座", "龙池", "凤阁", "恩光", "天贵"}
BREAKERS = {"擎羊", "陀罗", "火星", "铃星", "地空", "地劫"}


def _trio(z, palace):
    by_idx = {p.index: p for p in z.palaces}
    return [by_idx[(palace.index + o) % 12] for o in (-4, 4, 6)]


def _majors(ps):
    return {s.name for p in ps for s in p.stars if s.kind == "主星"}


def _auxs(ps):
    return {s.name for p in ps for s in p.stars if s.name in LUCKY_AUX}


def _bads(ps):
    return {s.name for p in ps for s in p.stars if s.name in BREAKERS}


def _jis(ps):
    return [s for p in ps for s in p.stars if s.hua == "忌"]


def ziwei_grade(z) -> dict:
    """按古法「方合此格」的严格条件判定紫微吉格。"""
    ming = z.palace("命宫")
    trio = _trio(z, ming)
    all4 = [ming] + trio
    mm = _majors([ming])
    m4 = _majors(all4)
    aux4 = _auxs(all4)
    bad4 = _bads(all4)
    bad_ming = _bads([ming])
    ji4 = _jis(all4)

    found = []

    def reg(name, cond, need, note, tier="贵格"):
        if not cond:
            return
        aux_n = len(aux4 & need) if need else len(aux4)
        need_n = 2 if need else 1
        clean = (not bad4) or (len(bad4) == 1 and not bad_ming)
        if aux_n >= need_n and clean:
            found.append({"name": name, "status": "成立", "tier": tier,
                          "note": note, "aux": aux_n, "bad": sorted(bad4)})
        else:
            why = []
            if aux_n < need_n:
                why.append("吉星加会不足")
            if not clean:
                why.append("见" + "、".join(sorted(bad4)) + "，奴欺主")
            if ji4:
                why.append("化忌同会")
            found.append({"name": name, "status": "有瑕", "tier": tier,
                          "note": note + "（" + "；".join(why) + "）",
                          "aux": aux_n, "bad": sorted(bad4)})

    # 极向离明：紫微在午坐命
    reg("极向离明", mm == {"紫微"} and ming.branch == "午", set(), "紫微居午，如北极向明，领袖之象", "大贵格")
    # 紫府同宫：寅申紫微天府同宫
    reg("紫府同宫", mm == {"紫微", "天府"} and ming.branch in ("寅", "申"), set(),
        "二帝同宫，贵气最重，惟进退步调不一", "大贵格")
    # 紫府朝垣：紫微天府于三方四正照命
    reg("紫府朝垣", {"紫微", "天府"} <= m4, {"左辅", "右弼", "文昌", "文曲", "天魁", "天钺", "禄存"},
        "紫府合照命垣，主资源聚合，不大贵即当大富", "大贵格")
    # 君臣庆会：命宫紫微 + 左右魁钺昌曲
    reg("君臣庆会", "紫微" in mm, {"左辅", "右弼", "文昌", "文曲", "天魁", "天钺"},
        "紫微为君，辅弼昌曲为臣，主领导与助力兼备", "大贵格")
    # 府相朝垣：天府天相分居财官照命
    cai = z.palace("财帛")
    guan = z.palace("官禄")
    reg("府相朝垣", {"天府", "天相"} <= _majors([cai, guan]), {"左辅", "右弼", "文昌", "文曲", "禄存"},
        "府相夹辅命垣，主富贵双全、人情味厚", "贵格")
    # 机月同梁
    reg("机月同梁", {"天机", "太阴", "天同", "天梁"} <= m4, set(),
        "机月同梁作吏人，宜公职、专业、幕僚", "常格")
    # 日丽中天 / 日照雷门 / 月朗天门 / 石中隐玉 / 英星入庙
    reg("日丽中天", mm == {"太阳"} and ming.branch == "午", set(), "太阳在午，光芒最盛，主贵而显", "贵格")
    reg("日照雷门", mm == {"太阳"} and ming.branch == "卯", set(), "太阳在卯，旭日东升，主早年得志", "贵格")
    reg("月朗天门", mm == {"太阴"} and ming.branch == "亥", set(), "太阴在亥，月照天门，主聪慧清贵", "贵格")
    reg("石中隐玉", mm == {"巨门"} and ming.branch in ("子", "午"), set(), "巨门在子午，先苦后甘，以口才与研究立身", "贵格")
    reg("英星入庙", mm == {"破军"} and ming.branch in ("子", "午"), set(), "破军在子午入庙，敢破敢立", "常格")
    # 阳梁昌禄
    reg("阳梁昌禄", {"太阳", "天梁", "文昌", "禄存"} <= m4, set(), "四星会齐，利考试与公职", "贵格")
    # 巨日同宫
    reg("巨日同宫", mm == {"巨门", "太阳"} and ming.branch in ("寅", "申"), set(), "巨日同宫，求名易于求利", "贵格")
    # 日月并明
    sun_p = [p for p in z.palaces if any(s.name == "太阳" for s in p.stars)]
    moon_p = [p for p in z.palaces if any(s.name == "太阴" for s in p.stars)]
    if sun_p and moon_p:
        sb, mb = sun_p[0].branch, moon_p[0].branch
        reg("日月并明", (sb == "巳" and mb == "酉") or (sb == "辰" and mb == "戌"), set(),
            "日月皆旺，丹墀桂墀，主少年得志", "贵格")
    # 杀破狼
    reg("杀破狼", {"七杀", "破军", "贪狼"} <= m4, set(),
        "杀破狼三方会照，一生起伏大，宜开创不宜守成", "变格")
    # 命无正曜
    if not mm:
        found.append({"name": "命无正曜", "status": "成立", "tier": "常格",
                      "note": "命宫无十四主星，借对宫安星，性格随环境塑造",
                      "aux": len(aux4), "bad": sorted(bad4)})

    # ---- 计分 ------------------------------------------------------------
    tier_w = {"大贵格": 96.0, "贵格": 86.0, "常格": 70.0, "变格": 62.0}
    if found:
        base = max(tier_w.get(f["tier"], 70.0) for f in found)
        # 有瑕者按瑕疵数递减
        best = max(found, key=lambda f: tier_w.get(f["tier"], 70) - (0 if f["status"] == "成立" else 9))
        if best["status"] != "成立":
            base -= 9 + 2.5 * len(best["bad"])
    else:
        base = 56.0

    # 命宫本身的旺衰微调（星曜庙旺、吉煞）
    comp_bonus = 0.0
    for s in ming.stars:
        if s.kind == "主星":
            comp_bonus += {"庙": 3.0, "旺": 2.2, "得地": 1.2, "利": 0.6,
                           "平": 0.0, "不得地": -1.2, "陷": -2.4}.get(s.brightness, 0)
        elif s.name in LUCKY_AUX:
            comp_bonus += 1.2
        elif s.name in BREAKERS:
            comp_bonus -= 2.2
        if s.hua == "禄":
            comp_bonus += 2.0
        elif s.hua == "权":
            comp_bonus += 1.5
        elif s.hua == "科":
            comp_bonus += 1.5
        elif s.hua == "忌":
            comp_bonus -= 2.6
    score = max(8.0, min(99.0, base + max(-8, min(8, comp_bonus))))

    return {
        "score": round(score, 1),
        "grade": grade_of(score),
        "patterns": found,
        "ming_aux": sorted(aux4), "ming_bad": sorted(bad4),
        "ji": [s.name for s in ji4],
    }


# ---------------------------------------------------------------------------
# 综合
# ---------------------------------------------------------------------------

def combined_grade(bazi: dict, ziwei: dict, bazi_weight: float = 0.55) -> dict:
    """八字格为主、紫微格为辅。传统以子平立格论贵贱，斗数参其气象。"""
    score = bazi_weight * bazi["score"] + (1 - bazi_weight) * ziwei["score"]
    grade = grade_of(score)
    return {
        "score": round(score, 1),
        "grade": grade,
        "grade_en": GRADE_EN[grade],
        "bazi": bazi, "ziwei": ziwei,
        "basis": (f"八字格 {bazi['score']:.1f}（{bazi['grade']}，成格度 "
                  f"{bazi['setup_ratio'] * 100:.0f}%，破 {bazi['broken']} 分、"
                  f"救 {bazi['rescued']} 分）· 紫微格 {ziwei['score']:.1f}"
                  f"（{ziwei['grade']}）"),
    }
