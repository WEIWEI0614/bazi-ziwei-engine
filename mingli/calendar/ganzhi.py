"""Stems, branches and the classical lookup tables."""

from __future__ import annotations

GAN = "甲乙丙丁戊己庚辛壬癸"
ZHI = "子丑寅卯辰巳午未申酉戌亥"
ZHI_EN = ["Zi", "Chou", "Yin", "Mao", "Chen", "Si",
          "Wu", "Wei", "Shen", "You", "Xu", "Hai"]
GAN_EN = ["Jia", "Yi", "Bing", "Ding", "Wu", "Ji",
          "Geng", "Xin", "Ren", "Gui"]

# Five elements of each stem / branch
GAN_WUXING = ["木", "木", "火", "火", "土", "土", "金", "金", "水", "水"]
ZHI_WUXING = ["水", "土", "木", "木", "土", "火", "火", "土", "金", "金", "土", "水"]

GAN_YINYANG = ["阳", "阴"] * 5
ZHI_YINYANG = ["阳", "阴"] * 6

WUXING_EN = {"木": "Wood", "火": "Fire", "土": "Earth", "金": "Metal", "水": "Water"}

SHENG = {"木": "火", "火": "土", "土": "金", "金": "水", "水": "木"}
KE = {"木": "土", "土": "水", "水": "火", "火": "金", "金": "木"}

# 地支藏干: (本气, 中气, 余气)
HIDDEN = {
    "子": ("癸",),
    "丑": ("己", "癸", "辛"),
    "寅": ("甲", "丙", "戊"),
    "卯": ("乙",),
    "辰": ("戊", "乙", "癸"),
    "巳": ("丙", "戊", "庚"),
    "午": ("丁", "己"),
    "未": ("己", "丁", "乙"),
    "申": ("庚", "壬", "戊"),
    "酉": ("辛",),
    "戌": ("戊", "辛", "丁"),
    "亥": ("壬", "甲"),
}
# weight of each hidden stem (本气/中气/余气)
HIDDEN_WEIGHT = (0.6, 0.28, 0.12)
_HW = {"子": (1.0,), "卯": (1.0,), "酉": (1.0,),
       "午": (0.7, 0.3), "亥": (0.7, 0.3)}
for _z in ("丑", "寅", "辰", "巳", "未", "申", "戌"):
    _HW[_z] = HIDDEN_WEIGHT

# 六十甲子納音
NAYIN = [
    "海中金", "炉中火", "大林木", "路旁土", "剑锋金", "山头火",
    "涧下水", "城头土", "白蜡金", "杨柳木", "泉中水", "屋上土",
    "霹雳火", "松柏木", "长流水", "沙中金", "山下火", "平地木",
    "壁上土", "金箔金", "覆灯火", "天河水", "大驿土", "钗钏金",
    "桑柘木", "大溪水", "沙中土", "天上火", "石榴木", "大海水",
]
NAYIN_EN = [
    "Gold in the Sea", "Fire in the Furnace", "Great Forest Wood",
    "Roadside Earth", "Sword-Edge Metal", "Mountain-Top Fire",
    "Stream Water", "City-Wall Earth", "White Wax Metal",
    "Willow Wood", "Spring Water", "Roof-Top Earth",
    "Thunderbolt Fire", "Pine and Cypress Wood", "Long Flowing Water",
    "Gold in Sand", "Fire at the Foot of the Hill", "Flatland Wood",
    "Earth on the Wall", "Gold Leaf Metal", "Lamp-Wick Fire",
    "Water of the Heavenly River", "Earth of the Post Road",
    "Hairpin Metal", "Mulberry Wood", "Great Stream Water",
    "Earth in the Sand", "Fire in the Sky", "Pomegranate Wood",
    "Water of the Great Sea",
]

# 十二長生
CHANGSHENG = ["长生", "沐浴", "冠带", "临官", "帝旺", "衰",
              "病", "死", "墓", "绝", "胎", "养"]
CHANGSHENG_EN = ["Birth", "Bath", "Cap", "Office", "Peak", "Decline",
                 "Illness", "Death", "Tomb", "Extinction", "Conception", "Nurture"]

# 十神
SHISHEN = ["比肩", "劫财", "食神", "伤官", "偏财", "正财",
           "七杀", "正官", "偏印", "正印"]
SHISHEN_EN = {
    "比肩": "Parallel (Bi Jian)", "劫财": "Rob Wealth (Jie Cai)",
    "食神": "Eating God (Shi Shen)", "伤官": "Hurting Officer (Shang Guan)",
    "偏财": "Indirect Wealth (Pian Cai)", "正财": "Direct Wealth (Zheng Cai)",
    "七杀": "Seven Killings (Qi Sha)", "正官": "Direct Officer (Zheng Guan)",
    "偏印": "Indirect Resource (Pian Yin)", "正印": "Direct Resource (Zheng Yin)",
}

# 空亡 (旬空) per 旬
XUNKONG = {
    0: ("戌", "亥"), 10: ("申", "酉"), 20: ("午", "未"),
    30: ("辰", "巳"), 40: ("寅", "卯"), 50: ("子", "丑"),
}

# 神煞 tables ------------------------------------------------------------
# 天乙貴人 by day stem
TIANYI = {
    "甲": ("丑", "未"), "戊": ("丑", "未"), "乙": ("子", "申"), "己": ("子", "申"),
    "丙": ("亥", "酉"), "丁": ("亥", "酉"), "壬": ("卯", "巳"), "癸": ("卯", "巳"),
    "庚": ("寅", "午"), "辛": ("寅", "午"),
}
# 文昌 by day stem
WENCHANG = {"甲": "巳", "乙": "午", "丙": "申", "丁": "酉", "戊": "申",
            "己": "酉", "庚": "亥", "辛": "子", "壬": "寅", "癸": "卯"}
# 驛馬 by year/day branch group
YIMA = {"申": "寅", "子": "寅", "辰": "寅", "寅": "申", "午": "申", "戌": "申",
        "巳": "亥", "酉": "亥", "丑": "亥", "亥": "巳", "卯": "巳", "未": "巳"}
# 桃花 (咸池)
TAOHUA = {"申": "酉", "子": "酉", "辰": "酉", "寅": "卯", "午": "卯", "戌": "卯",
          "巳": "午", "酉": "午", "丑": "午", "亥": "子", "卯": "子", "未": "子"}
# 華蓋
HUAGAI = {"申": "辰", "子": "辰", "辰": "辰", "寅": "戌", "午": "戌", "戌": "戌",
          "巳": "丑", "酉": "丑", "丑": "丑", "亥": "未", "卯": "未", "未": "未"}
# 將星
JIANGXING = {"申": "子", "子": "子", "辰": "子", "寅": "午", "午": "午", "戌": "午",
             "巳": "酉", "酉": "酉", "丑": "酉", "亥": "卯", "卯": "卯", "未": "卯"}
# 羊刃 by day stem
YANGREN = {"甲": "卯", "乙": "辰", "丙": "午", "丁": "未", "戊": "午",
           "己": "未", "庚": "酉", "辛": "戌", "壬": "子", "癸": "丑"}
# 禄 by day stem
LU = {"甲": "寅", "乙": "卯", "丙": "巳", "丁": "午", "戊": "巳",
      "己": "午", "庚": "申", "辛": "酉", "壬": "亥", "癸": "子"}

# 刑冲合害
CHONG = {"子": "午", "午": "子", "丑": "未", "未": "丑", "寅": "申", "申": "寅",
         "卯": "酉", "酉": "卯", "辰": "戌", "戌": "辰", "巳": "亥", "亥": "巳"}
HE6 = {"子": "丑", "丑": "子", "寅": "亥", "亥": "寅", "卯": "戌", "戌": "卯",
       "辰": "酉", "酉": "辰", "巳": "申", "申": "巳", "午": "未", "未": "午"}
HAI6 = {"子": "未", "未": "子", "丑": "午", "午": "丑", "寅": "巳", "巳": "寅",
        "卯": "辰", "辰": "卯", "申": "亥", "亥": "申", "酉": "戌", "戌": "酉"}
PO = {"子": "酉", "酉": "子", "卯": "午", "午": "卯", "辰": "丑", "丑": "辰",
      "未": "戌", "戌": "未", "寅": "亥", "亥": "寅", "巳": "申", "申": "巳"}
# 六合化气：合而能化时两支所化之五行（须月令支持且化神透干才成立）
HE6_ELEMENT = {"子丑": "土", "寅亥": "木", "卯戌": "火",
               "辰酉": "金", "巳申": "水", "午未": "土"}
# 四墓库：辰戌丑未各为某一五行之墓
TOMB = {"辰": "水", "戌": "火", "丑": "金", "未": "木"}
# 三刑：两组三刑 + 子卯相刑 + 辰午酉亥自刑
SEASON_STATE = {
    # month branch -> state of each element: 旺 相 休 囚 死
    "寅": {"木": "旺", "火": "相", "水": "休", "金": "囚", "土": "死"},
    "卯": {"木": "旺", "火": "相", "水": "休", "金": "囚", "土": "死"},
    "辰": {"土": "旺", "金": "相", "火": "休", "木": "囚", "水": "死"},
    "巳": {"火": "旺", "土": "相", "木": "休", "水": "囚", "金": "死"},
    "午": {"火": "旺", "土": "相", "木": "休", "水": "囚", "金": "死"},
    "未": {"土": "旺", "金": "相", "火": "休", "木": "囚", "水": "死"},
    "申": {"金": "旺", "水": "相", "土": "休", "火": "囚", "木": "死"},
    "酉": {"金": "旺", "水": "相", "土": "休", "火": "囚", "木": "死"},
    "戌": {"土": "旺", "金": "相", "火": "休", "木": "囚", "水": "死"},
    "亥": {"水": "旺", "木": "相", "金": "休", "土": "囚", "火": "死"},
    "子": {"水": "旺", "木": "相", "金": "休", "土": "囚", "火": "死"},
    "丑": {"土": "旺", "金": "相", "火": "休", "木": "囚", "水": "死"},
}
STATE_MULT = {"旺": 1.45, "相": 1.20, "休": 0.85, "囚": 0.70, "死": 0.55}

XING_FULL = [("寅", "巳", "申"), ("丑", "戌", "未")]
XING_PAIR = [("子", "卯")]
SELF_XING = ("辰", "午", "酉", "亥")
# 三合局
SANHE = [("申", "子", "辰", "水"), ("亥", "卯", "未", "木"),
         ("寅", "午", "戌", "火"), ("巳", "酉", "丑", "金")]
# 三會方
SANHUI = [("寅", "卯", "辰", "木"), ("巳", "午", "未", "火"),
          ("申", "酉", "戌", "金"), ("亥", "子", "丑", "水")]
# 天干五合
GAN_HE = {"甲": ("己", "土"), "己": ("甲", "土"), "乙": ("庚", "金"),
          "庚": ("乙", "金"), "丙": ("辛", "水"), "辛": ("丙", "水"),
          "丁": ("壬", "木"), "壬": ("丁", "木"), "戊": ("癸", "火"),
          "癸": ("戊", "火")}
GAN_CHONG = {"甲": "庚", "庚": "甲", "乙": "辛", "辛": "乙",
             "丙": "壬", "壬": "丙", "丁": "癸", "癸": "丁"}


def ganzhi_index(gan: str, zhi: str) -> int:
    """0..59 index of a stem-branch pair (assumes a valid pair)."""
    g = GAN.index(gan)
    z = ZHI.index(zhi)
    for i in range(60):
        if i % 10 == g and i % 12 == z:
            return i
    raise ValueError(f"invalid ganzhi {gan}{zhi}")


def nayin(gan: str, zhi: str) -> tuple[str, str]:
    i = ganzhi_index(gan, zhi)
    return NAYIN[i // 2], NAYIN_EN[i // 2]


def xunkong(gan: str, zhi: str) -> tuple[str, str]:
    i = ganzhi_index(gan, zhi)
    return XUNKONG[(i // 10) * 10]


def shishen(day_gan: str, other: str) -> str:
    """Ten-god relation of `other` stem to the day master."""
    di = GAN.index(day_gan)
    oi = GAN.index(other)
    dw = GAN_WUXING[di]
    ow = GAN_WUXING[oi]
    same = (di % 2) == (oi % 2)
    if dw == ow:
        return "比肩" if same else "劫财"
    if SHENG[dw] == ow:
        return "食神" if same else "伤官"
    if KE[dw] == ow:
        return "偏财" if same else "正财"
    if KE[ow] == dw:
        return "七杀" if same else "正官"
    if SHENG[ow] == dw:
        return "偏印" if same else "正印"
    raise AssertionError


def wuxing_relation(me: str, other: str) -> str:
    """How `other` relates to `me`: 同/生我/我生/克我/我克."""
    if me == other:
        return "同"
    if SHENG[other] == me:
        return "生我"
    if SHENG[me] == other:
        return "我生"
    if KE[other] == me:
        return "克我"
    return "我克"


def changsheng(stem: str, branch: str) -> str:
    """Twelve stages of a stem in a branch (yang forward, yin backward)."""
    cs_start = {"甲": "亥", "乙": "午", "丙": "寅", "丁": "酉", "戊": "寅",
                "己": "酉", "庚": "巳", "辛": "子", "壬": "申", "癸": "卯"}
    start = ZHI.index(cs_start[stem])
    step = 1 if GAN.index(stem) % 2 == 0 else -1
    pos = ZHI.index(branch)
    return CHANGSHENG[(pos - start) * step % 12]
