"""Luck cycles (大運), annual (流年) and monthly (流月) timelines."""

from __future__ import annotations

import datetime as _dt
from dataclasses import dataclass, field

from ..calendar import astro, lunar
from ..calendar.ganzhi import (CHONG, GAN, GAN_CHONG, GAN_HE, GAN_WUXING, HAI6,
                               HE6, HIDDEN, KE, PO, SANHE, SHENG, TIANYI,
                               WENCHANG, ZHI, ZHI_WUXING, LU, shishen)

POS_NAMES = ("年", "月", "日", "时")
POS_WEIGHT = {"年": 0.7, "月": 1.0, "日": 1.3, "时": 0.8}


@dataclass
class LuckCycle:
    index: int
    gan: str
    zhi: str
    start_age: int
    end_age: int
    start_year: int
    end_year: int
    shishen_gan: str
    shishen_zhi: str
    active: bool = False

    @property
    def label(self) -> str:
        return self.gan + self.zhi


@dataclass
class Period:
    """One year or one month on the timeline."""
    kind: str                  # 'year' | 'month'
    label: str                 # 干支
    gan: str = ""
    zhi: str = ""
    name: str = ""             # e.g. 2026 / 2026-03
    start: str = ""
    end: str = ""
    shishen_gan: str = ""
    shishen_zhi: str = ""
    score: float = 50.0
    band: str = ""
    components: dict = field(default_factory=dict)
    themes: list = field(default_factory=list)
    relations: list = field(default_factory=list)
    cautions: list = field(default_factory=list)
    opportunities: list = field(default_factory=list)
    luck_cycle: str = ""


def _is_yang(gan: str) -> bool:
    return GAN.index(gan) % 2 == 0


def luck_direction(chart) -> int:
    """+1 順行, -1 逆行."""
    yang = _is_yang(chart.year.gan)
    male = chart.gender in ("male", "男", "m")
    return 1 if (yang == male) else -1


def start_luck(chart) -> tuple[int, int, _dt.datetime]:
    """(起運年數, 起運月數, 交運日期) — 3 日折 1 年."""
    direction = luck_direction(chart)
    jd_birth = chart.jd
    if direction > 0:
        jd_ref = chart.jie_next[0]
        days = jd_ref - jd_birth
    else:
        jd_ref = chart.jie_prev[0]
        days = jd_birth - jd_ref
    total_months = days * 4.0                 # 1 日 = 4 個月
    years = int(total_months // 12)
    months = int(round(total_months - years * 12))
    if months >= 12:
        years += 1
        months -= 12
    # 交運日
    d = chart.birth_local
    y = d.year + years
    m = d.month + months
    if m > 12:
        y += 1
        m -= 12
    try:
        handover = d.replace(year=y, month=m)
    except ValueError:
        handover = d.replace(year=y, month=m, day=28)
    return years, months, handover


def luck_cycles(chart, count: int = 10, as_of: int | None = None) -> list[LuckCycle]:
    direction = luck_direction(chart)
    years, months, handover = start_luck(chart)
    base = (GAN.index(chart.month.gan), ZHI.index(chart.month.zhi))
    # the month pillar's sexagenary index
    m_idx = next(i for i in range(60)
                 if i % 10 == base[0] and i % 12 == base[1])
    out = []
    now_year = as_of or _dt.date.today().year
    start_year = handover.year
    for k in range(1, count + 1):
        idx = (m_idx + direction * k) % 60
        g, z = GAN[idx % 10], ZHI[idx % 12]
        sy = start_year + (k - 1) * 10
        cyc = LuckCycle(
            index=k, gan=g, zhi=z,
            start_age=years + (k - 1) * 10,
            end_age=years + (k - 1) * 10 + 9,
            start_year=sy, end_year=sy + 9,
            shishen_gan=shishen(chart.day_master, g),
            shishen_zhi=shishen(chart.day_master, HIDDEN[z][0]),
        )
        cyc.active = cyc.start_year <= now_year <= cyc.end_year
        out.append(cyc)
    return out


# ---------------------------------------------------------------------------
# Interaction engine
# ---------------------------------------------------------------------------


def zhi_relations(a: str, b: str) -> list[str]:
    out = []
    if HE6[a] == b:
        out.append("六合")
    if CHONG[a] == b:
        out.append("六冲")
    if HAI6[a] == b:
        out.append("相害")
    if PO[a] == b:
        out.append("相破")
    for grp in (("子", "卯"), ("寅", "巳", "申"), ("丑", "戌", "未")):
        if a in grp and b in grp and a != b:
            out.append("相刑")
    if a == b:
        if a in ("辰", "午", "酉", "亥"):
            out.append("自刑")
        else:
            out.append("伏吟")
    return out


def gan_relations(a: str, b: str) -> list[str]:
    out = []
    if GAN_HE.get(a, ("",))[0] == b:
        out.append("天干五合")
    if GAN_CHONG.get(a) == b:
        out.append("天干相冲")
    return out


def _element_of(gan: str, zhi: str) -> dict:
    d = {w: 0.0 for w in ("木", "火", "土", "金", "水")}
    d[GAN_WUXING[GAN.index(gan)]] += 0.40
    weights = {1: (1.0,), 2: (0.7, 0.3), 3: (0.6, 0.28, 0.12)}[len(HIDDEN[zhi])]
    for h, w in zip(HIDDEN[zhi], weights):
        d[GAN_WUXING[GAN.index(h)]] += 0.60 * w
    return d


def useful_elements(chart) -> tuple[list[str], list[str], dict]:
    """Return (喜用, 忌, explanation) from strength + 調候 + 格局."""
    dm_wx = chart.day_master_wx
    yin = [k for k in SHENG if SHENG[k] == dm_wx][0]
    shi = SHENG[dm_wx]
    cai = KE[dm_wx]
    guan = [k for k in KE if KE[k] == dm_wx][0]
    strong = chart.strength >= 50

    favor, avoid = [], []
    if strong:
        favor = [shi, cai, guan]
        avoid = [dm_wx, yin]
        reason = (f"日主{dm_wx}偏强（同党 {chart.strength:.1f}%），宜泄宜克："
                  f"以{shi}（食伤）泄秀、{cai}（财）耗身、{guan}（官杀）制身")
    else:
        favor = [yin, dm_wx]
        avoid = [cai, guan, shi]
        reason = (f"日主{dm_wx}偏弱（同党 {chart.strength:.1f}%），宜生宜扶："
                  f"以{yin}（印）生身、{dm_wx}（比劫）帮身")

    # 調候：只取「主用」（sequence 第一位），且必须从忌神中剔除。
    # 早前把整个 sequence 都塞进 favor，导致戊土这样的佐神同时出现在喜与忌里，
    # favor 膨胀到四个五行，等于「什么都好」，流年判断随之失效。
    th = chart.tiaohou
    th_els = []
    seq = th.get("sequence", "") or ""
    if seq:
        w = GAN_WUXING[GAN.index(seq[0])]
        th_els.append(w)
        if w in avoid:
            avoid.remove(w)
        if w not in favor:
            favor.insert(0, w)
    explanation = {
        "strength_based": reason,
        "tiaohou": (f"調候取{th.get('sequence','')}（{th.get('primary','')}為先），"
                    f"已見：{''.join(th.get('satisfied', [])) or '無'}；"
                    f"缺：{''.join(th.get('missing', [])) or '無'}"),
        "note": "喜用神為啟發式判定，流派不同結論可能不同，請對照 events 校準結果。",
    }
    return favor, avoid, explanation


# ---------------------------------------------------------------------------
# Period scoring
# ---------------------------------------------------------------------------


def _band(score: float) -> str:
    if score >= 80:
        return "大吉"
    if score >= 68:
        return "吉"
    if score >= 58:
        return "小吉"
    if score >= 46:
        return "平"
    if score >= 42:
        return "小凶"
    if score >= 38:
        return "偏弱"
    return "凶"


THEME_MAP = {
    "比肩": ("同辈竞争", "合作与分利", "自我主张"),
    "劫财": ("合伙破财", "朋友借贷", "冲动消费"),
    "食神": ("创作输出", "口福与享受", "技术成名"),
    "伤官": ("突破常规", "口舌是非", "才艺外显"),
    "偏财": ("意外之财", "副业与投机", "异性缘"),
    "正财": ("正职收入", "稳健积累", "婚姻财务"),
    "七杀": ("压力与竞争", "权威挑战", "意外风险"),
    "正官": ("职位与名声", "制度约束", "责任加身"),
    "偏印": ("偏门学问", "灵感与孤独", "长辈助力"),
    "正印": ("学业与文书", "贵人庇护", "名誉提升"),
}


# 十神吉凶（《渊海子平》通行分法）
AUSPICIOUS = {"正财", "正印", "正官", "食神"}
OMINOUS = {"伤官", "七杀", "劫财", "偏印"}


def _ten_god_score(god: str, is_favor: bool) -> float:
    """吉神在流年为喜用最好；凶神为忌最重。"""
    if god in AUSPICIOUS:
        return 5.0 if is_favor else 1.5
    if god in OMINOUS:
        return -1.5 if is_favor else -5.0
    return 1.5 if is_favor else -1.5


def evaluate_period(chart, gan: str, zhi: str, luck: LuckCycle | None = None) -> dict:
    """流年/流月评分。

    判法依《子平真诠》「以用神为纲，以格局为本，以岁运为用」，顺序为：
        1. 先看喜忌 —— 干支五行是否命局所需（地支为主，天干主外）
        2. 再看十神 —— 吉神 / 凶神 / 中神 与喜忌交叉
        3. 后看会合刑冲 —— 「有合先论合，无合论刑冲」，合可解冲
        4. 再叠大运 —— 大运定十年基调，流年只是触发
        5. 神煞仅作辅助，不压过五行喜忌
    """
    dm = chart.day_master
    ss_g = shishen(dm, gan)
    ss_z = shishen(dm, HIDDEN[zhi][0])
    favor, avoid, _ = useful_elements(chart)
    comp: dict[str, float] = {}

    # ---- 1) 喜忌：地支 0.6、天干 0.4，地支权重加倍（主吉凶之本体）---------
    add = _element_of(gan, zhi)
    # 负向系数低于正向：不得用是常态，得用才是稀缺，故不一味重罚。
    # 更重要的一条：忌神有制则不凶 —— 局中有克它或泄它的五行且有力时，惩罚折半。
    es = chart.element_scores
    gain = 0.0
    loss = 0.0
    for el, v in add.items():
        if v <= 0:
            continue
        if el in favor:
            gain += v * 1.7
        if el in avoid:
            ctrl = [k for k in KE if KE[k] == el][0]      # 克我者
            drain = SHENG[el]                              # 我生者（泄）
            checked = max(es.get(ctrl, 0), es.get(drain, 0))
            loss += v * (0.55 if checked >= 8 else 1.10)
    # 上限收到 ±18/−16：原来的 ±26 只要干支都落在喜用就顶格，
    # 于是同一张盘在 80 与 25 之间反复跳，读起来像「命在剧烈摇摆」。
    comp["用神"] = round(max(-16.0, min(18.0, (gain - loss) * 40.0)), 1)
    comp["忌神有制"] = 1.0 if loss < sum(v * 1.10 for e, v in add.items() if e in avoid) else 0.0

    # ---- 2) 十神 ----------------------------------------------------------
    f_gan = GAN_WUXING[GAN.index(gan)] in favor
    f_zhi = GAN_WUXING[GAN.index(HIDDEN[zhi][0])] in favor
    god_s = _ten_god_score(ss_g, f_gan) * 0.5 + _ten_god_score(ss_z, f_zhi) * 0.7
    comp["十神"] = round(god_s, 1)

    # ---- 3) 会合刑冲（有合先论合）----------------------------------------
    rels: list[str] = []
    penalty = 0.0
    bonus = 0.0
    POSW = {"年": 1.0, "月": 1.2, "日": 1.4, "时": 0.9}
    for i, p in enumerate(chart.pillars):
        pos = POS_NAMES[i]
        w = POSW[pos]
        zrels = zhi_relations(p.zhi, zhi)
        has_he = "六合" in zrels
        for r in zrels:
            rels.append(f"{pos}支{p.zhi}与{zhi}{r}")
            if r == "六合":
                bonus += 3.2 * w
            elif r == "六冲":
                # 合能解冲：本柱既合又冲时，冲力折半
                penalty += (3.5 if has_he else 7.0) * w
            elif r == "相刑":
                penalty += 4.0 * w
            elif r in ("相害", "相破"):
                penalty += 2.5 * w
            elif r == "伏吟":
                penalty += 3.5 * w
        for r in gan_relations(p.gan, gan):
            rels.append(f"{pos}干{p.gan}与{gan}{r}")
            if r == "天干相冲":
                penalty += 3.5 * w
            elif r == "天干五合":
                bonus += 2.2 * w
        if GAN_CHONG.get(p.gan) == gan and CHONG[p.zhi] == zhi:
            penalty += 6.0 * w
            rels.append(f"与{pos}柱天克地冲")
    for grp in SANHE:
        if zhi in grp[:3]:
            have = [z for z in chart.all_zhi() if z in grp[:3] and z != zhi]
            if len(set(have)) >= 2:
                bonus += 5.0
                rels.append(f"{zhi}与命局成三合{grp[3]}局")
            elif len(set(have)) == 1:
                bonus += 2.0
                rels.append(f"{zhi}与{have[0]}半合{grp[3]}局")
    comp["冲合"] = round(bonus - penalty, 1)

    # ---- 4) 大运（定十年基调，流年只作触发）------------------------------
    tone = 0.0
    big = 0.0
    if luck:
        lg, lz = luck.gan, luck.zhi
        ladd = _element_of(lg, lz)
        lg_gain = sum(v for e, v in ladd.items() if e in favor)
        lg_loss = sum(v for e, v in ladd.items() if e in avoid)
        tone = max(-1.0, min(1.0, (lg_gain - lg_loss) * 1.8))
        big = tone * 7.0
        if GAN_CHONG.get(lg) == gan and CHONG[lz] == zhi:
            big -= 8.0
            rels.append("大运流年天克地冲")
        if zhi == lz:
            big -= 3.0
            rels.append("流年伏吟大运")
        elif CHONG.get(lz) == zhi:
            big -= 2.5
            rels.append("流年冲大运")
    comp["大运"] = round(big, 1)

    # ---- 5) 神煞（辅助，不压喜忌）----------------------------------------
    sha = 0.0
    if zhi in TIANYI.get(dm, ()):
        sha += 4.0
        rels.append("流年天乙贵人")
    if zhi == WENCHANG.get(dm):
        sha += 3.0
        rels.append("流年文昌")
    if zhi == LU.get(dm):
        sha += 3.0
        rels.append("流年临禄")
    if zhi in ("辰", "戌", "丑", "未") and ss_z in ("正官", "七杀"):
        sha -= 2.0
    comp["神煞"] = round(sha, 1)

    raw = 50.0 + comp["用神"] + comp["十神"] + comp["冲合"] + comp["大运"] + comp["神煞"]

    # 大运吉而流年凶 → 不至大凶；大运凶而流年吉 → 吉力打折
    if tone > 0 and raw < 50:
        raw = 50 - (50 - raw) * (1 - 0.42 * tone)
    elif tone < 0 and raw > 50:
        raw = 50 + (raw - 50) * (1 - 0.42 * abs(tone))

    # 收窄到 40–86：实际命理软件的单年读数很少低于 40 或高于 86，
    # 这是「倾向」而非「判决」，压缩后才有可比性。
    score = 50.0 + (max(0.0, min(100.0, raw)) - 50.0) * 0.72
    score = max(40.0, min(88.0, score))
    comp["base"] = 50.0
    comp["raw"] = round(raw, 1)
    comp["大运基调"] = round(tone, 2)

    themes = list(THEME_MAP.get(ss_g, ())) + list(THEME_MAP.get(ss_z, ()))
    seen, th = set(), []
    for t in themes:
        if t not in seen:
            seen.add(t)
            th.append(t)

    cautions: list[str] = []
    for r in rels:
        if "六冲" in r and "日" in r:
            cautions.append("日支被冲：住所、婚姻或自身状态易有变动，忌仓促决定")
        elif "六冲" in r and "月" in r:
            cautions.append("月柱被冲：工作环境或家庭结构面临调整")
        elif "六冲" in r and "年" in r:
            cautions.append("年柱被冲：长辈、根基或长期规划受扰")
        elif "六冲" in r and "时" in r:
            cautions.append("时柱被冲：子女、下属或投资标的易有变动")
        elif "天克地冲" in r:
            cautions.append("天克地冲：该领域阻力最大，宜守不宜攻")
        elif "相刑" in r:
            cautions.append("相刑：易生是非、官非或健康小疾，注意契约与口舌")
        elif "相害" in r:
            cautions.append("相害：人际暗耗，慎防被牵连")
        elif "伏吟" in r:
            cautions.append("伏吟：旧事重来，情绪反复，宜静守")
    if ss_g in OMINOUS and score < 48:
        cautions.append(f"{ss_g}当值而全局失衡：压力与是非集中，忌硬碰体制与上级")
    if ss_g in AUSPICIOUS and score >= 55:
        cautions.append("吉神当值，宜按程序推进，勿走捷径以免失信")

    opps: list[str] = []
    if score >= 62:
        opps.append(f"{ss_g}/{ss_z}得用，是推进主业与积累信誉的窗口")
    joined = " ".join(rels)
    if "天乙贵人" in joined:
        opps.append("天乙贵人到位：主动求见关键人物，成功率高")
    if "文昌" in joined:
        opps.append("文昌到位：考试、论文、资格与公开发表皆宜")
    if "临禄" in joined:
        opps.append("临禄：正财与职位稳固，适合谈薪与升迁")
    if comp["用神"] >= 12:
        opps.append(f"喜用{''.join(favor)}当令，资源顺势而来，宜进取")
    if "三合" in joined or "半合" in joined:
        opps.append("成合局：宜合作、宜结盟，借他人之力成事")

    # 同一句提示可能由多个柱位触发（例如两柱伏吟），去重后只留一次
    cautions = list(dict.fromkeys(cautions))
    opps = list(dict.fromkeys(opps))
    return {
        "shishen_gan": ss_g, "shishen_zhi": ss_z, "score": round(score, 1),
        "band": _band(score), "components": comp, "relations": rels,
        "themes": th, "cautions": cautions, "opportunities": opps,
    }


def year_period(chart, year: int, luck: LuckCycle | None = None) -> Period:
    idx = (year - 4) % 60
    g, z = GAN[idx % 10], ZHI[idx % 12]
    ev = evaluate_period(chart, g, z, luck)
    start = astro.from_jd(astro.term_local(year, "立春"))
    end = astro.from_jd(astro.term_local(year + 1, "立春"))
    p = Period(kind="year", label=g + z, gan=g, zhi=z, name=str(year),
               start="%04d-%02d-%02d" % start[:3],
               end="%04d-%02d-%02d" % end[:3],
               luck_cycle=luck.label if luck else "")
    p.score, p.band = ev["score"], ev["band"]
    p.shishen_gan, p.shishen_zhi = ev["shishen_gan"], ev["shishen_zhi"]
    p.components, p.relations = ev["components"], ev["relations"]
    p.themes, p.cautions, p.opportunities = (ev["themes"], ev["cautions"],
                                             ev["opportunities"])
    return p


def month_periods(chart, year: int, luck: LuckCycle | None = None) -> list[Period]:
    """12 節氣 months of a 流年 (立春 -> next 立春)."""
    out = []
    order = ["立春", "惊蛰", "清明", "立夏", "芒种", "小暑",
             "立秋", "白露", "寒露", "立冬", "大雪", "小寒"]
    yg = GAN[(year - 4) % 10]
    for k, name in enumerate(order):
        yy = year if name != "小寒" else year + 1
        start = astro.term_local(yy, name)
        nxt_name = order[k + 1] if k + 1 < 12 else "立春"
        nxt_year = yy if k + 1 < 12 else year + 1
        try:
            end = astro.term_local(nxt_year, nxt_name)
        except Exception:
            end = start + 30
        # 月柱
        zhi = ["寅", "卯", "辰", "巳", "午", "未",
               "申", "酉", "戌", "亥", "子", "丑"][k]
        first = {0: 2, 5: 2, 1: 4, 6: 4, 2: 6, 7: 6, 3: 8, 8: 8, 4: 0, 9: 0}[GAN.index(yg)]
        gan = GAN[(first + k) % 10]
        ev = evaluate_period(chart, gan, zhi, luck)
        s = astro.from_jd(start)
        e = astro.from_jd(end)
        p = Period(kind="month", label=gan + zhi, gan=gan, zhi=zhi,
                   name="%04d-%02d" % (s[0], s[1]),
                   start="%04d-%02d-%02d" % s[:3],
                   end="%04d-%02d-%02d" % e[:3])
        p.score = ev["score"]
        # months are scaled: pull toward 50
        p.score = round(50 + (ev["score"] - 50) * 0.72, 1)
        p.band = _band(p.score)
        p.shishen_gan, p.shishen_zhi = ev["shishen_gan"], ev["shishen_zhi"]
        p.components, p.relations = ev["components"], ev["relations"]
        p.themes, p.cautions, p.opportunities = (ev["themes"], ev["cautions"],
                                                 ev["opportunities"])
        out.append(p)
    return out


def _today_jd() -> float:
    n = _dt.datetime.now()
    return astro.to_jd(n.year, n.month, n.day, n.hour, n.minute)


def timeline(chart, from_year: int | None = None, years: int = 12,
             as_of_year: int | None = None) -> list[dict]:
    """Consecutive 流年 with the governing 大运 attached."""
    start = from_year or (as_of_year or _dt.date.today().year) - 2
    cycles = luck_cycles(chart, count=12, as_of=start)
    out = []
    for y in range(start, start + years):
        cyc = next((c for c in cycles if c.start_year <= y <= c.end_year), None)
        p = year_period(chart, y, cyc)
        d = p.__dict__.copy()
        d["luck_cycle"] = cyc.label if cyc else ""
        d["age"] = y - chart.birth_local.year + 1
        out.append(d)
    return out
