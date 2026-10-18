"""Emit web/data.js from the Python reference tables.

Any table that exists in Python must be generated, never retyped: the JS
engine and the Python engine then cannot drift apart.

    python tools/gen_js_data.py
"""

from __future__ import annotations

import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

from mingli.calendar import astro  # noqa: E402
from mingli.calendar import ganzhi as G  # noqa: E402
from mingli.bazi import chart as BC  # noqa: E402
from mingli.ziwei import chart as ZC  # noqa: E402
from mingli.ziwei import analysis as ZA  # noqa: E402


def _glossary():
    from mingli.glossary import GLOSSARY
    return GLOSSARY


def _gua():
    from mingli import gua as G
    rows = [[up, lo, name, text, tone, en]
            for (up, lo), (name, text, tone, en) in G.GUA.items()]
    return {"rows": rows, "names": G.GUA_EN,
            "trigrams": [[t[0], t[1], list(t[2]), t[3], t[4], t[5]] for t in G.TRIGRAMS],
            "tones": {"zh": G.TONE_ZH, "en": G.TONE_EN}}


def _synastry_cfg():
    from mingli import synastry as S
    return {k: {"zh": v["zh"], "en": v["en"], "weights": v["weights"],
                "note": v["note"], "noteEn": v["noteEn"]}
            for k, v in S.RELATIONS.items()}


def _percentiles():
    from mingli import scoring
    return {"quantiles": scoring.QUANTILES,
            "yearQuantiles": scoring.YEAR_QUANTILES,
            "dimStats": scoring.DIM_STATS,
            "weights": scoring.WEIGHTS,
            "dims": scoring.DIMS}


def _i18n():
    from mingli import interpret as I
    from mingli.calendar import ganzhi as G
    from mingli.ziwei import chart as ZC
    return {
        "shishen": {k: v.split(" (")[0] for k, v in G.SHISHEN_EN.items()},
        "shishenInfo": I.SHISHEN_INFO,
        "shensha": I.SHENSHA_EN,
        "structure": I.STRUCTURE_EN,
        "theme": I.THEME_EN,
        "zwPalace": I.ZW_PALACE,
        "zwStar": I.ZW_STAR,
        "zwStarEn": I.ZW_STAR_EN,
        "palaceEn": I.PALACE_EN,
        "huaInfo": I.HUA_INFO,
        "huaEn": I.HUA_EN,
        "bright": I.BRIGHT_ZH, "brightEn": I.BRIGHT_EN,
        "pillarInfo": I.PILLAR_INFO,
        "star": ZC.STAR_EN,
        "palaceNameEn": dict(zip(ZC.PALACE_NAMES, ZC.PALACE_EN)),
        "wx": I.TIANGAN_WX_EN,
        "strength": {"极强": "very strong", "偏强": "strong", "中和": "balanced",
                     "偏弱": "weak", "极弱": "very weak"},
        "structureKind": {"普通格": "ordinary", "特殊格": "exceptional"},
    }


def _shensha_tables():
    from mingli.bazi import shensha as S
    names = ["TIANYI", "TAIJI", "WENCHANG", "GUOYIN", "FUXING", "LU", "YANGREN",
             "JINYU", "HONGYAN", "LIUXIA", "XUETANG", "YIMA", "TAOHUA", "HUAGAI",
             "JIANGXING", "JIESHA", "ZAISHA", "WANGSHEN", "GUSHEN", "GUASU",
             "POSUI", "FEILIAN", "TIANDE", "YUEDE",
             "TIANGUAN", "TIANCHU", "GAN_HE_MAP", "ZHI_HE_MAP", "DESHOW"]
    out = {n: getattr(S, n) for n in names}
    out["TIANSHU_HIT"] = {k: list(v) for k, v in S.TIANSHU_HIT.items()}
    out["SIFEI"] = {k: list(v) for k, v in S.SIFEI.items()}
    out["DEFS"] = {k: list(v) for k, v in S.DEFS.items()}
    out["JINSHEN"] = sorted(S.JINSHEN)
    out["LIUXIU"] = sorted(S.LIUXIU)
    out["SHILING"] = sorted(S.SHILING)
    out["GULUAN"] = sorted(S.GULUAN)
    out["RIDE"] = sorted(S.RIDE)
    out["KUIGANG"] = sorted(S.KUIGANG)
    out["SHIE_DABAI"] = sorted(S.SHIE_DABAI)
    out["YINYANG_CUO"] = sorted(S.YINYANG_CUO)
    out["SANQI"] = [list(x) for x in S.SANQI]
    return out


def dump():
    data = {
        "GAN": G.GAN, "ZHI": G.ZHI,
        "GAN_WUXING": G.GAN_WUXING, "ZHI_WUXING": G.ZHI_WUXING,
        "GAN_YINYANG": G.GAN_YINYANG,
        "SHENG": G.SHENG, "KE": G.KE,
        "HIDDEN": {k: list(v) for k, v in G.HIDDEN.items()},
        "NAYIN": G.NAYIN,
        "CHANGSHENG": G.CHANGSHENG,
        "TIANYI": {k: list(v) for k, v in G.TIANYI.items()},
        "WENCHANG": G.WENCHANG, "YIMA": G.YIMA, "TAOHUA": G.TAOHUA,
        "HUAGAI": G.HUAGAI, "JIANGXING": G.JIANGXING,
        "YANGREN": G.YANGREN, "LU": G.LU,
        "CHONG": G.CHONG, "HE6": G.HE6, "HAI6": G.HAI6, "PO": G.PO,
        "SANHE": [list(x) for x in G.SANHE], "SANHUI": [list(x) for x in G.SANHUI],
        "GAN_HE": {k: list(v) for k, v in G.GAN_HE.items()},
        "GAN_CHONG": G.GAN_CHONG,
        "TERM_NAMES": astro.TERM_NAMES,
        "JIE_NAMES": astro.JIE_NAMES,
        "ZHONGQI_NAMES": astro.ZHONGQI_NAMES,
        "VSOP_L0": astro._L0, "VSOP_L1": astro._L1, "VSOP_L2": astro._L2,
        "VSOP_L3": astro._L3, "VSOP_L4": astro._L4, "VSOP_L5": astro._L5,
        "VSOP_R0": astro._R0, "VSOP_R1": astro._R1, "VSOP_R2": astro._R2,
        "STEM_W": BC.STEM_W, "BRANCH_W": BC.BRANCH_W,
        "SEASON_STATE": BC.SEASON_STATE, "STATE_MULT": BC.STATE_MULT,
        "TIAOHOU": BC.TIAOHOU,
        "PALACE_NAMES": ZC.PALACE_NAMES, "PALACE_EN": ZC.PALACE_EN,
        "MAJOR_STARS": ZC.MAJOR_STARS, "STAR_EN": ZC.STAR_EN,
        "LUCKY": sorted(ZC.LUCKY), "UNLUCKY": sorted(ZC.UNLUCKY),
        "SIHUA_SANHE": {k: list(v) for k, v in ZC.SIHUA_SANHE.items()},
        "SIHUA_FEIXING": {k: list(v) for k, v in ZC.SIHUA_FEIXING.items()},
        "JU": {k: list(v) for k, v in ZC.JU.items()},
        "KUI_YUE": {k: list(v) for k, v in ZC.KUI_YUE.items()},
        "LUCUN": ZC.LUCUN,
        "HUOXING_START": ZC.HUOXING_START, "LINGXING_START": ZC.LINGXING_START,
        "BRIGHTNESS": ZC.BRIGHTNESS, "BRIGHT_SCORE": ZC.BRIGHT_SCORE,
        "CHANGSHENG12": ZC.CHANGSHENG12, "BOSHI12": ZC.BOSHI12,
        "JIANGQIAN12": ZC.JIANGQIAN12, "SUIQIAN12": ZC.SUIQIAN12,
        "CHANGSHENG_START": ZC.CHANGSHENG_START,
        "MING_ZHU": ZC.MING_ZHU, "SHEN_ZHU": ZC.SHEN_ZHU,
        "XIAOXIAN_START": ZC.XIAOXIAN_START,
        "SHENSHA": _shensha_tables(),
        "I18N": _i18n(),
        "GLOSSARY": _glossary(),
        "GUA": _gua(),
        "SYNASTRY": _synastry_cfg(),
        "PERCENTILES": _percentiles(),
        "PATTERNS": [list(p) for p in ZA.PATTERNS],
        "PATTERN_BONUS": ZA.PATTERN_BONUS,
        "DECADE_THEMES": {k: list(v) for k, v in ZA.DECADE_THEMES.items()},
        "THEME_MAP": BC.__dict__.get("THEME_MAP") or {},
    }
    from mingli.bazi import luck as L
    data["THEME_MAP"] = {k: list(v) for k, v in L.THEME_MAP.items()}
    data["POS_WEIGHT"] = L.POS_WEIGHT
    return data


def main():
    out = os.path.join(ROOT, "web", "data.js")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    payload = json.dumps(dump(), ensure_ascii=False, separators=(",", ":"))
    with open(out, "w", encoding="utf-8") as f:
        f.write("/* Auto-generated by tools/gen_js_data.py — do not edit. */\n")
        f.write("window.ML_DATA=")
        f.write(payload)
        f.write(";\n")
    print(f"wrote {out} ({len(payload)/1024:.1f} KB)")


if __name__ == "__main__":
    main()
