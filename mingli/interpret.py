"""Bilingual interpretation layer.

Every sentence is assembled from the chart's own data — no boilerplate that
could be pasted onto any other chart. Star natures and palace themes live in
tables here; the browser build consumes the same tables from data.js and runs
the same assembly, so both surfaces say the same thing.
"""

from __future__ import annotations

from .calendar.ganzhi import GAN_WUXING, KE, SHENG, ZHI
from .calendar.ganzhi import SHISHEN_EN
from .ziwei.chart import STAR_EN as _STAR_EN

HUA_EN = {"禄": "prosperity", "权": "power", "科": "fame", "忌": "obstacle"}
SHISHEN_EN = {k: v.split(" (")[0] for k, v in SHISHEN_EN.items()}

# ---------------------------------------------------------------------------
# 十神
# ---------------------------------------------------------------------------
SHISHEN_INFO = {
    "比肩": {
        "zh": {"core": "同我之阳，主自立、同辈、竞争",
               "pos": "身弱得比肩则能任事，朋友助力实在",
               "neg": "身旺再见比肩则分财夺利，合伙易生嫌隙"},
        "en": {"core": "self-reliance, peers, rivalry",
               "pos": "with a weak day master it supplies real support",
               "neg": "with a strong day master it splits wealth and invites rivalry"},
    },
    "劫财": {
        "zh": {"core": "同我之阴，主争夺、冲动、破耗",
               "pos": "身弱时能帮身御敌，行动力强",
               "neg": "身旺时破财、被借贷、决策冲动"},
        "en": {"core": "contest, impulse, leakage",
               "pos": "supports a weak day master and drives action",
               "neg": "with a strong day master it leaks money and invites impulsive bets"},
    },
    "食神": {
        "zh": {"core": "我生之阳，主才艺、口福、温和输出",
               "pos": "身旺得食神泄秀，才华与收入都稳",
               "neg": "食神过多则散漫、耽于安逸"},
        "en": {"core": "talent, appetite, gentle output",
               "pos": "drains an over-strong chart into skill and steady income",
               "neg": "too much of it scatters focus and indulges comfort"},
    },
    "伤官": {
        "zh": {"core": "我生之阴，主突破、锋芒、口舌",
               "pos": "聪明外露、技艺出众，宜创作与技术",
               "neg": "伤官见官则易与体制、上级冲突"},
        "en": {"core": "breakthrough, edge, sharp tongue",
               "pos": "brilliant technique; suits creation and specialist work",
               "neg": "hurting officer meeting officer means friction with authority"},
    },
    "偏财": {
        "zh": {"core": "我克之阳，主浮动之财、副业、异性缘",
               "pos": "善抓机会，副业与经营有斩获",
               "neg": "偏财无制则来去皆快，投机易失"},
        "en": {"core": "floating wealth, side ventures, attraction",
               "pos": "quick to seize opportunities outside salary",
               "neg": "uncontrolled it comes and goes; speculation leaks"},
    },
    "正财": {
        "zh": {"core": "我克之阴，主稳定收入、务实、配偶",
               "pos": "量入为出、积累扎实，婚姻观务实",
               "neg": "正财过旺则拘谨保守，因小失大"},
        "en": {"core": "steady income, practicality, spouse",
               "pos": "builds solid savings and a matter-of-fact marriage",
               "neg": "when dominant it turns cautious to a fault"},
    },
    "七杀": {
        "zh": {"core": "克我之阳，主压力、竞争、权威",
               "pos": "有制则化为魄力，能在强压下立功",
               "neg": "无制则急躁、树敌、易生意外"},
        "en": {"core": "pressure, competition, authority",
               "pos": "controlled, it becomes decisive nerve under load",
               "neg": "uncontrolled it breeds haste, enemies and accidents"},
    },
    "正官": {
        "zh": {"core": "克我之阴，主名分、制度、责任",
               "pos": "循规成事、有信用，宜体制与大机构",
               "neg": "官星被合被冲则名分不实、受制于人"},
        "en": {"core": "status, rules, responsibility",
               "pos": "delivers through procedure and credibility",
               "neg": "combined or clashed, the title is hollow and you answer to others"},
    },
    "偏印": {
        "zh": {"core": "生我之阳，主偏门学问、直觉、孤独",
               "pos": "悟性高，宜术数、研究、冷门专业",
               "neg": "偏印夺食则思虑过度、行动迟缓"},
        "en": {"core": "unorthodox learning, intuition, solitude",
               "pos": "high insight; suits research, esoterica, niche expertise",
               "neg": "it can swallow output and turn thought into procrastination"},
    },
    "正印": {
        "zh": {"core": "生我之阴，主庇护、文书、名誉",
               "pos": "得长辈与制度之荫，利学历、资格、名声",
               "neg": "印过重则依赖、迟缓、不接地气"},
        "en": {"core": "protection, documents, reputation",
               "pos": "sheltered by elders and institutions; good for degrees",
               "neg": "too heavy it breeds dependence and inertia"},
    },
}

# ---------------------------------------------------------------------------
# 四柱宫位
# ---------------------------------------------------------------------------
PILLAR_INFO = {
    "year": {"zh": "年柱看祖上与出身，也看十五岁前的环境",
             "en": "Year pillar: ancestry, early environment, before 15"},
    "month": {"zh": "月柱看父母、兄弟与青年期，亦为一生成格之本",
              "en": "Month pillar: parents, siblings, youth, and the root of structure"},
    "day": {"zh": "日干为自身，日支为配偶与内在状态",
            "en": "Day stem is the self; day branch is the spouse and inner state"},
    "hour": {"zh": "时柱看子女、晚年与最终归宿",
             "en": "Hour pillar: children, later life, where things land"},
}

# ---------------------------------------------------------------------------
# 紫微
# ---------------------------------------------------------------------------
ZW_PALACE = {
    "命宫": {"zh": ("自我与人格基调", "外在气质、决策方式、一生的主轴"),
             "en": ("self and temperament", "how you present and decide, the spine of the chart")},
    "兄弟": {"zh": ("同辈与竞争", "手足、同侪、合伙人，也看能否借力"),
             "en": ("peers and rivalry", "siblings, colleagues, partners and leverage")},
    "夫妻": {"zh": ("亲密关系", "婚恋模式、配偶特质、长期合作"),
             "en": ("intimacy", "marriage pattern, spouse traits, long partnerships")},
    "子女": {"zh": ("创造与培育", "子女、作品、投资项目"),
             "en": ("creation", "children, output, ventures you nurture")},
    "财帛": {"zh": ("资源与现金流", "赚钱方式、理财习惯、对钱的态度"),
             "en": ("resources", "how money arrives, how you manage it")},
    "疾厄": {"zh": ("身心与消耗", "体质弱点、压力反应、情绪出口"),
             "en": ("body and stress", "physical weak points, stress response")},
    "迁移": {"zh": ("外部环境", "出行、异地、外部机会与社会评价"),
             "en": ("outside world", "travel, relocation, outside opportunity")},
    "仆役": {"zh": ("人脉与团队", "朋友、下属、社群，也看被人拖累"),
             "en": ("network", "friends, staff, community, and who drags you")},
    "官禄": {"zh": ("事业与职位", "职业路径、社会角色、可承担的责任"),
             "en": ("career", "path, role, the responsibility you can carry")},
    "田宅": {"zh": ("根基与资产", "房产、家族、内部安定"),
             "en": ("base and assets", "property, family, domestic stability")},
    "福德": {"zh": ("精神与享受", "心态、兴趣、生活质感"),
             "en": ("inner life", "mood, interests, quality of living")},
    "父母": {"zh": ("长辈与制度", "父母、上司、体制与文书"),
             "en": ("elders", "parents, superiors, institutions, paperwork")},
}

ZW_STAR_EN = {
    "紫微": "Zi Wei", "天机": "Tian Ji", "太阳": "Tai Yang", "武曲": "Wu Qu",
    "天同": "Tian Tong", "廉贞": "Lian Zhen", "天府": "Tian Fu", "太阴": "Tai Yin",
    "贪狼": "Tan Lang", "巨门": "Ju Men", "天相": "Tian Xiang", "天梁": "Tian Liang",
    "七杀": "Qi Sha", "破军": "Po Jun",
}
PALACE_EN = {"命宫": "Life", "兄弟": "Siblings", "夫妻": "Spouse", "子女": "Children",
             "财帛": "Wealth", "疾厄": "Health", "迁移": "Travel", "仆役": "Friends",
             "官禄": "Career", "田宅": "Property", "福德": "Fortune", "父母": "Parents"}

ZW_STAR = {
    "紫微": {"zh": ("尊贵而独断", "天生要位子，能聚人也能压人"),
             "en": ("dignified, self-directed", "claims the seat; gathers people and overrides them")},
    "天机": {"zh": ("机变而多虑", "点子多、转得快，怕的是想太多"),
             "en": ("agile, over-thinking", "quick to pivot, slow to commit")},
    "太阳": {"zh": ("博施而耗散", "肯给、要面子，容易为别人烧自己"),
             "en": ("generous, dispersing", "gives freely and burns out for others")},
    "武曲": {"zh": ("刚决而寡合", "认结果不认情绪，执行力硬"),
             "en": ("decisive, austere", "judges by results, not feelings")},
    "天同": {"zh": ("安逸而畏难", "福气厚，但容易被舒适拖住"),
             "en": ("easy-going, conflict-averse", "blessed, but comfort can stall you")},
    "廉贞": {"zh": ("才情而纠葛", "能成事也易生是非，重情面"),
             "en": ("talented, entangled", "delivers, but invites complications")},
    "天府": {"zh": ("库藏而保守", "能存能守，扩张时偏慢"),
             "en": ("storing, conservative", "holds value well, expands slowly")},
    "太阴": {"zh": ("细腻而内敛", "感受力强，财务与情感都偏静水"),
             "en": ("subtle, inward", "deep feeling; money and love move quietly")},
    "贪狼": {"zh": ("多欲而多才", "兴趣广、手腕活，戒在贪多"),
             "en": ("desirous, versatile", "wide interests and social skill; risk is over-reach")},
    "巨门": {"zh": ("口舌而钻研", "靠嘴与专业吃饭，也易招口舌"),
             "en": ("articulate, probing", "earns by speech and expertise, attracts dispute")},
    "天相": {"zh": ("辅佐而优柔", "会协调、有印信，决断稍慢"),
             "en": ("supportive, indecisive", "coordinates and certifies; hesitates to choose")},
    "天梁": {"zh": ("庇护而固执", "有长辈缘，爱管人也被规矩绑"),
             "en": ("sheltering, rigid", "elders favour you; rules bind you")},
    "七杀": {"zh": ("决断而孤峭", "敢打硬仗，代价是孤独与耗损"),
             "en": ("decisive, stark", "fights hard, pays in solitude and depletion")},
    "破军": {"zh": ("破立而耗损", "先破后立，折腾中成事"),
             "en": ("destructive-rebuilding", "breaks first, builds after; thrives in churn")},
}

HUA_INFO = {
    "禄": {"zh": "化禄主资源顺入、机会自来", "en": "prosperity: resource flows in"},
    "权": {"zh": "化权主掌控与扩张，也主责任加身", "en": "power: control and expansion, plus duty"},
    "科": {"zh": "化科主名声、文书、贵人提名", "en": "fame: reputation, documents, nomination"},
    "忌": {"zh": "化忌主执念与阻滞，力气花在这里", "en": "obstacle: attachment and blockage live here"},
}

BRIGHT_ZH = {"庙": "庙旺得地，力量全出", "旺": "旺而有气，可担事", "得": "得地可用",
             "利": "有利但需借势", "平": "平平，随运而变", "闲": "闲弱，需人扶",
             "不": "不得地，作用有限", "陷": "落陷失据，反成负担"}
BRIGHT_EN = {"庙": "at its peak", "旺": "strong", "得": "solid", "利": "workable with support",
             "平": "neutral", "闲": "idle, needs help", "不": "weak", "陷": "fallen, a liability"}


# ---------------------------------------------------------------------------
# assemblers
# ---------------------------------------------------------------------------

def bazi_sections(chart) -> list[dict]:
    """Return [{key, zh:[paragraphs], en:[paragraphs]}] for the BaZi panel."""
    out = []
    dm = chart.day_master
    st = chart.structure
    th = chart.tiaohou

    # 1. 格局与用神
    zh, en = [], []
    zh.append(f"日主{dm}（{chart.day_master_wx}）生于{chart.month.zhi}月，月令为{chart.strength_label}"
              f"（同党占 {chart.strength:.1f}%）。")
    en.append(f"Day master {dm} ({_en_wx(chart.day_master_wx)}) born in the {chart.month.zhi} month; "
              f"allies take {chart.strength:.1f}% of the chart, so it reads as {_en_strength(chart.strength_label)}.")
    zh.append(f"取格：{st['basis']}。{_structure_comment(st)}")
    en.append(f"Structure: {_structure_comment_en(st)}")
    if th.get("sequence"):
        zh.append(f"调候取{th['sequence']}（{th['primary']}为先）：已见 "
                  f"{'、'.join(th['satisfied']) or '无'}；缺 {'、'.join(th['missing']) or '无'}。{_climate_comment(th)}")
        en.append(f"Climate god: {th['sequence']} (lead: {th['primary']}), present "
                  f"{''.join(th['satisfied']) or 'none'}, missing {''.join(th['missing']) or 'none'}. "
                  f"{_climate_comment_en(th)}")
    out.append({"key": "structure", "zh": zh, "en": en})

    # 2. 十神分布
    counts = {}
    for p in chart.pillars:
        if p.position != "day":
            counts[p.shishen_gan] = counts.get(p.shishen_gan, 0) + 1
        for h in p.hidden:
            from .calendar.ganzhi import shishen as _ss
            s2 = _ss(dm, h)
            counts[s2] = counts.get(s2, 0) + 0.5
    top = sorted(counts.items(), key=lambda kv: -kv[1])[:3]
    zh = []
    en = []
    for name, n in top:
        info = SHISHEN_INFO.get(name)
        if not info:
            continue
        weight = "旺" if n >= 2 else "有"
        zh.append(f"{name}（{info['zh']['core']}）在局中{weight}：{info['zh']['pos']}；"
                  f"但失衡时{info['zh']['neg']}。")
        en.append(f"{SHISHEN_EN.get(name, name)} — {info['en']['core']} — is "
                  f"{'dominant' if n >= 2 else 'present'}: {info['en']['pos']}; "
                  f"out of balance, {info['en']['neg']}.")
    missing = [k for k in SHISHEN_INFO if k not in counts]
    if missing:
        zh.append("全局不见：" + "、".join(missing) + "。缺失的十神往往正是要靠后天补的那一块。")
        en.append("Entirely absent: " + ", ".join(missing) + " — the missing gods mark where you must compensate by effort.")
    out.append({"key": "shishen", "zh": zh, "en": en})

    # 3. 四柱宫位
    zh, en = [], []
    for p in chart.pillars:
        label = PILLAR_INFO[p.position]
        zh.append(f"{p.gan}{p.zhi}（{p.shishen_gan}／{p.shishen_zhi}，{p.stage}）：{label['zh']}。"
                  f"{_pillar_comment(p)}")
        en.append(f"{p.gan}{p.zhi} ({p.shishen_gan} / {p.shishen_zhi}, {p.stage}) — {label['en']}. "
                  f"{_pillar_comment_en(p)}")
    out.append({"key": "pillars", "zh": zh, "en": en})

    # 4. 神煞与刑冲
    zh, en = [], []
    good = [k for k, v in chart.shensha.items() if v["nature"] == "吉"]
    bad = [k for k, v in chart.shensha.items() if v["nature"] == "凶"]
    if good:
        zh.append("吉神：" + "、".join(good) + f"（{len(good)} 颗）。吉神多则遇事有人兜，"
                  "但吉神要落在有用的宫位才算数。")
        en.append("Auspicious stars: " + ", ".join(good) + f" ({len(good)}). They cushion setbacks, "
                  "but only count when they land in a palace that matters.")
    if bad:
        zh.append("凶煞：" + "、".join(bad) + f"（{len(bad)} 颗）。凶煞不是灾，是"
                  "需要提前管理的方向 —— 见冲则动，见合则缓。")
        en.append("Inauspicious stars: " + ", ".join(bad) + f" ({len(bad)}). These are not disasters "
                  "but areas to manage: clash moves them, combination softens them.")
    rel = chart.relations
    if rel.get("冲"):
        zh.append("刑冲：" + "；".join(f"{x['pair']}{x['type']}" for x in rel["冲"])
                  + "。冲主动、主变，冲在哪柱，哪一段人生就多转折。")
        en.append("Clashes: " + "; ".join(x["pair"] for x in rel["冲"])
                  + " — clash means movement; the pillar it hits is where life turns.")
    if rel.get("合"):
        zh.append("六合：" + "；".join(f"{x['pair']}" for x in rel["合"])
                  + "。合主牵绊与整合，也可能把用神合走。")
        en.append("Combinations: " + "; ".join(x["pair"] for x in rel["合"])
                  + " — they bind and integrate, and can also carry the useful god away.")
    out.append({"key": "shensha", "zh": zh, "en": en})
    return out


def ziwei_sections(zchart) -> list[dict]:
    """One section per palace, plus a summary."""
    out = []
    for p in zchart.palaces:
        theme = ZW_PALACE[p.name]
        zh = [f"{theme['zh'][0]}：{theme['zh'][1]}。"]
        en = [f"{theme['en'][0]}: {theme['en'][1]}."]
        majors = [s for s in p.stars if s.kind == "主星"]
        if majors:
            parts_zh, parts_en = [], []
            for s in majors:
                info = ZW_STAR.get(s.name)
                if not info:
                    continue
                b = BRIGHT_ZH.get(s.brightness, "")
                parts_zh.append(f"{s.name}{'（' + s.brightness + '）' if s.brightness else ''}——{info['zh'][0]}，{info['zh'][1]}{('；' + b) if b else ''}")
                b_en = BRIGHT_EN.get(s.brightness, "")
                parts_en.append(f"{ZW_STAR_EN.get(s.name, s.name)}{(' (' + b_en + ')') if b_en else ''} — {info['en'][0]}, {info['en'][1]}")
            zh.append("；".join(parts_zh) + "。")
            en.append("; ".join(parts_en) + ".")
        else:
            zh.append("本宫无十四主星，借对宫安星——性格与处境容易被环境塑造，也更容易受大限牵引。")
            en.append("No major star here: the palace borrows from the opposite one, so this area is shaped by circumstance and moves with the decade.")
        huas = [s for s in p.stars if s.hua]
        for s in huas:
            zh.append(f"{s.name}化{s.hua}：{HUA_INFO[s.hua]['zh']}。")
            en.append(f"{_STAR_EN.get(s.name, s.name)} transforms to {HUA_EN[s.hua]}: {HUA_INFO[s.hua]['en']}.")
        bad = [s.name for s in p.stars if s.kind == "煞星"]
        if bad:
            zh.append(f"煞星：{'、'.join(bad)}——此宫的阻力来自这里，冲劲也来自这里。")
            en.append("Malefics: " + ", ".join(_STAR_EN.get(b, b) for b in bad)
                      + " — both the friction and the drive of this palace come from them.")
        if p.self_hua:
            zh.append("宫干自化：" + "、".join(f"{n}化{h}" for n, h in p.self_hua)
                      + "——力量向内消耗，容易自己跟自己较劲。")
            en.append("Self-transformation: " + ", ".join(f"{_STAR_EN.get(n, n)}→{HUA_EN[h]}" for n, h in p.self_hua)
                      + " — energy turns inward; you fight yourself here.")
        lian = _sanfang_note(zchart, p)
        if lian:
            zh.append(lian[0])
            en.append(lian[1])
        out.append({"key": p.name, "branch": p.branch, "name": p.name,
                    "zh": zh, "en": en})
    return out


def _sanfang_note(zchart, p):
    by_idx = {q.index: q for q in zchart.palaces}
    trio = [by_idx[(p.index + o) % 12] for o in (-4, 4, 6)]
    names = [q.name for q in trio]
    majors, majors_en = [], []
    for q in trio:
        for s in q.stars:
            if s.kind == "主星":
                majors.append(f"{q.name}{s.name}")
                majors_en.append(f"{ZW_STAR_EN.get(s.name, s.name)} in {PALACE_EN.get(q.name, q.name)}")
    if not majors:
        return None
    return ("三方四正会" + "、".join(majors[:4]) + "，此宫的力量由" + "、".join(names) + "共同决定。",
            "The trine and opposite bring " + ", ".join(majors_en[:4]) +
            "; this palace is decided jointly with " + ", ".join(PALACE_EN.get(n, n) for n in names) + ".")


def _structure_comment(st):
    if st["kind"] == "特殊格":
        return "特殊格局不宜用常规喜忌去套，成败系于一点：那一点被破则全局翻转。"
    return "普通格重在用神是否透出有力；格清而用神无力，仍是平常；格浊而用神得力，反能成事。"


def _structure_comment_en(st):
    if st["kind"] == "特殊格":
        return ("an exceptional structure — ordinary favourable-element logic does not apply; "
                "the whole chart turns on one point.")
    return ("an ordinary structure — what matters is whether the useful god is transparent and rooted. "
            "A clean structure with a weak god stays ordinary; a muddy one with a strong god still delivers.")


def _climate_comment(th):
    if not th.get("missing"):
        return "调候齐备，先天气候得宜，起手条件不差。"
    if len(th["missing"]) == len(th.get("sequence", "")):
        return "调候全缺，环境给的支持有限，需靠方位、行业与择时后补——这一块补不上，格局就上不去。"
    return "调候有缺，需靠后天补：方位、行业属性、以及流年走到该五行时集中发力。"


def _climate_comment_en(th):
    if not th.get("missing"):
        return "Climate is complete — the starting conditions are workable."
    if len(th["missing"]) == len(th.get("sequence", "")):
        return ("Nothing of the climate god is present; the environment under-supports you. "
                "Compensate by direction, industry and timing — without it the structure cannot rise.")
    return "Partially present: compensate by direction, industry, and by pushing hard in years that supply the missing element."


def _pillar_comment(p):
    m = {"year": ("年柱见%s，早年环境与门第的底色在此。", "祖荫是起点，不是终点。"),
         "month": ("月柱见%s，成格之本在此，也主青年期的处境。", "月令一柱决定格局高低。"),
         "day": ("日支见%s，为配偶宫，也主内在的安全感来源。", "日支被冲则婚姻与居所易动。"),
         "hour": ("时柱见%s，晚景与子女之象。", "时柱为归宿，早年看不出来。")}
    tpl, tail = m[p.position]
    return tpl % (p.gan + p.zhi) + tail


def _pillar_comment_en(p):
    m = {"year": ("Early environment and family standing sit here.", "Inheritance is a starting point, not an ending."),
         "month": ("The root of the structure, and the conditions of your twenties.", "This pillar sets the ceiling."),
         "day": ("The spouse palace and the source of inner security.", "A clash here moves marriage and home."),
         "hour": ("Later life and children.", "The hour is where things land; it is invisible early on.")}
    a, b = m[p.position]
    return a + " " + b


def _en_wx(w):
    return {"木": "Wood", "火": "Fire", "土": "Earth", "金": "Metal", "水": "Water"}[w]


def _en_strength(s):
    return {"极强": "very strong", "偏强": "strong", "中和": "balanced",
            "偏弱": "weak", "极弱": "very weak"}.get(s, s)


# ---------------------------------------------------------------------------
# term dictionaries (shared with the browser build)
# ---------------------------------------------------------------------------
SHENSHA_EN = {
    "天乙贵人": "Tian Yi (noble aid)", "太极贵人": "Tai Ji (origin noble)",
    "文昌贵人": "Wen Chang (letters)", "国印贵人": "Guo Yin (seal)",
    "福星贵人": "Fu Xing (fortune)", "禄神": "Lu (emolument)",
    "金舆": "Jin Yu (carriage)", "学堂": "Xue Tang (academy)",
    "驿马": "Yi Ma (travel horse)", "桃花": "Peach Blossom",
    "华盖": "Canopy", "将星": "General Star", "红鸾": "Red Phoenix",
    "天喜": "Heavenly Joy", "天德贵人": "Tian De (heavenly virtue)",
    "月德贵人": "Yue De (monthly virtue)", "天医": "Heavenly Doctor",
    "天赦": "Heavenly Amnesty", "三奇贵人": "Three Wonders",
    "羊刃": "Yang Blade", "劫煞": "Robbery Sha", "灾煞": "Calamity Sha",
    "亡神": "Loss Spirit", "孤辰": "Lonely Star", "寡宿": "Widow Star",
    "破碎": "Shatter", "蜚廉": "Fei Lian (slander)", "红艳": "Crimson Charm",
    "流霞": "Flowing Glow", "魁罡": "Kui Gang", "十恶大败": "Ten Evils",
    "阴阳差错": "Yin-Yang Error", "空亡": "Void", "天罗地网": "Heaven Net",
    "四废": "Four Ruins", "天德合": "Tian De Combined",
    "月德合": "Yue De Combined", "天官贵人": "Tian Guan (office)",
    "天厨贵人": "Tian Chu (kitchen)", "金神": "Metal Spirit",
    "飞刃": "Flying Blade", "六秀日": "Six Elegance Day",
    "十灵日": "Ten Spirits Day", "孤鸾煞": "Lone Phoenix", "日德": "Day Virtue",
    "龙德": "Dragon Virtue", "德秀贵人": "Virtue and Grace",
}

STRUCTURE_EN = {
    "正官格": "Direct Officer", "七杀格": "Seven Killings", "正财格": "Direct Wealth",
    "偏财格": "Indirect Wealth", "食神格": "Eating God", "伤官格": "Hurting Officer",
    "正印格": "Direct Resource", "偏印格": "Indirect Resource",
    "建禄格": "Established Emolument", "月刃格": "Month Blade",
    "杂气格": "Mixed Qi", "从格（从势/从财杀）": "Following structure",
    "曲直仁寿格": "Wood dominant", "炎上格": "Fire dominant",
    "稼穑格": "Earth dominant", "从革格": "Metal dominant",
    "润下格": "Water dominant",
}

THEME_EN = {
    "同辈竞争": "peer rivalry", "合作与分利": "partnership and split",
    "自我主张": "self-assertion", "合伙破财": "partner losses",
    "朋友借贷": "loans to friends", "冲动消费": "impulse spending",
    "创作输出": "creative output", "口福与享受": "appetite and pleasure",
    "技术成名": "craft and reputation", "突破常规": "breaking convention",
    "口舌是非": "dispute", "才艺外显": "talent on display",
    "意外之财": "windfall", "副业与投机": "side bets",
    "异性缘": "romantic attention", "正职收入": "salary",
    "稳健积累": "steady saving", "婚姻财务": "marriage and money",
    "压力与竞争": "pressure and rivalry", "权威挑战": "authority conflict",
    "意外风险": "accident risk", "职位与名声": "position and name",
    "制度约束": "institutional limits", "责任加身": "duty imposed",
    "偏门学问": "esoteric study", "灵感与孤独": "insight and solitude",
    "长辈助力": "elder support", "学业与文书": "study and paperwork",
    "贵人庇护": "patronage", "名誉提升": "rising reputation",
}

TIANGAN_WX_EN = {"木": "Wood", "火": "Fire", "土": "Earth", "金": "Metal", "水": "Water"}
