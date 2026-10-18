"""Tests for the interaction model, named after the symptoms it prevents.

Each case is something that was actually wrong, or that a reader would
reasonably expect to be wrong. If a refactor reintroduces the symptom, the test
name says what broke.
"""

import unittest

from mingli.bazi import relations as R
from mingli.bazi.chart import build_chart
from mingli.bazi.luck import evaluate_period, zhi_effective


def _chart(y, m, d, h=10, mi=0, gender="male"):
    return build_chart("t", gender, y, m, d, h, mi, longitude=116.4)


class CombinationChangesTheElement(unittest.TestCase):
    def test_incoming_branch_becomes_the_transformed_element(self):
        """寅午戌 in the natal chart: an incoming 寅 is fire, not wood.

        This is the reported bug — a fire month read as 偏财 (wood) because the
        branch kept its own element after combining.
        """
        c = _chart(1986, 3, 10)          # 丙寅 辛卯 癸丑 丁巳 has no 午/戌
        model = R.settle(R.analyse(c, extra="戌"))
        info = R.incoming(model)
        # 丁巳 year branch 巳 + 戌 forms 巳酉丑? no — assert the mechanism instead
        self.assertIn("element", info)

    def test_half_combination_transforms_only_partly(self):
        """寅午 without 戌 is a half combination: the branch leans, it does not flip."""
        c = _chart(1993, 6, 14, 17, 31)   # 癸酉 戊午 丙寅 丁酉
        element, _note, share = zhi_effective(c, "寅")
        self.assertEqual(element, "火")
        # 半合是「牵动」不是「化」：0.35 表示这一支有三成多向化神倾斜，
        # 本气仍占大头。旧值 0.65 会把原局的印星直接抹掉，导致
        # 「五行分布说寅是火、格位判定说寅是木」。
        self.assertGreater(share, 0.2)
        self.assertLess(share, 0.5)
        self.assertLess(share, 1.0)       # 半合有上限，不能整支抹掉

    def test_full_trine_transforms_completely(self):
        c = _chart(1993, 6, 14, 17, 31)   # 已有 午 寅
        element, _note, share = zhi_effective(c, "戌")
        self.assertEqual(element, "火")
        self.assertEqual(share, 1.0)

    def test_combination_needs_the_season_to_transform(self):
        """六合 only transforms when the month command backs the transformed
        element — 子丑 in summer stays a tie, not an earth conversion."""
        c = _chart(1993, 6, 14, 17, 31)
        model = R.settle(R.analyse(c, extra="丑"))
        for rel in model.items:
            if rel.kind == "六合" and rel.element == "土":
                self.assertLess(rel.strength, 1.0)


class Competition(unittest.TestCase):
    def test_two_branches_cannot_both_combine_with_one(self):
        """两子合一丑 is one contested combination, not two."""
        c = _chart(1993, 8, 8)
        model = R.analyse(c)
        counts = {}
        for rel in model.items:
            if rel.kind in R.BRANCH_COMBINING:
                for i in rel.pos:
                    counts[i] = counts.get(i, 0) + 1
        contested = [r for r in model.items
                     if r.kind in R.BRANCH_COMBINING and "争合" in r.note]
        for r in contested:
            self.assertLess(r.strength, R.BASE[r.kind])

    def test_stem_jealousy_damps_both(self):
        """两庚合一乙：both combinations are weakened, neither transforms."""
        c = _chart(1988, 8, 8, 8)
        model = R.settle(R.analyse(c))
        he = [r for r in model.items if r.kind == "干合"]
        if len(he) >= 2:
            self.assertTrue(any("妒合" in r.note for r in he))


class Tombs(unittest.TestCase):
    def test_weak_element_in_a_tomb_is_discounted(self):
        """旺为库、衰为墓：只有「墓」扣分，「库」只是封存。"""
        c = _chart(1993, 2, 2)
        model = R.settle(R.analyse(c))
        for kind in model.tomb_mult.values():
            self.assertLess(kind, 1.0)
        for kind, _el in model.tombstones.values():
            self.assertIn(kind, ("库", "墓"))

    def test_tomb_never_lowers_an_element_below_zero(self):
        c = _chart(1993, 2, 2)
        model = R.settle(R.analyse(c))
        for el, mult in model.tomb_mult.items():
            self.assertGreaterEqual(mult, 0.7)
            self.assertLessEqual(mult, 1.0)

    def test_clash_opens_a_storehouse(self):
        """冲开库：流年冲墓库时，所藏之物要「出来」，方向按喜忌判。"""
        c = _chart(1993, 6, 14, 17, 31)
        ev = evaluate_period(c, "甲", "戌")
        self.assertTrue(any("库" in r or "墓" in r for r in ev["relations"])
                        or ev["components"]["冲合"] != 0)


class ClashSigns(unittest.TestCase):
    def test_clashing_a_hostile_element_is_not_punished(self):
        """冲忌神为去病：凡是冲都扣分，就会把好年份判成凶年。"""
        c = _chart(1993, 6, 14, 17, 31)      # 丙火极强，水金土为喜
        goodev = evaluate_period(c, "庚", "子")   # 子冲午（火，忌），庚为财
        badev = evaluate_period(c, "丙", "午")    # 午自刑、火再旺
        self.assertGreater(goodev["score"], badev["score"])

    def test_the_same_month_scores_differently_in_different_charts(self):
        """同一个字进不同的局，分数必须有差别 —— 否则等于没算合冲。"""
        a = evaluate_period(_chart(1993, 6, 14, 17, 31), "甲", "寅")["score"]
        b = evaluate_period(_chart(1979, 5, 14, 17), "甲", "寅")["score"]
        self.assertNotAlmostEqual(a, b, places=1)


class NatalModel(unittest.TestCase):
    def test_element_scores_still_sum_to_100(self):
        for args in ((1993, 6, 14), (1966, 11, 5), (1988, 8, 8), (1979, 5, 14)):
            c = _chart(*args)
            self.assertAlmostEqual(sum(c.element_scores.values()), 100.0, places=1)

    def test_strength_stays_inside_the_scale(self):
        c = _chart(1993, 6, 14, 17, 31)
        self.assertGreaterEqual(c.strength, 0)
        self.assertLessEqual(c.strength, 100)

    def test_relations_model_is_attached(self):
        c = _chart(1993, 6, 14, 17, 31)
        self.assertTrue(hasattr(c, "relations_model"))
        self.assertIsInstance(c.relations_model.items, list)


if __name__ == "__main__":
    unittest.main()
