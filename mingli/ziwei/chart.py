"""Zi Wei Dou Shu (紫微斗數) chart construction.

Star placement follows the 三合派 tables used by `iztro` (the most widely used
open-source implementation) and has been verified star-by-star against it —
see tests/test_core.py and the validation table in the README.

Includes: 12 palaces, five-element bureau, 14 majors with brightness, 6 lucky /
6 unlucky auxiliaries, 38 adjective stars (杂曜), the four sets of twelve gods
(长生 / 博士 / 将前 / 岁前), decade limits, minor limits (小限), life and body
rulers, and birth-year / decade / annual / self transformation (四化).
"""

from __future__ import annotations

import datetime as _dt
from dataclasses import dataclass, field

from ..calendar import astro, lunar
from ..calendar.ganzhi import GAN, ZHI, nayin

PALACE_NAMES = ["命宫", "兄弟", "夫妻", "子女", "财帛", "疾厄",
                "迁移", "仆役", "官禄", "田宅", "福德", "父母"]
PALACE_EN = ["Life", "Siblings", "Spouse", "Children", "Wealth", "Health",
             "Travel", "Friends", "Career", "Property", "Fortune", "Parents"]

MAJOR_STARS = ["紫微", "天机", "太阳", "武曲", "天同", "廉贞",
               "天府", "太阴", "贪狼", "巨门", "天相", "天梁", "七杀", "破军"]

STAR_EN = {
    "紫微": "Zi Wei", "天机": "Tian Ji", "太阳": "Tai Yang", "武曲": "Wu Qu",
    "天同": "Tian Tong", "廉贞": "Lian Zhen", "天府": "Tian Fu", "太阴": "Tai Yin",
    "贪狼": "Tan Lang", "巨门": "Ju Men", "天相": "Tian Xiang", "天梁": "Tian Liang",
    "七杀": "Qi Sha", "破军": "Po Jun",
    "左辅": "Zuo Fu", "右弼": "You Bi", "文昌": "Wen Chang", "文曲": "Wen Qu",
    "天魁": "Tian Kui", "天钺": "Tian Yue", "禄存": "Lu Cun", "天马": "Tian Ma",
    "擎羊": "Qing Yang", "陀罗": "Tuo Luo", "火星": "Huo Xing",
    "铃星": "Ling Xing", "地空": "Di Kong", "地劫": "Di Jie",
    "天刑": "Tian Xing", "天姚": "Tian Yao", "解神": "Jie Shen",
    "红鸾": "Hong Luan", "天喜": "Tian Xi", "咸池": "Xian Chi",
    "龙池": "Long Chi", "凤阁": "Feng Ge", "三台": "San Tai", "八座": "Ba Zuo",
    "恩光": "En Guang", "天贵": "Tian Gui", "台辅": "Tai Fu", "封诰": "Feng Gao",
    "天官": "Tian Guan", "天福": "Tian Fu (adj)", "天厨": "Tian Chu",
    "天才": "Tian Cai", "天寿": "Tian Shou", "天哭": "Tian Ku",
    "天虚": "Tian Xu", "孤辰": "Gu Chen", "寡宿": "Gua Su",
    "蜚廉": "Fei Lian", "破碎": "Po Sui", "华盖": "Hua Gai",
    "天巫": "Tian Wu", "天月": "Tian Yue (adj)", "阴煞": "Yin Sha",
    "天德": "Tian De", "月德": "Yue De", "天空": "Tian Kong",
    "旬空": "Xun Kong", "截路": "Jie Lu", "空亡": "Kong Wang",
    "天伤": "Tian Shang", "天使": "Tian Shi", "年解": "Nian Jie",
}

LUCKY = {"左辅", "右弼", "文昌", "文曲", "天魁", "天钺", "禄存", "天马"}
UNLUCKY = {"擎羊", "陀罗", "火星", "铃星", "地空", "地劫"}

# 生年四化 — 三合派 / 中州派 通行表
SIHUA_SANHE = {
    "甲": ("廉贞", "破军", "武曲", "太阳"),
    "乙": ("天机", "天梁", "紫微", "太阴"),
    "丙": ("天同", "天机", "文昌", "廉贞"),
    "丁": ("太阴", "天同", "天机", "巨门"),
    "戊": ("贪狼", "太阴", "右弼", "天机"),
    "己": ("武曲", "贪狼", "天梁", "文曲"),
    "庚": ("太阳", "武曲", "太阴", "天同"),
    "辛": ("巨门", "太阳", "文曲", "文昌"),
    "壬": ("天梁", "紫微", "左辅", "武曲"),
    "癸": ("破军", "巨门", "太阴", "贪狼"),
}
# 飛星派（梁若瑜 / 钦天四化）对庚、壬两干的不同取法
SIHUA_FEIXING = dict(SIHUA_SANHE)
SIHUA_FEIXING["庚"] = ("太阳", "武曲", "天府", "天同")
SIHUA_FEIXING["壬"] = ("天梁", "紫微", "天府", "武曲")

HUA_NAMES = ("禄", "权", "科", "忌")

JU = {"水": (2, "水二局"), "木": (3, "木三局"), "金": (4, "金四局"),
      "土": (5, "土五局"), "火": (6, "火六局")}

KUI_YUE = {"甲": ("丑", "未"), "戊": ("丑", "未"), "庚": ("丑", "未"),
           "乙": ("子", "申"), "己": ("子", "申"),
           "丙": ("亥", "酉"), "丁": ("亥", "酉"),
           "辛": ("午", "寅"),
           "壬": ("卯", "巳"), "癸": ("卯", "巳")}
LUCUN = {"甲": "寅", "乙": "卯", "丙": "巳", "丁": "午", "戊": "巳",
         "己": "午", "庚": "申", "辛": "酉", "壬": "亥", "癸": "子"}
HUOXING_START = {"寅": "丑", "午": "丑", "戌": "丑",
                 "申": "寅", "子": "寅", "辰": "寅",
                 "巳": "卯", "酉": "卯", "丑": "卯",
                 "亥": "酉", "卯": "酉", "未": "酉"}
LINGXING_START = {"寅": "卯", "午": "卯", "戌": "卯",
                  "申": "戌", "子": "戌", "辰": "戌",
                  "巳": "戌", "酉": "戌", "丑": "戌",
                  "亥": "戌", "卯": "戌", "未": "戌"}

BRIGHTNESS = {
    "紫微": {"子": "平", "丑": "庙", "寅": "庙", "卯": "旺", "辰": "得", "巳": "旺",
             "午": "庙", "未": "庙", "申": "旺", "酉": "平", "戌": "得", "亥": "旺"},
    "天机": {"子": "庙", "丑": "陷", "寅": "得", "卯": "旺", "辰": "利", "巳": "平",
             "午": "庙", "未": "陷", "申": "得", "酉": "旺", "戌": "利", "亥": "平"},
    "太阳": {"子": "陷", "丑": "陷", "寅": "旺", "卯": "庙", "辰": "旺", "巳": "庙",
             "午": "庙", "未": "得", "申": "得", "酉": "平", "戌": "陷", "亥": "陷"},
    "武曲": {"子": "旺", "丑": "庙", "寅": "得", "卯": "利", "辰": "庙", "巳": "平",
             "午": "旺", "未": "庙", "申": "得", "酉": "利", "戌": "庙", "亥": "平"},
    "天同": {"子": "旺", "丑": "陷", "寅": "利", "卯": "庙", "辰": "平", "巳": "庙",
             "午": "陷", "未": "陷", "申": "旺", "酉": "平", "戌": "平", "亥": "庙"},
    "廉贞": {"子": "平", "丑": "利", "寅": "庙", "卯": "平", "辰": "利", "巳": "陷",
             "午": "平", "未": "利", "申": "庙", "酉": "平", "戌": "利", "亥": "陷"},
    "天府": {"子": "庙", "丑": "庙", "寅": "庙", "卯": "得", "辰": "庙", "巳": "得",
             "午": "旺", "未": "庙", "申": "得", "酉": "旺", "戌": "庙", "亥": "得"},
    "太阴": {"子": "庙", "丑": "庙", "寅": "闲", "卯": "陷", "辰": "陷", "巳": "陷",
             "午": "陷", "未": "平", "申": "利", "酉": "旺", "戌": "庙", "亥": "庙"},
    "贪狼": {"子": "旺", "丑": "庙", "寅": "平", "卯": "利", "辰": "庙", "巳": "陷",
             "午": "旺", "未": "庙", "申": "平", "酉": "利", "戌": "庙", "亥": "陷"},
    "巨门": {"子": "旺", "丑": "旺", "寅": "庙", "卯": "庙", "辰": "陷", "巳": "旺",
             "午": "旺", "未": "旺", "申": "庙", "酉": "庙", "戌": "陷", "亥": "旺"},
    "天相": {"子": "庙", "丑": "庙", "寅": "庙", "卯": "陷", "辰": "得", "巳": "得",
             "午": "庙", "未": "得", "申": "庙", "酉": "陷", "戌": "得", "亥": "得"},
    "天梁": {"子": "庙", "丑": "旺", "寅": "庙", "卯": "庙", "辰": "庙", "巳": "陷",
             "午": "庙", "未": "旺", "申": "陷", "酉": "得", "戌": "庙", "亥": "陷"},
    "七杀": {"子": "旺", "丑": "庙", "寅": "庙", "卯": "旺", "辰": "庙", "巳": "平",
             "午": "旺", "未": "庙", "申": "庙", "酉": "旺", "戌": "庙", "亥": "平"},
    "破军": {"子": "庙", "丑": "旺", "寅": "得", "卯": "陷", "辰": "旺", "巳": "平",
             "午": "庙", "未": "旺", "申": "得", "酉": "陷", "戌": "旺", "亥": "平"},
}
BRIGHT_SCORE = {"庙": 3.0, "旺": 2.2, "得": 1.4, "利": 0.8,
                "平": 0.0, "闲": -0.6, "不": -1.2, "陷": -2.0}

# 十二神
CHANGSHENG12 = ["长生", "沐浴", "冠带", "临官", "帝旺", "衰",
                "病", "死", "墓", "绝", "胎", "养"]
BOSHI12 = ["博士", "力士", "青龙", "小耗", "将军", "奏书",
           "飞廉", "喜神", "病符", "大耗", "伏兵", "官府"]
JIANGQIAN12 = ["将星", "攀鞍", "岁驿", "息神", "华盖", "劫煞",
               "灾煞", "天煞", "指背", "咸池", "月煞", "亡神"]
SUIQIAN12 = ["岁建", "晦气", "丧门", "贯索", "官符", "小耗",
             "大耗", "龙德", "白虎", "天德", "吊客", "病符"]

CHANGSHENG_START = {"水": "申", "木": "亥", "金": "巳", "土": "申", "火": "寅"}

MING_ZHU = {"子": "贪狼", "丑": "巨门", "寅": "禄存", "卯": "文曲", "辰": "廉贞",
            "巳": "武曲", "午": "破军", "未": "武曲", "申": "廉贞", "酉": "文曲",
            "戌": "禄存", "亥": "巨门"}
SHEN_ZHU = {"子": "火星", "丑": "天相", "寅": "天梁", "卯": "天同", "辰": "文昌",
            "巳": "天机", "午": "火星", "未": "天相", "申": "天梁", "酉": "天同",
            "戌": "文昌", "亥": "天机"}

XIAOXIAN_START = {"寅": "辰", "午": "辰", "戌": "辰",
                  "申": "戌", "子": "戌", "辰": "戌",
                  "巳": "未", "酉": "未", "丑": "未",
                  "亥": "丑", "卯": "丑", "未": "丑"}

TIGER = {0: 2, 5: 2, 1: 4, 6: 4, 2: 6, 7: 6, 3: 8, 8: 8, 4: 0, 9: 0}


@dataclass
class Star:
    name: str
    name_en: str
    kind: str          # 主星 / 辅星 / 煞星 / 杂曜
    hua: str = ""
    brightness: str = ""

    def label(self) -> str:
        return self.name + (f"化{self.hua}" if self.hua else "") + \
               (f"[{self.brightness}]" if self.brightness else "")


@dataclass
class Palace:
    branch: str
    index: int              # 子 = 0
    name: str
    name_en: str
    gan: str
    stars: list = field(default_factory=list)
    is_body: bool = False
    decade: tuple = ()
    ages: list = field(default_factory=list)
    changsheng: str = ""
    boshi: str = ""
    jiangqian: str = ""
    suiqian: str = ""
    self_hua: list = field(default_factory=list)

    @property
    def major(self) -> list:
        return [s for s in self.stars if s.kind == "主星"]

    @property
    def minor(self) -> list:
        return [s for s in self.stars if s.kind in ("辅星", "煞星")]

    @property
    def adj(self) -> list:
        return [s for s in self.stars if s.kind == "杂曜"]

    @property
    def lucky(self) -> list:
        return [s for s in self.stars if s.name in LUCKY]

    @property
    def unlucky(self) -> list:
        return [s for s in self.stars if s.name in UNLUCKY]


@dataclass
class ZiweiChart:
    name: str
    gender: str
    birth: _dt.datetime
    lunar_date: object
    hour_branch: str
    ming_branch: str = ""
    shen_branch: str = ""
    ju: str = ""
    ju_num: int = 0
    ziwei_branch: str = ""
    year_gan: str = ""
    year_zhi: str = ""
    ming_zhu: str = ""
    shen_zhu: str = ""
    dou_jun: str = ""
    palaces: list = field(default_factory=list)
    sihua: dict = field(default_factory=dict)
    sihua_school: str = "sanhe"
    leap_policy: str = "split"
    decade_direction: int = 1

    def palace(self, name: str) -> Palace:
        for p in self.palaces:
            if p.name == name:
                return p
        raise KeyError(name)

    def by_branch(self, branch: str) -> Palace:
        for p in self.palaces:
            if p.branch == branch:
                return p
        raise KeyError(branch)

    def sihua_of(self, stem: str) -> dict:
        tbl = SIHUA_SANHE if self.sihua_school == "sanhe" else SIHUA_FEIXING
        return dict(zip(tbl[stem], HUA_NAMES))

    def landed(self, stem: str) -> dict:
        """Where each transformation of `stem` lands."""
        hua = self.sihua_of(stem)
        out = {h: [] for h in HUA_NAMES}
        for p in self.palaces:
            for s in p.stars:
                if s.name in hua:
                    out[hua[s.name]].append((s.name, p.name, p.branch))
        return out


def _ming_index(month: int, hour_idx: int) -> int:
    return (2 + (month - 1) - hour_idx) % 12


def _shen_index(month: int, hour_idx: int) -> int:
    return (2 + (month - 1) + hour_idx) % 12


def _ziwei_index(ju: int, day: int) -> int:
    """起紫微訣: 「六五四三二，酉午亥辰丑，局數除日數，商數宮前走；
    若見數無餘，便要起虎口，日數小於局，還直宮中守。」

    Advance by the quotient from 寅, then move *forward* by the borrow when the
    borrow is even and *backward* when it is odd.
    """
    offset = 0
    while (day + offset) % ju:
        offset += 1
    q = (day + offset) // ju
    iz = (q % 12) - 1                       # 寅-based
    iz += offset if offset % 2 == 0 else -offset
    return (iz + 2) % 12                    # 子-based


def build_ziwei(name: str, gender: str, year: int, month: int, day: int,
                hour: int = 12, minute: int = 0,
                longitude: float = 116.40, tz_offset: float = 8.0,
                use_true_solar: bool = True,
                sihua_school: str = "sanhe",
                leap_policy: str = "split",
                year_boundary: str = "lunar") -> ZiweiChart:
    from ..bazi.chart import true_solar_offset
    jd = astro.to_jd(year, month, day, hour, minute)
    birth = _dt.datetime(year, month, day, hour, minute)
    ts = birth
    if use_true_solar:
        ts = birth + _dt.timedelta(minutes=true_solar_offset(jd, longitude, tz_offset))
    ld = lunar.lunar_from_jd(jd)
    hour_idx = ZHI.index(lunar.hour_branch_of(ts.hour + ts.minute / 60.0))

    if year_boundary == "lichun":
        yg_lunar = lunar.year_pillar(jd)[0]
    else:
        yg_lunar = GAN[(ld.year - 4) % 10]
    yz_lunar = ZHI[(ld.year - 4) % 12]
    yi, yi_z = GAN.index(yg_lunar), ZHI.index(yz_lunar)

    month_num = ld.month
    if ld.is_leap:
        if leap_policy == "split":
            month_num = ld.month if ld.day <= 15 else ld.month + 1
        elif leap_policy == "next":
            month_num = ld.month + 1
    month_num = ((month_num - 1) % 12) + 1
    mi = month_num - 1

    ming = _ming_index(month_num, hour_idx)
    shen = _shen_index(month_num, hour_idx)
    soul_s = (ming - 2) % 12              # 寅-based
    body_s = (shen - 2) % 12

    first = TIGER[yi]
    gans = [GAN[(first + i) % 10] for i in range(12)]      # index 0 = 寅
    ming_gan = gans[(ming - 2) % 12]
    ny = nayin(ming_gan, ZHI[ming])[0]
    ju_num, ju_name = JU[ny[-1]]

    zi_idx = _ziwei_index(ju_num, ld.day)
    fu_idx = (4 - zi_idx) % 12

    pos: dict[str, int] = {"紫微": zi_idx}
    for off, nm in ((-1, "天机"), (-3, "太阳"), (-4, "武曲"),
                    (-5, "天同"), (-8, "廉贞")):
        pos[nm] = (zi_idx + off) % 12
    for off, nm in ((0, "天府"), (1, "太阴"), (2, "贪狼"), (3, "巨门"),
                    (4, "天相"), (5, "天梁"), (6, "七杀"), (10, "破军")):
        pos[nm] = (fu_idx + off) % 12

    # 六吉六煞
    pos["左辅"] = (4 + mi) % 12
    pos["右弼"] = (10 - mi) % 12
    pos["文昌"] = (10 - hour_idx) % 12
    pos["文曲"] = (4 + hour_idx) % 12
    kui, yue = KUI_YUE[yg_lunar]
    pos["天魁"] = ZHI.index(kui)
    pos["天钺"] = ZHI.index(yue)
    lu = ZHI.index(LUCUN[yg_lunar])
    pos["禄存"] = lu
    pos["擎羊"] = (lu + 1) % 12
    pos["陀罗"] = (lu - 1) % 12
    pos["火星"] = (ZHI.index(HUOXING_START[yz_lunar]) + hour_idx) % 12
    pos["铃星"] = (ZHI.index(LINGXING_START[yz_lunar]) + hour_idx) % 12
    pos["地空"] = (11 - hour_idx) % 12
    pos["地劫"] = (11 + hour_idx) % 12
    pos["天马"] = ZHI.index({"申": "寅", "子": "寅", "辰": "寅",
                             "寅": "申", "午": "申", "戌": "申",
                             "巳": "亥", "酉": "亥", "丑": "亥",
                             "亥": "巳", "卯": "巳", "未": "巳"}[yz_lunar])

    # ---- 38 杂曜 (formulas reverse-engineered from iztro) ----
    pos["天姚"] = (1 + mi) % 12
    pos["天刑"] = (9 + mi) % 12
    pos["阴煞"] = ZHI.index(["寅", "子", "戌", "申", "午", "辰"][mi % 6])
    pos["天月"] = ZHI.index(["戌", "巳", "辰", "寅", "未", "卯",
                             "亥", "未", "寅", "午", "戌", "寅"][mi])
    pos["天巫"] = ZHI.index(["巳", "申", "寅", "亥"][mi % 4])
    pos["解神"] = ZHI.index(["申", "戌", "子", "寅", "辰", "午"][mi // 2])
    hong = (3 - yi_z) % 12
    pos["红鸾"] = hong
    pos["天喜"] = (hong + 6) % 12
    pos["咸池"] = ZHI.index({"申": "酉", "子": "酉", "辰": "酉",
                             "寅": "卯", "午": "卯", "戌": "卯",
                             "巳": "午", "酉": "午", "丑": "午",
                             "亥": "子", "卯": "子", "未": "子"}[yz_lunar])
    pos["华盖"] = ZHI.index({"申": "辰", "子": "辰", "辰": "辰",
                             "寅": "戌", "午": "戌", "戌": "戌",
                             "巳": "丑", "酉": "丑", "丑": "丑",
                             "亥": "未", "卯": "未", "未": "未"}[yz_lunar])
    _gu = {0: ("寅", "戌"), 1: ("寅", "戌"), 2: ("巳", "丑"), 3: ("巳", "丑"),
           4: ("巳", "丑"), 5: ("申", "辰"), 6: ("申", "辰"), 7: ("申", "辰"),
           8: ("亥", "未"), 9: ("亥", "未"), 10: ("亥", "未"), 11: ("寅", "戌")}
    gu, gua = _gu[yi_z]
    pos["孤辰"] = ZHI.index(gu)
    pos["寡宿"] = ZHI.index(gua)
    pos["破碎"] = ZHI.index(["巳", "丑", "酉"][yi_z % 3])
    pos["蜚廉"] = ZHI.index(["申", "酉", "戌", "巳", "午", "未",
                             "寅", "卯", "辰", "亥", "子", "丑"][yi_z])
    pos["龙池"] = (4 + yi_z) % 12
    pos["凤阁"] = (10 - yi_z) % 12
    pos["天哭"] = (6 - yi_z) % 12
    pos["天虚"] = (6 + yi_z) % 12
    pos["天官"] = ZHI.index(["未", "辰", "巳", "寅", "卯", "酉",
                             "亥", "酉", "戌", "午"][yi])
    pos["天福"] = ZHI.index(["酉", "申", "子", "亥", "卯", "寅",
                             "午", "巳", "午", "巳"][yi])
    pos["天厨"] = ZHI.index(["巳", "午", "子", "巳", "午", "申",
                             "寅", "午", "酉", "亥"][yi])
    pos["天德"] = (9 + yi_z) % 12
    pos["月德"] = (5 + yi_z) % 12
    pos["天空"] = (yi_z + 1) % 12
    pos["截路"] = ZHI.index(["申", "午", "辰", "寅", "子"][yi % 5])
    pos["空亡"] = ZHI.index(["酉", "未", "巳", "卯", "丑"][yi % 5])
    xun = (yi_z + 9 - yi + 1) % 12
    if (yi_z % 2) != (xun % 2):
        xun = (xun + 1) % 12
    pos["旬空"] = xun
    pos["年解"] = ZHI.index(["戌", "酉", "申", "未", "午", "巳",
                             "辰", "卯", "寅", "丑", "子", "亥"][yi_z])
    pos["天才"] = (soul_s + yi_z + 2) % 12
    pos["天寿"] = (body_s + yi_z + 2) % 12
    pos["台辅"] = (6 + hour_idx) % 12
    pos["封诰"] = (2 + hour_idx) % 12
    zuo_z, you_z = pos["左辅"], pos["右弼"]
    chang_z, qu_z = pos["文昌"], pos["文曲"]
    day_idx = ld.day - 1                      # 生日索引（初一 = 0）
    pos["三台"] = (zuo_z + day_idx) % 12
    pos["八座"] = (you_z - day_idx) % 12
    pos["恩光"] = ((chang_z + day_idx) % 12 - 1) % 12
    pos["天贵"] = ((qu_z + day_idx) % 12 - 1) % 12
    pos["天伤"] = (soul_s - 7 + 2) % 12      # 仆役宫位
    pos["天使"] = (soul_s - 5 + 2) % 12      # 疾厄宫位

    hua_map = {}
    tbl = SIHUA_SANHE if sihua_school == "sanhe" else SIHUA_FEIXING
    for star_name, hua in zip(tbl[yg_lunar], HUA_NAMES):
        hua_map[star_name] = hua

    chart = ZiweiChart(
        name=name, gender=gender, birth=birth, lunar_date=ld,
        hour_branch=ZHI[hour_idx],
        ming_branch=ZHI[ming], shen_branch=ZHI[shen],
        ju=ju_name, ju_num=ju_num, ziwei_branch=ZHI[zi_idx],
        year_gan=yg_lunar, year_zhi=yz_lunar,
        ming_zhu=MING_ZHU[ZHI[ming]], shen_zhu=SHEN_ZHU[yz_lunar],
        sihua_school=sihua_school, leap_policy=leap_policy,
    )
    # 斗君：流年正月起于流年支，逆数至生月，再顺数至生时
    chart.dou_jun = ZHI[(yi_z - mi + hour_idx) % 12]

    yang = yi_z % 2 == 0
    male = gender in ("male", "男", "m")
    chart.decade_direction = 1 if (yang == male) else -1
    forward = chart.decade_direction > 0

    cs_start = ZHI.index(CHANGSHENG_START[ju_name[0]])
    cs = {}
    for i, nm in enumerate(CHANGSHENG12):
        cs[(cs_start + i) % 12 if forward else (cs_start - i) % 12] = nm
    bs = {}
    for i, nm in enumerate(BOSHI12):
        bs[(lu + i) % 12 if forward else (lu - i) % 12] = nm
    jq_start = ZHI.index({"寅": "午", "午": "午", "戌": "午",
                          "申": "子", "子": "子", "辰": "子",
                          "巳": "酉", "酉": "酉", "丑": "酉",
                          "亥": "卯", "卯": "卯", "未": "卯"}[yz_lunar])
    jq = {(jq_start + i) % 12: nm for i, nm in enumerate(JIANGQIAN12)}
    sq = {(yi_z + i) % 12: nm for i, nm in enumerate(SUIQIAN12)}

    xx_start = ZHI.index(XIAOXIAN_START[yz_lunar])
    ages_by_branch: dict[int, list[int]] = {}
    for k in range(12):
        b = (xx_start + k) % 12 if male else (xx_start - k) % 12
        ages_by_branch[b] = list(range(k + 1, 121, 12))

    order = {n: i for i, n in enumerate(MAJOR_STARS)}
    for k in range(12):
        idx = (ming - k) % 12
        stars = []
        for sname, sidx in pos.items():
            if sidx != idx:
                continue
            kind = ("主星" if sname in MAJOR_STARS
                    else "辅星" if sname in LUCKY
                    else "煞星" if sname in UNLUCKY else "杂曜")
            stars.append(Star(
                name=sname, name_en=STAR_EN.get(sname, sname), kind=kind,
                hua=hua_map.get(sname, ""),
                brightness=BRIGHTNESS.get(sname, {}).get(ZHI[idx], ""),
            ))
        stars.sort(key=lambda s: (0 if s.kind == "主星" else
                                  1 if s.kind == "辅星" else
                                  2 if s.kind == "煞星" else 3,
                                  order.get(s.name, 99)))
        gan_here = gans[(idx - 2) % 12]
        self_tbl = dict(zip(tbl[gan_here], HUA_NAMES))
        self_h = [(s.name, self_tbl[s.name]) for s in stars if s.name in self_tbl]
        p = Palace(
            branch=ZHI[idx], index=idx, name=PALACE_NAMES[k],
            name_en=PALACE_EN[k], gan=gan_here, stars=stars,
            is_body=(idx == shen),
            changsheng=cs.get(idx, ""), boshi=bs.get(idx, ""),
            jiangqian=jq.get(idx, ""), suiqian=sq.get(idx, ""),
            ages=ages_by_branch.get(idx, []),
            self_hua=self_h,
        )
        chart.palaces.append(p)

    # 大限：陽男陰女順行、陰男陽女逆行，每宮十年
    for p in chart.palaces:
        k = ((p.index - ming) if forward else (ming - p.index)) % 12
        p.decade = (ju_num + k * 10, ju_num + k * 10 + 9)
    chart.sihua = hua_map
    return chart
