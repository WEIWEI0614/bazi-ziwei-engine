"""八字合盘 —— 双人关系分析。

不是「生肖配对」那种一句话结论，而是把两盘拆成六层逐层比对：

1. 日主层：两个天干是五合、相生、相克还是比和 —— 决定两人的基本互动模式
2. 夫妻宫层：日支之间的合冲刑害 —— 决定日常相处的摩擦与黏合
3. 五行层：一方缺的五行，另一方是否旺 —— 决定「互补」还是「同病」
4. 用神层：一方的用神是否正是对方命中最旺之气 —— 决定「谁旺谁」
5. 紫微层：两盘命宫与夫妻宫的关系 —— 决定相处的能量方向
6. 十神层：男看财、女看官，另一方的命局是否供养了这颗星

关系类型不同，六层权重不同：夫妻重日支合冲，合伙重五行与财星，
亲子重印星与生克，上下级重官星与强弱对比。
"""

from __future__ import annotations

from .calendar.ganzhi import CHONG, GAN, KE, SHENG, ZHI, GAN_HE

RELATIONS = {
    "couple": {
        "zh": "夫妻 / 伴侣", "en": "Couple",
        "weights": {"dayMaster": 0.22, "spouse": 0.28, "elements": 0.18,
                    "useful": 0.12, "ziwei": 0.12, "shishen": 0.08},
        "note": "重日支合冲与用神互补；合多则黏，冲多则磨。",
        "noteEn": "Weights branch harmony and useful-god complement — attraction versus friction.",
    },
    "lover": {
        "zh": "恋人 / 暧昧", "en": "Romance",
        "weights": {"dayMaster": 0.26, "spouse": 0.34, "elements": 0.14,
                    "useful": 0.10, "ziwei": 0.10, "shishen": 0.06},
        "note": "重吸引与情绪流动，日支合冲的权重最高。",
        "noteEn": "Weights attraction and emotional flow most heavily.",
    },
    "friend": {
        "zh": "朋友", "en": "Friendship",
        "weights": {"dayMaster": 0.28, "spouse": 0.14, "elements": 0.24,
                    "useful": 0.14, "ziwei": 0.12, "shishen": 0.08},
        "note": "重五行是否互补、日主是否比和；朋友之间冲太多容易渐行渐远。",
        "noteEn": "Weights element complement and peer balance.",
    },
    "partner": {
        "zh": "合伙 / 创业", "en": "Business partner",
        "weights": {"dayMaster": 0.24, "spouse": 0.12, "elements": 0.22,
                    "useful": 0.20, "ziwei": 0.10, "shishen": 0.12},
        "note": "重用神与财星：谁主外、谁主内、谁掌钱，看财官星的归属。",
        "noteEn": "Weights the useful god and wealth star — who leads, who holds the money.",
    },
    "parent": {
        "zh": "亲子", "en": "Parent & child",
        "weights": {"dayMaster": 0.24, "spouse": 0.10, "elements": 0.26,
                    "useful": 0.10, "ziwei": 0.12, "shishen": 0.18},
        "note": "重印星与生克：谁生谁、谁耗谁，决定教养方式是扶持还是压制。",
        "noteEn": "Weights the resource star and generation cycle — support versus control.",
    },
    "boss": {
        "zh": "上下级", "en": "Boss & report",
        "weights": {"dayMaster": 0.26, "spouse": 0.10, "elements": 0.18,
                    "useful": 0.14, "ziwei": 0.10, "shishen": 0.22},
        "note": "重官星与强弱：日主强者不宜久居人下，弱者得印护则安。",
        "noteEn": "Weights the officer star and strength balance.",
    },
}

GAN_WX = {GAN[i]: ["木", "木", "火", "火", "土", "土", "金", "金", "水", "水"][i]
          for i in range(10)}
_LIUHE = {"子": "丑", "丑": "子", "寅": "亥", "亥": "寅", "卯": "戌", "戌": "卯",
          "辰": "酉", "酉": "辰", "巳": "申", "申": "巳", "午": "未", "未": "午"}
_LIUHAI = {"子": "未", "未": "子", "丑": "午", "午": "丑", "寅": "巳", "巳": "寅",
           "卯": "辰", "辰": "卯", "申": "亥", "亥": "申", "酉": "戌", "戌": "酉"}
_XING = {("子", "卯"), ("卯", "子"), ("寅", "巳"), ("巳", "申"), ("申", "寅"),
         ("丑", "戌"), ("戌", "未"), ("未", "丑"), ("辰", "辰"), ("午", "午"),
         ("酉", "酉"), ("亥", "亥")}
_SANHE = [("申", "子", "辰", "水"), ("亥", "卯", "未", "木"),
          ("寅", "午", "戌", "火"), ("巳", "酉", "丑", "金")]


def _day_master_score(a, b) -> tuple[float, list[dict]]:
    """日主层：两个天干的关系。"""
    ga, gb = a.day_master, b.day_master
    wa, wb = GAN_WX[ga], GAN_WX[gb]
    out = []
    pair = GAN_HE.get(ga)
    if pair and pair[0] == gb:
        s = 88.0
        out.append({"ok": True, "w": 1.0,
                    "note": f"{ga}与{gb}天干五合（{pair[1]}），天生有默契，"
                            f"彼此容易被对方吸引或认同"})
    elif wa == wb:
        s = 68.0
        out.append({"ok": True, "w": 0.8,
                    "note": f"同为{wa}，性质相近，容易理解彼此，但也容易同进同退、"
                            f"缺乏互补与外部视角"})
    elif SHENG[wa] == wb:
        s = 76.0
        out.append({"ok": True, "w": 0.9,
                    "note": f"{ga}{wa}生{gb}{wb}，前者付出、后者受益；"
                            f"长期看前者易疲，后者易惯"})
    elif SHENG[wb] == wa:
        s = 76.0
        out.append({"ok": True, "w": 0.9,
                    "note": f"{gb}{wb}生{ga}{wa}，后者是前者的资源来源；"
                            f"受者当知回报，否则关系会失衡"})
    elif KE[wa] == wb:
        s = 54.0
        out.append({"ok": False, "w": 1.0,
                    "note": f"{ga}{wa}克{gb}{wb}，前者天然占主导，后者易感到压迫；"
                            f"需要前者主动让出空间"})
    else:
        s = 54.0
        out.append({"ok": False, "w": 1.0,
                    "note": f"{gb}{wb}克{ga}{wa}，后者对前者有克制力；"
                            f"若前者是长辈或上级，关系会较紧绷"})
    return s, out


def _spouse_score(a, b) -> tuple[float, list[dict]]:
    """夫妻宫层：两个日支的关系。"""
    za, zb = a.day.zhi, b.day.zhi
    out = []
    if _LIUHE.get(za) == zb:
        return 90.0, [{"ok": True, "w": 1.0,
                       "note": f"日支{za}与{zb}六合，是最直接的亲密信号："
                               f"生活习惯容易磨合，久处不厌"}]
    for x, y, z, wx in _SANHE:
        if za in (x, y, z) and zb in (x, y, z) and za != zb:
            return 82.0, [{"ok": True, "w": 0.9,
                           "note": f"日支{za}与{zb}成三合{wx}局的一半，"
                                   f"有共同的目标或圈子把两人绑在一起"}]
    if CHONG.get(za) == zb:
        out.append({"ok": False, "w": 1.0,
                    "note": f"日支{za}与{zb}相冲：相处节奏差异大，"
                            f"容易在生活细节上反复摩擦。冲不必然分，但需要明确的边界与分工"})
        return 42.0, out
    if (za, zb) in _XING:
        out.append({"ok": False, "w": 0.8,
                    "note": f"日支{za}与{zb}相刑：容易互相消耗，"
                            f"话赶话就伤到对方，需刻意留白"})
        return 52.0, out
    if _LIUHAI.get(za) == zb:
        out.append({"ok": False, "w": 0.7,
                    "note": f"日支{za}与{zb}相害：暗里较劲，"
                            f"表面无事先说清反而更累"})
        return 58.0, out
    out.append({"ok": True, "w": 0.5,
                "note": f"日支{za}与{zb}无合无冲，属中性：关系走向更多取决于双方的选择，"
                        f"而非命理张力"})
    return 66.0, out


def _element_score(a, b) -> tuple[float, list[dict]]:
    """五行层：一方缺的，另一方是否旺。"""
    ea, eb = a.element_scores, b.element_scores
    out = []
    gap_a = [k for k in ea if ea[k] < 8]
    gap_b = [k for k in eb if eb[k] < 8]
    filled_a = [k for k in gap_a if eb.get(k, 0) >= 20]
    filled_b = [k for k in gap_b if ea.get(k, 0) >= 20]
    total = len(filled_a) + len(filled_b)
    if total >= 3:
        s = 88.0
    elif total == 2:
        s = 78.0
    elif total == 1:
        s = 68.0
    else:
        s = 54.0
    if filled_a:
        out.append({"ok": True, "w": 0.8,
                    "note": f"前者缺{''.join(gap_a) or '—'}，后者正好补上"
                            f"{''.join(filled_a)}——这是最实在的互补"})
    if filled_b:
        out.append({"ok": True, "w": 0.8,
                    "note": f"后者缺{''.join(gap_b) or '—'}，前者正好补上"
                            f"{''.join(filled_b)}"})
    if not total:
        out.append({"ok": False, "w": 0.6,
                    "note": "两人的五行短板高度重合，谁也补不了谁；"
                            "遇到同类困境时容易一起陷进去"})
    return s, out


def _useful_score(a, b) -> tuple[float, list[dict]]:
    """用神层：一方的用神是否在对方命中旺盛。"""
    from .scoring import _useful
    ua, ub = _useful(a), _useful(b)
    fa, fb = ua[0], ub[0]
    out = []
    hit_ab = [k for k in fa if b.element_scores.get(k, 0) >= 18]
    hit_ba = [k for k in fb if a.element_scores.get(k, 0) >= 18]
    n = len(hit_ab) + len(hit_ba)
    s = min(92.0, 58.0 + n * 9.0)
    if hit_ab:
        out.append({"ok": True, "w": 0.9,
                    "note": f"前者的用神是{''.join(fa)}，后者命中"
                            f"{''.join(hit_ab)}旺——后者对前者是「补药」"})
    if hit_ba:
        out.append({"ok": True, "w": 0.9,
                    "note": f"后者的用神是{''.join(fb)}，前者命中"
                            f"{''.join(hit_ba)}旺——前者对后者是「补药」"})
    if not n:
        out.append({"ok": False, "w": 0.6,
                    "note": "彼此的用神都不在对方命里旺，"
                            "这段关系提供的是陪伴而非助力"})
    return s, out


def _ziwei_score(a_z, b_z) -> tuple[float, list[dict]]:
    """紫微层：两盘命宫与夫妻宫的关系。"""
    out = []
    if a_z is None or b_z is None:
        return 65.0, []
    ma, mb = a_z.ming_branch, b_z.ming_branch
    s = 64.0
    if _LIUHE.get(ma) == mb:
        s = 84.0
        out.append({"ok": True, "w": 0.9,
                    "note": f"两盘命宫{ma}与{mb}六合，气场相接，初见即觉投缘"})
    elif CHONG.get(ma) == mb:
        s = 50.0
        out.append({"ok": False, "w": 0.9,
                    "note": f"两盘命宫{ma}与{mb}相冲，行事风格对立；"
                            f"若各自独立反而比紧密协作更顺"})
    else:
        out.append({"ok": True, "w": 0.4,
                    "note": f"两盘命宫{ma}与{mb}无直接合冲，关系质量取决于各自的盘而非互动"})
    # 夫妻宫互看
    sa, sb = a_z.palace("夫妻"), b_z.palace("夫妻")
    if sa and sb:
        if _LIUHE.get(sa.branch) == sb.branch:
            s += 6
            out.append({"ok": True, "w": 0.6,
                        "note": f"两盘夫妻宫{sa.branch}与{sb.branch}六合，"
                                f"双方对婚姻的期待方向一致"})
        elif CHONG.get(sa.branch) == sb.branch:
            s -= 6
            out.append({"ok": False, "w": 0.6,
                        "note": f"两盘夫妻宫{sa.branch}与{sb.branch}相冲，"
                                f"对亲密关系的定义不同，需明确沟通"})
    return max(20.0, min(94.0, s)), out


def _shishen_score(a, b, relation: str) -> tuple[float, list[dict]]:
    """十神层：关系对应的那颗星，对方是否供养。"""
    out = []
    male_a = a.gender in ("male", "男", "m")
    if relation in ("couple", "lover"):
        # 男看财（对方是否财旺），女看官（对方是否官旺）
        if male_a:
            wx = KE[a.day_master_wx]
            have = b.element_scores.get(wx, 0)
            note = (f"男命以{wx}为财（妻星），对方命中{wx}占 {have:.1f}%"
                    + ("，妻星得位" if have >= 18 else "，妻星偏弱，需主动经营"))
        else:
            wx = [k for k in KE if KE[k] == a.day_master_wx][0]
            have = b.element_scores.get(wx, 0)
            note = (f"女命以{wx}为官（夫星），对方命中{wx}占 {have:.1f}%"
                    + ("，夫星得力" if have >= 18 else "，夫星偏弱，宜共同成长"))
        s = min(90.0, 54.0 + have * 1.3)
        out.append({"ok": have >= 14, "w": 0.9, "note": note})
        return s, out
    if relation == "partner":
        wx = KE[a.day_master_wx]
        have = b.element_scores.get(wx, 0)
        s = min(90.0, 54.0 + have * 1.3)
        out.append({"ok": have >= 14, "w": 0.9,
                    "note": f"前者的财星是{wx}，后者命中占 {have:.1f}%；"
                            f"财星旺者宜掌钱，弱者宜掌事"})
        return s, out
    if relation == "parent":
        wx = [k for k in SHENG if SHENG[k] == a.day_master_wx][0]
        have = b.element_scores.get(wx, 0)
        s = min(90.0, 54.0 + have * 1.3)
        out.append({"ok": have >= 14, "w": 0.9,
                    "note": f"前者以{wx}为印（庇荫），后者命中占 {have:.1f}%；"
                            f"印旺则教养偏保护，印弱则偏放手"})
        return s, out
    # boss
    wx = [k for k in KE if KE[k] == a.day_master_wx][0]
    have = b.element_scores.get(wx, 0)
    gap = a.strength - b.strength
    s = min(92.0, 56.0 + have * 1.1 + (6 if gap > 0 else -4))
    out.append({"ok": have >= 14, "w": 0.9,
                "note": f"前者日主强度 {a.strength:.0f}%，后者 {b.strength:.0f}%，"
                        f"差 {abs(gap):.0f} 个百分点；"
                        + ("一方明显能任事，权威关系较自然" if abs(gap) >= 10
                           else "强弱相近，谁说了算容易僵持")})
    return s, out


def compare(chart_a, chart_b, relation: str = "couple",
            ziwei_a=None, ziwei_b=None) -> dict:
    rel = RELATIONS.get(relation) or RELATIONS["couple"]
    w = rel["weights"]

    dm_s, dm_n = _day_master_score(chart_a, chart_b)
    sp_s, sp_n = _spouse_score(chart_a, chart_b)
    el_s, el_n = _element_score(chart_a, chart_b)
    us_s, us_n = _useful_score(chart_a, chart_b)
    zw_s, zw_n = _ziwei_score(ziwei_a, ziwei_b)
    ss_s, ss_n = _shishen_score(chart_a, chart_b, relation)

    total = (dm_s * w["dayMaster"] + sp_s * w["spouse"] + el_s * w["elements"]
             + us_s * w["useful"] + zw_s * w["ziwei"] + ss_s * w["shishen"])

    items = [
        {"key": "dayMaster", "zh": "日主互动", "en": "Day masters",
         "score": round(dm_s, 1), "notes": dm_n},
        {"key": "spouse", "zh": "夫妻宫（日支）", "en": "Day branches",
         "score": round(sp_s, 1), "notes": sp_n},
        {"key": "elements", "zh": "五行互补", "en": "Element fit",
         "score": round(el_s, 1), "notes": el_n},
        {"key": "useful", "zh": "用神互济", "en": "Useful god",
         "score": round(us_s, 1), "notes": us_n},
        {"key": "ziwei", "zh": "紫微气场", "en": "Zi Wei field",
         "score": round(zw_s, 1), "notes": zw_n},
        {"key": "shishen", "zh": "关系星", "en": "Relationship star",
         "score": round(ss_s, 1), "notes": ss_n},
    ]

    if total >= 82:
        band, band_en = "上等", "excellent"
    elif total >= 70:
        band, band_en = "中上", "good"
    elif total >= 58:
        band, band_en = "中等", "workable"
    elif total >= 46:
        band, band_en = "中下", "strained"
    else:
        band, band_en = "下等", "difficult"

    return {
        "relation": relation, "relationZh": rel["zh"], "relationEn": rel["en"],
        "score": round(total, 1), "band": band, "bandEn": band_en,
        "items": items, "weights": w,
        "note": rel["note"], "noteEn": rel["noteEn"],
        "a": {"name": chart_a.name, "four": " ".join(p.gan + p.zhi for p in chart_a.pillars),
              "dm": chart_a.day_master, "dmWx": chart_a.day_master_wx,
              "strength": round(chart_a.strength, 1)},
        "b": {"name": chart_b.name, "four": " ".join(p.gan + p.zhi for p in chart_b.pillars),
              "dm": chart_b.day_master, "dmWx": chart_b.day_master_wx,
              "strength": round(chart_b.strength, 1)},
    }
