"""第二轮新增模块的测试：格局贵贱、卦象、合盘、术语、流年判法。"""

import itertools
import unittest

from mingli import glossary, gua, pattern, synastry
from mingli.bazi import luck
from mingli.bazi.chart import build_chart
from mingli.ziwei.chart import build_ziwei

# 1993-06-14 17:31 北京：丙火午月羊刃，癸酉／戊午／丙寅／丁酉
A = dict(name="A", gender="male", year=1993, month=6, day=14,
         hour=17, minute=31, longitude=116.65)


class TestPattern(unittest.TestCase):
    def setUp(self):
        self.c = build_chart(A["name"], A["gender"], A["year"], A["month"],
                             A["day"], A["hour"], A["minute"],
                             longitude=A["longitude"])
        self.z = build_ziwei(A["name"], A["gender"], A["year"], A["month"],
                             A["day"], A["hour"], A["minute"],
                             longitude=A["longitude"])

    def test_bazi_grade_shape(self):
        g = pattern.bazi_grade(self.c)
        self.assertIn("score", g)
        self.assertIn(g["grade"], ["上上格", "上格", "中上格", "中格", "中下格", "下格"])
        self.assertTrue(g["items"])
        # 每条 note 必须是字符串，不能把 dict 拼进模板（页面上会显示 [object Object]）
        for it in g["items"]:
            self.assertIsInstance(it["note"], str, it["name"])
            self.assertIn(it["kind"], ("setup", "break", "rescue"))

    def test_grade_not_an_average(self):
        """格位与强度是两件事：格位由成格度/破/救决定，不由七维平均决定。"""
        g = pattern.bazi_grade(self.c)
        expect = (26 + 62 * g["setup_ratio"] - g["broken"] + g["rescued"] * 1.35)
        self.assertAlmostEqual(g["score"], round(min(99.0, max(6.0, expect)), 1), places=1)

    def test_rescue_outweighs_break(self):
        """《五言独步》「有病方为贵」：救应系数应大于 1，破而有救可反贵于无破。"""
        g = pattern.bazi_grade(self.c)
        self.assertGreater(g["rescued"], 0, "这张盘应有救应（甲制戊、财生官）")
        self.assertGreater(g["broken"], 0, "这张盘也应有破（戊癸合官）")

    def test_ziwei_pattern_requires_clean(self):
        """紫微吉格须「吉星加会且无煞」；带煞只能记「有瑕」。"""
        g = pattern.ziwei_grade(self.z)
        for p in g["patterns"]:
            self.assertIn(p["status"], ("成立", "有瑕"))
            if p["status"] == "有瑕":
                self.assertTrue(p["bad"] or p["aux"] < 2)

    def test_combined_weights(self):
        b = pattern.bazi_grade(self.c)
        z = pattern.ziwei_grade(self.z)
        cb = pattern.combined_grade(b, z)
        self.assertAlmostEqual(cb["score"], round(0.55 * b["score"] + 0.45 * z["score"], 1), places=1)
        self.assertEqual(cb["grade"], pattern.grade_of(cb["score"]))


class TestGua(unittest.TestCase):
    def test_all_64(self):
        names = {t[0] for t in gua.TRIGRAMS}
        pairs = list(itertools.product(names, repeat=2))
        self.assertEqual(len(pairs), 64)
        for up, lo in pairs:
            self.assertIn((up, lo), gua.GUA, f"missing {up}{lo}")
        self.assertEqual(len({gua.GUA[p][0] for p in pairs}), 64, "duplicate hexagram names")

    def test_cast_deterministic(self):
        a = gua.cast(10, 4, 25, 10)
        b = gua.cast(10, 4, 25, 10)
        self.assertEqual(a["name"], b["name"])
        self.assertEqual(a["moving"], b["moving"])
        self.assertEqual(len(a["lines"]), 6)
        # 动爻确实被翻转
        self.assertNotEqual(a["lines"][a["moving"] - 1], a["flipped"][a["moving"] - 1])

    def test_mutual_and_result(self):
        for args in [(1, 1, 1, 1), (10, 4, 25, 10), (5, 12, 30, 12), (7, 7, 7, 7)]:
            r = gua.cast(*args)
            self.assertIn(r["mutual"], {g[0] for g in gua.GUA.values()})
            self.assertIn(r["result"], {g[0] for g in gua.GUA.values()})
            self.assertIn(r["rel"], ("比和", "用生体", "体生用", "体克用", "用克体"))

    def test_ti_yong_follows_moving_line(self):
        r = gua.cast(10, 4, 25, 10)
        if r["moving"] <= 3:
            self.assertEqual((r["ti"], r["yong"]), (r["upper"], r["lower"]))
        else:
            self.assertEqual((r["ti"], r["yong"]), (r["lower"], r["upper"]))


class TestSynastry(unittest.TestCase):
    def setUp(self):
        self.a = build_chart("A", "male", 1993, 6, 14, 17, 31, longitude=116.65)
        self.b = build_chart("B", "female", 1997, 10, 10, 20, 0, longitude=105.57)
        self.za = build_ziwei("A", "male", 1993, 6, 14, 17, 31, longitude=116.65)
        self.zb = build_ziwei("B", "female", 1997, 10, 10, 20, 0, longitude=105.57)

    def test_every_relation_runs(self):
        for rel in synastry.RELATIONS:
            r = synastry.compare(self.a, self.b, rel, self.za, self.zb)
            self.assertGreaterEqual(r["score"], 0)
            self.assertLessEqual(r["score"], 100)
            self.assertEqual(len(r["items"]), 6)
            # 权重之和应为 1，否则总分会被系统性缩放
            self.assertAlmostEqual(sum(r["weights"].values()), 1.0, places=3)
            for it in r["items"]:
                self.assertTrue(it["notes"], it["key"])

    def test_symmetry_of_branches(self):
        """日支合冲在两盘之间是对称的，交换顺序不应改变夫妻宫分。"""
        r1 = synastry.compare(self.a, self.b, "couple", self.za, self.zb)
        r2 = synastry.compare(self.b, self.a, "couple", self.zb, self.za)
        s1 = next(i["score"] for i in r1["items"] if i["key"] == "spouse")
        s2 = next(i["score"] for i in r2["items"] if i["key"] == "spouse")
        self.assertEqual(s1, s2)


class TestGlossary(unittest.TestCase):
    def test_core_terms_present(self):
        required = ["日主", "月令", "藏干", "调候", "用神", "正官", "七杀",
                    "伤官", "食神", "正印", "偏印", "比肩", "劫财",
                    "正财", "偏财", "六冲", "六合", "三合", "大限", "小限",
                    "三方四正", "化忌", "庙旺利陷", "本卦", "变卦", "动爻"]
        for t in required:
            self.assertIn(t, glossary.GLOSSARY, t)

    def test_bilingual_and_nonempty(self):
        for k, v in glossary.GLOSSARY.items():
            self.assertTrue(v["zh"].strip(), k)
            self.assertTrue(v["en"].strip(), k)
            self.assertIn(v["cat"], ("基础", "十神", "格局", "刑冲合害", "紫微", "卦象", "神煞"))

    def test_shensha_covered(self):
        from mingli.bazi.shensha import DEFS
        for name in DEFS:
            self.assertIn(name, glossary.GLOSSARY, name)


class TestFlow(unittest.TestCase):
    def setUp(self):
        self.c = build_chart("A", "male", 1993, 6, 14, 17, 31, longitude=116.65)
        self.cyc = next(c for c in luck.luck_cycles(self.c, 10, 2026) if c.active)

    def test_components_exposed(self):
        p = luck.year_period(self.c, 2026, self.cyc)
        for k in ("用神", "十神", "冲合", "大运", "神煞"):
            self.assertIn(k, p.components)
        self.assertGreaterEqual(p.score, 12)
        self.assertLessEqual(p.score, 92)

    def test_bad_luck_cushions_good_year(self):
        """大运凶而流年吉，其吉应被打折（否则大运等于没用）。"""
        good = luck.evaluate_period(self.c, "庚", "申", self.cyc)
        good_no = luck.evaluate_period(self.c, "庚", "申", None)
        self.assertLess(good["score"], good_no["score"],
                        "大运基调为忌时，流年吉力应被削弱")

    def test_band_monotonic(self):
        vals = [luck.year_period(self.c, y, self.cyc).score for y in range(2020, 2036)]
        bands = [luck._band(v) for v in vals]
        order = ["凶", "偏弱", "小凶", "平", "小吉", "吉", "大吉"]
        idx = [order.index(b) for b in bands]
        # 分数升高时档位不能倒退
        for i in range(len(vals) - 1):
            if vals[i] < vals[i + 1]:
                self.assertLessEqual(idx[i], idx[i + 1])


if __name__ == "__main__":
    unittest.main()
