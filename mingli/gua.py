"""梅花易数起卦 —— 时间起卦、六十四卦、体用生克。

起卦法（邵雍《梅花易数》）
    上卦 = (年支数 + 农历月 + 农历日) % 8      余 0 作 8
    下卦 = (年支数 + 农历月 + 农历日 + 时支数) % 8
    动爻 = (年支数 + 农历月 + 农历日 + 时支数) % 6   余 0 作 6

    年支数：子 1、丑 2 …… 亥 12；时支数同。
    卦序：乾 1、兑 2、离 3、震 4、巽 5、坎 6、艮 7、坤 8。

体用：动爻所在之卦为「用」（所问之事），另一卦为「体」（自己）。
    用生体大吉，体克用吉，体用比和顺，体生用泄（耗），用克体凶。
"""

from __future__ import annotations

# (卦名, 符号, 三爻(上中下), 天象, 卦德, 五行)
TRIGRAMS = [
    ("乾", "☰", (1, 1, 1), "天", "健", "金"),
    ("兑", "☱", (1, 1, 0), "泽", "悦", "金"),
    ("离", "☲", (1, 0, 1), "火", "丽", "火"),
    ("震", "☳", (1, 0, 0), "雷", "动", "木"),
    ("巽", "☴", (0, 1, 1), "风", "入", "木"),
    ("坎", "☵", (0, 1, 0), "水", "陷", "水"),
    ("艮", "☶", (0, 0, 1), "山", "止", "土"),
    ("坤", "☷", (0, 0, 0), "地", "顺", "土"),
]

TRI_BY_NAME = {t[0]: t for t in TRIGRAMS}
TRI_SEQ = {t[0]: i + 1 for i, t in enumerate(TRIGRAMS)}   # 乾1 … 坤8

# (上卦, 下卦) -> (卦名, 卦辞要旨, 断语倾向 good/mid/bad)
GUA: dict[tuple[str, str], tuple[str, str, str, str]] = {
    ("乾", "乾"): ("乾为天", "刚健中正，自强不息。宜开创、宜进取，但亢龙有悔，忌过刚。", "good", "Creative force at full strength. Advance, but do not overreach."),
    ("坤", "坤"): ("坤为地", "柔顺承载，厚德载物。宜守成、宜配合，不宜争先。", "good", "Receptive and steady. Support rather than lead."),
    ("坎", "震"): ("水雷屯", "初生之难，万事起头难。宜积蓄待时，不宜躁进。", "bad", "Difficulty at the beginning. Accumulate, do not rush."),
    ("艮", "坎"): ("山水蒙", "蒙昧未开，宜求教于人。己见未明时勿下决断。", "mid", "Obscured. Seek instruction before deciding."),
    ("坎", "乾"): ("水天需", "需者待也，时机未至。宜养精蓄锐，等待可动之时。", "mid", "Waiting. Gather strength; the moment has not come."),
    ("乾", "坎"): ("天水讼", "争讼之象，各执一端。宜和解退让，忌诉讼硬碰。", "bad", "Conflict. Settle rather than litigate."),
    ("坤", "坎"): ("地水师", "师者众也，用众之道。宜有纪律、有主帅，忌乌合。", "mid", "Mobilising the many. Needs discipline and a clear leader."),
    ("坎", "坤"): ("水地比", "亲比辅佐，众心归附。宜合作、宜结盟。", "good", "Union and support. Alliance favours you."),
    ("巽", "乾"): ("风天小畜", "小有积蓄，力尚未足。宜小步推进，忌大动。", "mid", "Small accumulation. Advance in inches."),
    ("乾", "兑"): ("天泽履", "履虎尾而不咬，谨慎则安。宜守礼、宜小心行事。", "mid", "Treading on the tiger's tail — care keeps you safe."),
    ("坤", "乾"): ("地天泰", "天地交泰，上下相通。大吉之象，宜积极作为。", "good", "Great harmony. Act boldly."),
    ("乾", "坤"): ("天地否", "天地不交，闭塞不通。宜守、宜退，忌强行突破。", "bad", "Blocked. Hold and wait out the closure."),
    ("乾", "离"): ("天火同人", "与人同心，志同道合。宜合作、宜公开，忌私。", "good", "Fellowship. Work openly with allies."),
    ("离", "乾"): ("火天大有", "所有者大，富有光明。宜守成、宜分享，忌骄。", "good", "Great possession, well lit. Share, do not boast."),
    ("坤", "艮"): ("地山谦", "谦者有终，卑以自牧。大吉，宜低调、宜让。", "good", "Modesty succeeds. Keep a low profile."),
    ("震", "坤"): ("雷地豫", "豫者乐也，顺势而动。宜筹备、宜顺势，忌耽于安乐。", "good", "Enthusiasm — good for preparation, bad for complacency."),
    ("兑", "震"): ("泽雷随", "随顺时势，择善而从。宜跟随趋势，忌盲从。", "mid", "Following. Follow the trend, not the crowd."),
    ("艮", "巽"): ("山风蛊", "蛊者坏也，积弊待治。宜整顿旧事、宜修补。", "bad", "Decay to be repaired. Fix what has rotted."),
    ("坤", "兑"): ("地泽临", "临者大也，阳气渐长。宜趁势而下，忌迟缓。", "good", "Approach — good momentum. Move while it lasts."),
    ("巽", "坤"): ("风地观", "观者视也，静观其变。宜观察、宜学习，忌妄动。", "mid", "Contemplation. Observe before acting."),
    ("离", "震"): ("火雷噬嗑", "啮合之象，须去梗乃通。宜清障、宜执法。", "mid", "Biting through an obstruction. Clear it first."),
    ("艮", "离"): ("山火贲", "贲者饰也，文饰之美。宜修饰、宜包装，忌徒有其表。", "mid", "Adornment. Polish, but do not mistake form for substance."),
    ("艮", "坤"): ("山地剥", "剥落之象，阴盛阳衰。宜守、宜止，忌有所往。", "bad", "Stripping away. Stop and protect what remains."),
    ("坤", "震"): ("地雷复", "一阳来复，转机初现。宜复旧、宜重新开始。", "good", "Return of the light. A turning point, small but real."),
    ("乾", "震"): ("天雷无妄", "无妄之灾，不期而至。宜守正，忌侥幸妄动。", "mid", "Unexpected events. Stay correct; do not gamble."),
    ("艮", "乾"): ("山天大畜", "大有蓄积，止而不进。宜积蓄、宜养贤。", "good", "Great accumulation held in reserve. Save and prepare."),
    ("艮", "震"): ("山雷颐", "颐者养也，观其所养。宜养身、宜养德，忌纵口。", "mid", "Nourishment. Watch what you feed yourself."),
    ("兑", "巽"): ("泽风大过", "栋梁将折，负荷过重。宜减负、忌强撑。", "bad", "Overloaded. Reduce the load before the beam breaks."),
    ("坎", "坎"): ("坎为水", "重险叠陷，习坎而行。宜守、宜诚信，忌冒进。", "bad", "Double danger. Keep to what is solid."),
    ("离", "离"): ("离为火", "火附于物，明而有依。宜依附正道、宜求明师。", "good", "Fire clings to what it burns. Attach to the right thing."),
    ("兑", "艮"): ("泽山咸", "感应相通，两情相悦。宜婚恋、宜感通。", "good", "Mutual attraction. Favourable for union."),
    ("震", "巽"): ("雷风恒", "恒久之道，守常不变。宜持久、忌见异思迁。", "good", "Constancy. Persist; do not chase novelty."),
    ("乾", "艮"): ("天山遁", "遁者退也，以退为进。宜避、宜隐，忌强争。", "mid", "Retreat is the strategy. Withdraw, do not fight."),
    ("震", "乾"): ("雷天大壮", "壮盛之时，忌恃力妄为。宜正、宜节制。", "mid", "Great vigour — dangerous if used without restraint."),
    ("离", "坤"): ("火地晋", "日出地上，晋而进也。吉，宜进取、宜显名。", "good", "Advance like the rising sun. Go visible."),
    ("坤", "离"): ("地火明夷", "明入地中，晦其明也。宜韬光养晦、忌显才。", "bad", "Light hidden underground. Conceal your brilliance."),
    ("巽", "离"): ("风火家人", "家道之象，内正外顺。宜治内、宜立规。", "good", "The household. Put your own house in order."),
    ("离", "兑"): ("火泽睽", "睽者乖也，同中有异。宜求同存异，忌强合。", "mid", "Divergence. Agree to differ."),
    ("坎", "艮"): ("水山蹇", "蹇者难也，前有险阻。宜止、宜求助，忌冒进。", "bad", "Obstruction ahead. Stop and seek help."),
    ("震", "坎"): ("雷水解", "解者散也，险难将解。宜速决、宜赦过。", "good", "Release. The knot loosens — act quickly."),
    ("艮", "兑"): ("山泽损", "损下益上，先损后益。宜舍小取大，忌吝。", "mid", "Decrease now, gain later. Spend to invest."),
    ("巽", "震"): ("风雷益", "损上益下，其益无方。大吉，宜进取、宜施予。", "good", "Increase. Give first, gain more."),
    ("兑", "乾"): ("泽天夬", "决而必行，去恶务尽。宜决断，忌拖延。", "mid", "Decisive breakthrough. Cut cleanly."),
    ("乾", "巽"): ("天风姤", "不期而遇，阴气初生。宜察微，忌轻信新遇。", "mid", "Unexpected encounter. Watch the first small sign."),
    ("兑", "坤"): ("泽地萃", "萃者聚也，人气汇聚。宜聚众、宜祭祀。", "good", "Gathering. People and resources come together."),
    ("坤", "巽"): ("地风升", "升者上也，积小成大。吉，宜渐进、宜求见。", "good", "Ascending gradually. Seek audience."),
    ("兑", "坎"): ("泽水困", "困者穷也，处困守正。宜守、宜待，忌怨。", "bad", "Exhaustion. Hold to principle; do not resent."),
    ("坎", "巽"): ("水风井", "井养不穷，利在养人。宜守本、宜修井。", "mid", "The well. Maintain your source."),
    ("兑", "离"): ("泽火革", "革者变也，顺天应人。宜变革，须待时机与信任。", "mid", "Transformation. Change only with timing and trust."),
    ("离", "巽"): ("火风鼎", "鼎者定也，烹养贤能。吉，宜立新、宜用人。", "good", "The cauldron. Establish the new; employ the able."),
    ("震", "震"): ("震为雷", "震动惊惧，恐惧修省。宜戒惧、宜自省。", "mid", "Thunder. Fear is useful if it makes you careful."),
    ("艮", "艮"): ("艮为山", "艮者止也，时止则止。宜静、宜守，忌妄动。", "mid", "Stillness. Stop where stopping is right."),
    ("巽", "艮"): ("风山渐", "渐者进也，循序渐进。吉，宜缓进、忌速成。", "good", "Gradual progress. Slow and steady wins."),
    ("震", "兑"): ("雷泽归妹", "归妹之象，名分未正。宜慎婚、忌苟合。", "bad", "A union without proper standing. Be careful with commitments."),
    ("震", "离"): ("雷火丰", "丰者大也，日中则昃。宜盛时思衰，忌骄盈。", "good", "Abundance at noon — enjoy it, but noon passes."),
    ("离", "艮"): ("火山旅", "旅者行也，萍踪无定。宜小成、忌大谋。", "mid", "The traveller. Small gains; no grand plans."),
    ("巽", "巽"): ("巽为风", "柔顺入微，随风而行。宜顺、宜渗透，忌优柔。", "mid", "Gentle penetration. Influence quietly."),
    ("兑", "兑"): ("兑为泽", "悦而相说，朋友讲习。宜交流、忌口舌轻薄。", "good", "Joy and exchange. Good for discussion, bad for gossip."),
    ("巽", "坎"): ("风水涣", "涣者散也，离披解散。宜散小难、宜聚合人心。", "mid", "Dispersion. Break the small blockage, reunite the people."),
    ("坎", "兑"): ("水泽节", "节者止也，有节则安。宜节制、宜立度。", "mid", "Limits. Set boundaries and keep them."),
    ("巽", "兑"): ("风泽中孚", "中孚之信，诚感豚鱼。吉，宜以诚待人。", "good", "Inner truth. Sincerity carries the day."),
    ("震", "艮"): ("雷山小过", "小过之象，宜下不宜上。宜小事、忌大动作。", "mid", "Small excess. Do small things; avoid grand moves."),
    ("坎", "离"): ("水火既济", "既济已成，守成惟艰。宜守、忌松懈。", "good", "Already complete — now the hard part is keeping it."),
    ("离", "坎"): ("火水未济", "未济未成，事在将来。宜谨慎推进，忌半途。", "mid", "Not yet complete. Proceed carefully to the end."),
}

GUA_EN = {
    "乾为天": "The Creative", "坤为地": "The Receptive", "水雷屯": "Difficulty at the Beginning",
    "山水蒙": "Youthful Folly", "水天需": "Waiting", "天水讼": "Conflict",
    "地水师": "The Army", "水地比": "Holding Together", "风天小畜": "Small Taming",
    "天泽履": "Treading", "地天泰": "Peace", "天地否": "Standstill",
    "天火同人": "Fellowship", "火天大有": "Great Possession", "地山谦": "Modesty",
    "雷地豫": "Enthusiasm", "泽雷随": "Following", "山风蛊": "Repairing Decay",
    "地泽临": "Approach", "风地观": "Contemplation", "火雷噬嗑": "Biting Through",
    "山火贲": "Adornment", "山地剥": "Splitting Apart", "地雷复": "Return",
    "天雷无妄": "Innocence", "山天大畜": "Great Accumulation", "山雷颐": "Nourishment",
    "泽风大过": "Great Excess", "坎为水": "The Abyss", "离为火": "The Clinging",
    "泽山咸": "Attraction", "雷风恒": "Duration", "天山遁": "Retreat",
    "雷天大壮": "Great Vigour", "火地晋": "Progress", "地火明夷": "Darkening of the Light",
    "风火家人": "The Family", "火泽睽": "Divergence", "水山蹇": "Obstruction",
    "雷水解": "Release", "山泽损": "Decrease", "风雷益": "Increase",
    "泽天夬": "Breakthrough", "天风姤": "Coming to Meet", "泽地萃": "Gathering",
    "地风升": "Ascending", "泽水困": "Exhaustion", "水风井": "The Well",
    "泽火革": "Revolution", "火风鼎": "The Cauldron", "震为雷": "The Arousing",
    "艮为山": "Keeping Still", "风山渐": "Gradual Progress", "雷泽归妹": "The Marrying Maiden",
    "雷火丰": "Abundance", "火山旅": "The Wanderer", "巽为风": "The Gentle",
    "兑为泽": "The Joyous", "风水涣": "Dispersion", "水泽节": "Limitation",
    "风泽中孚": "Inner Truth", "雷山小过": "Small Excess", "水火既济": "After Completion",
    "火水未济": "Before Completion",
}

# 体用生克（用 versus 体）
WX_SHENG = {"木": "火", "火": "土", "土": "金", "金": "水", "水": "木"}
WX_KE = {"木": "土", "土": "水", "水": "火", "火": "金", "金": "木"}


def _tri_from_number(n: int) -> str:
    return TRIGRAMS[(n - 1) % 8][0]


def cast(year_branch_num: int, lunar_month: int, lunar_day: int,
         hour_branch_num: int) -> dict:
    """梅花易数时间起卦。参数均为「数」，不是文字。"""
    s = year_branch_num + lunar_month + lunar_day
    up_n = s % 8 or 8
    lo_n = (s + hour_branch_num) % 8 or 8
    move = (s + hour_branch_num) % 6 or 6

    up, lo = _tri_from_number(up_n), _tri_from_number(lo_n)
    name, text, tone, text_en = GUA[(up, lo)]

    # 本卦六爻：初爻在下，从上往下排时上卦在前
    up_line = TRI_BY_NAME[up][2]          # (上,中,下)
    lo_line = TRI_BY_NAME[lo][2]
    lines = list(reversed(up_line)) + list(reversed(lo_line))  # 初→上
    flipped = lines[:]
    flipped[move - 1] ^= 1

    # 互卦：2,3,4 爻为下卦，3,4,5 爻为上卦（TRIGRAMS 的三爻序为 上、中、下）
    hu_lo = (flipped[3], flipped[2], flipped[1])
    hu_up = (flipped[4], flipped[3], flipped[2])
    hu_lo_name = next(t[0] for t in TRIGRAMS if t[2] == hu_lo)
    hu_up_name = next(t[0] for t in TRIGRAMS if t[2] == hu_up)
    hu = GUA.get((hu_up_name, hu_lo_name))

    # 变卦
    bian_up = "".join(str(x) for x in reversed(flipped[3:]))
    bian_lo = "".join(str(x) for x in reversed(flipped[0:3]))
    b_up = next(t[0] for t in TRIGRAMS if "".join(map(str, t[2])) == bian_up)
    b_lo = next(t[0] for t in TRIGRAMS if "".join(map(str, t[2])) == bian_lo)
    bian = GUA.get((b_up, b_lo))

    # 体用
    if move <= 3:
        ti, yong = up, lo          # 动爻在下卦 → 下为用、上为体
    else:
        ti, yong = lo, up
    ti_wx, yong_wx = TRI_BY_NAME[ti][5], TRI_BY_NAME[yong][5]
    if ti_wx == yong_wx:
        rel, rel_zh, rel_en, rel_tone = "比和", "体用比和，事情顺遂、彼此相当", "Self and matter are equal — smooth, neither side dominates", "good"
    elif WX_SHENG[yong_wx] == ti_wx:
        rel, rel_zh, rel_en, rel_tone = "用生体", "用生体，外来之力助我，大吉", "The matter generates you — outside help arrives", "good"
    elif WX_SHENG[ti_wx] == yong_wx:
        rel, rel_zh, rel_en, rel_tone = "体生用", "体生用，我方付出多、耗气，事成而我损", "You generate the matter — it succeeds at your expense", "mid"
    elif WX_KE[ti_wx] == yong_wx:
        rel, rel_zh, rel_en, rel_tone = "体克用", "体克用，我能制事，可为但需用力", "You control the matter — doable, with effort", "good"
    else:
        rel, rel_zh, rel_en, rel_tone = "用克体", "用克体，事来克我，阻力大，宜退", "The matter controls you — strong resistance, better to withdraw", "bad"

    return {
        "upper": up, "lower": lo, "name": name, "nameEn": GUA_EN.get(name, name),
        "text": text, "textEn": text_en, "tone": tone,
        "trace": f"{TRI_BY_NAME[up][1]}{TRI_BY_NAME[lo][1]}",
        "lines": lines, "moving": move, "flipped": flipped,
        "mutual": hu[0] if hu else "", "mutualEn": GUA_EN.get(hu[0], "") if hu else "",
        "mutualText": hu[1] if hu else "",
        "result": bian[0] if bian else "", "resultEn": GUA_EN.get(bian[0], "") if bian else "",
        "resultText": bian[1] if bian else "",
        "resultTone": bian[2] if bian else "mid",
        "ti": ti, "yong": yong, "tiWx": ti_wx, "yongWx": yong_wx,
        "rel": rel, "relZh": rel_zh, "relEn": rel_en, "relTone": rel_tone,
        "numbers": {"upper": up_n, "lower": lo_n, "moving": move,
                    "sum": s, "sumHour": s + hour_branch_num},
    }


def by_datetime(year_branch_num: int, lunar_month: int, lunar_day: int,
                hour_branch_num: int) -> dict:
    """别名，语义更清楚。"""
    return cast(year_branch_num, lunar_month, lunar_day, hour_branch_num)


TONE_ZH = {"good": "吉", "mid": "平", "bad": "凶"}
TONE_EN = {"good": "favourable", "mid": "mixed", "bad": "unfavourable"}
