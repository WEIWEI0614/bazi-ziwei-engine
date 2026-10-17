"""Zi Wei Dou Shu (紫微斗數) chart construction — 三合派 base with
中州派 / 飛星派 alternatives exposed as options."""

from __future__ import annotations

import datetime as _dt
from dataclasses import dataclass, field

from ..calendar import astro, lunar
from ..calendar.ganzhi import (GAN, NAYIN, ZHI, ganzhi_index, nayin, YIMA)

PALACE_NAMES = ["命宫", "兄弟", "夫妻", "子女", "财帛", "疾厄",
                "迁移", "仆役", "官禄", "田宅", "福德", "父母"]
PALACE_EN = ["Life", "Siblings", "Spouse", "Children", "Wealth", "Health",
             "Travel", "Friends", "Career", "Property", "Fortune", "Parents"]

MAJOR_STARS = ["紫微", "天机", "太阳", "武曲", "天同", "廉贞",
               "天府", "太阴", "贪狼", "巨门", "天相", "天梁", "七杀", "破军"]

STAR_EN = {
    "紫微": "Zi Wei (Emperor)", "天机": "Tian Ji (Advisor)",
    "太阳": "Tai Yang (Sun)", "武曲": "Wu Qu (General)",
    "天同": "Tian Tong (Bliss)", "廉贞": "Lian Zhen (Chastity)",
    "天府": "Tian Fu (Treasury)", "太阴": "Tai Yin (Moon)",
    "贪狼": "Tan Lang (Wolf)", "巨门": "Ju Men (Gate)",
    "天相": "Tian Xiang (Minister)", "天梁": "Tian Liang (Elder)",
    "七杀": "Qi Sha (Seven Killings)", "破军": "Po Jun (Destroyer)",
    "左辅": "Zuo Fu", "右弼": "You Bi", "文昌": "Wen Chang",
    "文曲": "Wen Qu", "天魁": "Tian Kui", "天钺": "Tian Yue",
    "禄存": "Lu Cun", "擎羊": "Qing Yang", "陀罗": "Tuo Luo",
    "火星": "Huo Xing", "铃星": "Ling Xing", "地空": "Di Kong",
    "地劫": "Di Jie", "天马": "Tian Ma",
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
HUA_EN = ("Prosperity", "Power", "Fame", "Obstacle")

# 五行局: 纳音五行 -> (局数, 名)
JU = {"水": (2, "水二局"), "木": (3, "木三局"), "金": (4, "金四局"),
      "土": (5, "土五局"), "火": (6, "火六局")}
JU_EN = {"水二局": "Water 2", "木三局": "Wood 3", "金四局": "Metal 4",
         "土五局": "Earth 5", "火六局": "Fire 6"}

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

# 星曜亮度 (廟/旺/得/利/平/不/陷) — 主星 × 地支
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


@dataclass
class Star:
    name: str
    name_en: str
    kind: str          # 主星 / 辅星 / 煞星 / 杂曜
    hua: str = ""      # 禄 / 权 / 科 / 忌
    brightness: str = ""


@dataclass
class Palace:
    branch: str
    branch_en: str
    index: int
    name: str
    name_en: str
    gan: str
    stars: list = field(default_factory=list)
    is_body: bool = False
    decade: tuple = ()
    changsheng: str = ""
    # transients filled by analysis
    yearly_focus: bool = False

    @property
    def major(self) -> list:
        return [s for s in self.stars if s.kind == "主星"]

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


def _ming_index(month: int, hour_idx: int) -> int:
    """寅=2 起正月，順數至生月，再自該宮起子時逆數至生時。"""
    return (2 + (month - 1) - hour_idx) % 12


def _shen_index(month: int, hour_idx: int) -> int:
    return (2 + (month - 1) + hour_idx) % 12


def _ziwei_index(ju: int, day: int) -> int:
    """起紫微訣（0-based index with 子 = 0）.

    「六五四三二，酉午亥辰丑，局數除日數，商數宮前走；
      若見數無餘，便要起虎口，日數小於局，還直宮中守。」

    由寅宮起算，先順進 (商-1) 宮；借數為偶則再順行借數宮，
    為奇則逆退借數宮。
    """
    offset = 0
    while (day + offset) % ju:
        offset += 1
    q = (day + offset) // ju
    iz = (q % 12) - 1                       # 寅-based
    iz += offset if offset % 2 == 0 else -offset
    return (iz + 2) % 12                    # convert to 子-based


def _palace_gans(year_gan: str) -> list[str]:
    """五虎遁: stems of the 12 branches starting from 寅."""
    yg = GAN.index(year_gan)
    first = {0: 2, 5: 2, 1: 4, 6: 4, 2: 6, 7: 6,
             3: 8, 8: 8, 4: 0, 9: 0}[yg]
    return [GAN[(first + i) % 10] for i in range(12)]   # index 0 = 寅


def build_ziwei(name: str, gender: str, year: int, month: int, day: int,
                hour: int = 12, minute: int = 0,
                longitude: float = 116.40, tz_offset: float = 8.0,
                use_true_solar: bool = True,
                sihua_school: str = "sanhe",
                leap_policy: str = "split") -> ZiweiChart:
    from ..bazi.chart import true_solar_offset
    jd = astro.to_jd(year, month, day, hour, minute)
    birth = _dt.datetime(year, month, day, hour, minute)
    ts = birth
    if use_true_solar:
        ts = birth + _dt.timedelta(minutes=true_solar_offset(jd, longitude, tz_offset))
        jd_ts = astro.to_jd(ts.year, ts.month, ts.day, ts.hour, ts.minute, ts.second)
    else:
        jd_ts = jd
    ld = lunar.lunar_from_jd(jd)
    hour_idx = ZHI.index(lunar.hour_branch_of(ts.hour + ts.minute / 60.0))

    yg = GAN[(lunar.year_pillar(jd)[2] - 4) % 10]   # 立春 year stem
    # 紫微 uses the lunar-year stem, not the 立春 one
    yg_lunar = GAN[(ld.year - 4) % 10]

    month_num = ld.month
    if ld.is_leap:
        if leap_policy == "split":
            month_num = ld.month if ld.day <= 15 else ld.month + 1
        elif leap_policy == "next":
            month_num = ld.month + 1
        else:
            month_num = ld.month
    month_num = ((month_num - 1) % 12) + 1

    ming = _ming_index(month_num, hour_idx)
    shen = _shen_index(month_num, hour_idx)
    gans = _palace_gans(yg_lunar)          # [0] = 寅
    ming_gan = gans[(ming - 2) % 12]
    ming_zhi = ZHI[ming]
    ny = nayin(ming_gan, ming_zhi)[0]
    ju_wx = ny[-1]
    ju_num, ju_name = JU[ju_wx]

    zi_idx = _ziwei_index(ju_num, ld.day)
    fu_idx = (4 - zi_idx) % 12

    pos = {}
    for off, nm in ((-1, "天机"), (-3, "太阳"), (-4, "武曲"),
                    (-5, "天同"), (-8, "廉贞")):
        pos[nm] = (zi_idx + off) % 12
    pos["紫微"] = zi_idx
    for off, nm in ((0, "天府"), (1, "太阴"), (2, "贪狼"), (3, "巨门"),
                    (4, "天相"), (5, "天梁"), (6, "七杀"), (10, "破军")):
        pos[nm] = (fu_idx + off) % 12

    # 六吉六煞
    pos["左辅"] = (4 + (month_num - 1)) % 12
    pos["右弼"] = (10 - (month_num - 1)) % 12
    pos["文昌"] = (10 - hour_idx) % 12
    pos["文曲"] = (4 + hour_idx) % 12
    kui, yue = KUI_YUE[yg_lunar]
    pos["天魁"] = ZHI.index(kui)
    pos["天钺"] = ZHI.index(yue)
    lu = ZHI.index(LUCUN[yg_lunar])
    pos["禄存"] = lu
    pos["擎羊"] = (lu + 1) % 12
    pos["陀罗"] = (lu - 1) % 12
    hx = ZHI.index(HUOXING_START[ZHI[(ld.year - 4) % 12]])
    pos["火星"] = (hx + hour_idx) % 12
    lx = ZHI.index(LINGXING_START[ZHI[(ld.year - 4) % 12]])
    pos["铃星"] = (lx + hour_idx) % 12
    pos["地空"] = (11 - hour_idx) % 12
    pos["地劫"] = (11 + hour_idx) % 12
    pos["天马"] = ZHI.index(YIMA[ZHI[(ld.year - 4) % 12]])

    sihua_tbl = SIHUA_SANHE if sihua_school == "sanhe" else SIHUA_FEIXING
    hua_map = {}
    for star_name, hua in zip(sihua_tbl[yg_lunar], HUA_NAMES):
        hua_map[star_name] = hua

    chart = ZiweiChart(
        name=name, gender=gender, birth=birth, lunar_date=ld,
        hour_branch=ZHI[hour_idx],
        ming_branch=ZHI[ming], shen_branch=ZHI[shen],
        ju=ju_name, ju_num=ju_num, ziwei_branch=ZHI[zi_idx],
        year_gan=yg_lunar, sihua_school=sihua_school,
        leap_policy=leap_policy,
    )

    # 大限方向: 陽男陰女順行, 陰男陽女逆行
    yang = GAN.index(yg_lunar) % 2 == 0
    male = gender in ("male", "男", "m")
    chart.decade_direction = 1 if (yang == male) else -1

    # 十二宫: 命宫起, 逆时针排
    for k in range(12):
        idx = (ming - k) % 12
        stars = []
        for sname, sidx in pos.items():
            if sidx != idx:
                continue
            kind = ("主星" if sname in MAJOR_STARS
                    else "辅星" if sname in LUCKY else "煞星")
            stars.append(Star(
                name=sname, name_en=STAR_EN.get(sname, sname), kind=kind,
                hua=hua_map.get(sname, ""),
                brightness=BRIGHTNESS.get(sname, {}).get(ZHI[idx], ""),
            ))
        stars.sort(key=lambda s: (s.kind != "主星",
                                  MAJOR_STARS.index(s.name) if s.name in MAJOR_STARS else 99))
        p = Palace(
            branch=ZHI[idx], branch_en=ZHI[idx],
            index=idx, name=PALACE_NAMES[k], name_en=PALACE_EN[k],
            gan=gans[(idx - 2) % 12],
            stars=stars, is_body=(idx == shen),
        )
        chart.palaces.append(p)

    # 大限 (起于命宫, 每宫十年, 起限岁数 = 局数)
    ages = list(range(ju_num, ju_num + 120, 10))
    for k, p in enumerate(chart.palaces):
        start = ages[k]
        p.decade = (start, start + 9)
    chart.sihua = {star: hua for star, hua in hua_map.items()}
    return chart
