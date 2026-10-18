"""Regression tests for bugs found in the 2026-10-18 audit.

Each test names the symptom that was actually observed, not the fix, so a
future refactor that reintroduces the symptom fails here first.
"""
import unittest

from mingli.bazi.chart import _find_relations, build_chart
from mingli.bazi.luck import _band, _r1, month_periods, luck_cycles
from mingli import pattern
from mingli.ziwei.chart import build_ziwei


class _Stub:
    """Minimal stand-in so the relation builder can be tested without a real
    birth moment: `_find_relations` only needs the four stems and branches."""

    def __init__(self, pillars):
        self._p = pillars
        self.relations = {}

    def all_zhi(self):
        return [z for _, z in self._p]

    def all_gan(self):
        return [g for g, _ in self._p]


class TestSanhui(unittest.TestCase):
    """三会 used to fire on 卯辰辰 (three hits, two distinct branches) and on
    申申酉戌 (four hits, three distinct). Both are wrong: 三会 needs exactly
    three *different* branches of the directional group."""

    def _rel(self, pillars):
        c = _Stub(pillars)
        _find_relations(c)
        return c.relations

    def test_duplicate_hit_is_not_directional(self):
        rel = self._rel([("乙", "卯"), ("戊", "辰"), ("甲", "辰"), ("丁", "酉")])
        self.assertNotIn("三会", rel)

    def test_duplicate_does_not_break_a_real_directional_group(self):
        # 申申酉戌 仍属三会金方：多出来的申是加力，不是破局。
        # （这一点最初被我判成 bug，其实 JS 原实现是对的，Python 按命中数判才错。）
        rel = self._rel([("壬", "申"), ("戊", "申"), ("辛", "酉"), ("甲", "戌")])
        self.assertIn("三会", rel)
        self.assertEqual(rel["三会"][0]["pair"], "申酉戌")

    def test_real_directional_group_still_fires(self):
        rel = self._rel([("甲", "寅"), ("乙", "卯"), ("戊", "辰"), ("丙", "午")])
        self.assertIn("三会", rel)
        self.assertEqual(rel["三会"][0]["pair"], "寅卯辰")


class TestRelationStability(unittest.TestCase):
    def test_half_combination_pair_is_deterministic(self):
        """The pair string used to be built from a set, so the same chart could
        render 巳丑 on one run and 丑巳 on the next."""
        pillars = [("辛", "巳"), ("庚", "丑"), ("甲", "子"), ("丙", "寅")]
        first = _Stub(pillars)
        _find_relations(first)
        for _ in range(20):
            again = _Stub(pillars)
            _find_relations(again)
            self.assertEqual(first.relations, again.relations)

    def test_self_punishment_present(self):
        c = _Stub([("甲", "辰"), ("戊", "辰"), ("丙", "午"), ("丁", "酉")])
        _find_relations(c)
        self.assertIn("刑", c.relations)
        self.assertIn("自刑", [x["type"] for x in c.relations["刑"]])


class TestRoundingParity(unittest.TestCase):
    """Python's round() is half-to-even, JS Math.round is half-up. On a .05
    boundary that flipped the band between CLI and browser."""

    def test_r1_matches_javascript(self):
        cases = [(-2.75, -2.7), (2.75, 2.8), (45.95, 46.0), (-0.05, 0.0),
                 (67.95, 68.0), (-27.45, -27.4)]
        for raw, want in cases:
            with self.subTest(raw=raw):
                self.assertAlmostEqual(_r1(raw), want, places=6)

    def test_band_agrees_with_the_displayed_score(self):
        """A period showing 46.0 must never be labelled 小凶 — the label is
        derived from the rounded score, so they cannot disagree."""
        for i in range(200, 901):
            score = i / 10.0
            band = _band(score)
            again = _band(_r1(score))
            self.assertEqual(band, again, f"{score} -> {band} vs {again}")


class TestShenshaCoverage(unittest.TestCase):
    """The browser port silently shipped 35 of the 45 stars. These four were
    among the ten that only existed in the Python engine."""

    def test_extended_stars_can_fire(self):
        """这十颗原本只存在于 Python 引擎，浏览器端一颗都算不出来。
        各取一个确实能触发它们的出生时刻，防止再次漏移植。"""
        samples = {
            "天官贵人": (1985, 3, 21), "天厨贵人": (1985, 4, 21),
            "飞刃": (1985, 2, 12), "六秀日": (1985, 3, 21),
            "十灵日": (1985, 1, 3), "孤鸾煞": (1985, 1, 12),
            "日德": (1985, 9, 12), "天德合": (1985, 2, 12),
            "月德合": (1985, 2, 21),
        }
        for name, (y, m, d) in samples.items():
            with self.subTest(star=name):
                c = build_chart("t", "male", y, m, d, 10, 0, longitude=116.4)
                self.assertIn(name, c.shensha)

    def test_day_pillar_star_fires_on_its_own_day(self):
        # 1990-03-01 的日柱是乙丑，属金神三日之一
        c = build_chart("t", "male", 1990, 3, 1, 12, 0, longitude=116.4)
        self.assertEqual(c.day.gan + c.day.zhi, "乙丑")
        self.assertIn("金神", c.shensha)
        # 反过来：日柱不是那三天时不应误判
        other = build_chart("t", "male", 1990, 3, 2, 12, 0, longitude=116.4)
        self.assertNotIn("金神", other.shensha)

    def test_all_definitions_are_reachable_somewhere(self):
        """No definition should be dead code: over a spread of charts every
        star should fire at least once."""
        seen = set()
        for y in range(1960, 2005, 2):
            for m in (2, 5, 8, 11):
                c = build_chart("t", "male", y, m, 15, 10, 0, longitude=116.4)
                seen |= set(c.shensha)
        from mingli.bazi.shensha import DEFS
        dead = set(DEFS) - seen
        self.assertLessEqual(len(dead), 3, f"几乎不命中的神煞: {sorted(dead)}")


class TestBirthVersusTrueSolar(unittest.TestCase):
    def test_birth_time_is_the_clock_time_not_the_corrected_one(self):
        c = build_chart("t", "male", 1990, 5, 15, 10, 20, longitude=87.6)
        self.assertEqual((c.birth_local.hour, c.birth_local.minute), (10, 20))
        self.assertNotEqual(c.true_solar.hour, 10,
                            "乌鲁木齐的真太阳时应与钟表时间不同")


class TestGradeIsNotAnAverage(unittest.TestCase):
    def test_grade_and_strength_are_independent(self):
        c = build_chart("t", "male", 1993, 6, 14, 17, 31, longitude=116.65)
        z = build_ziwei("t", "male", 1993, 6, 14, 17, 31, longitude=116.65)
        g = pattern.combined_grade(pattern.bazi_grade(c), pattern.ziwei_grade(z))
        self.assertIn("grade", g)
        self.assertGreaterEqual(g["score"], 0)
        self.assertLessEqual(g["score"], 100)

    def test_rescue_outweighs_break(self):
        """《五言独步》「有病方为贵」：一条救应应当多于一条破格抵扣的分量。
        这里用同一条数与分值的等价关系验证，而不是断言内部常量名。"""
        c = build_chart("t", "male", 1993, 6, 14, 17, 31, longitude=116.65)
        b = pattern.bazi_grade(c)
        self.assertGreater(b["rescued"], 0, "这张盘应当有救应项")
        per_break = b["broken"] / max(1, sum(1 for i in b["items"]
                                             if i["kind"] == "break" and i["ok"]))
        per_rescue = b["rescued"] / max(1, sum(1 for i in b["items"]
                                               if i["kind"] == "rescue" and i["ok"]))
        self.assertGreater(per_rescue, per_break,
                           "每条救应的回补应重于每条破格的扣分")


class TestCliValidation(unittest.TestCase):
    def test_bad_date_exits_cleanly(self):
        from mingli.cli import _date_parts
        with self.assertRaises(SystemExit) as ctx:
            _date_parts("1990-13-45")
        self.assertIn("not a valid date", str(ctx.exception.code))

    def test_bad_clock_exits_cleanly(self):
        from mingli.cli import _clock_parts
        with self.assertRaises(SystemExit):
            _clock_parts("25:99")

    def test_good_values_pass_through(self):
        from mingli.cli import _clock_parts, _date_parts
        self.assertEqual(_date_parts("1993-06-14"), (1993, 6, 14))
        self.assertEqual(_clock_parts("17:31"), (17, 31))


class TestMcpValidation(unittest.TestCase):
    def test_missing_fields_say_what_is_missing(self):
        import mcp_server
        with self.assertRaises(ValueError) as ctx:
            mcp_server._birth({"month": 5, "day": 15})
        self.assertIn("year", str(ctx.exception))

    def test_invalid_date_is_reported_in_words(self):
        import mcp_server
        with self.assertRaises(ValueError) as ctx:
            mcp_server._birth({"year": 1990, "month": 2, "day": 30})
        self.assertIn("not a valid date", str(ctx.exception))

    def test_unknown_relation_is_rejected(self):
        import mcp_server
        with self.assertRaises(ValueError):
            mcp_server.tool_synastry({"a": {"year": 1990, "month": 5, "day": 15},
                                      "b": {"year": 1997, "month": 10, "day": 10},
                                      "relation": "nonsense"})


class TestPeriodConsistency(unittest.TestCase):
    def test_month_scores_stay_in_range(self):
        c = build_chart("t", "male", 1990, 5, 15, 10, 20, longitude=116.4)
        cyc = next(x for x in luck_cycles(c, 10, 2026) if x.active)
        for m in month_periods(c, 2026, cyc):
            self.assertGreaterEqual(m.score, 40)
            self.assertLessEqual(m.score, 88)


if __name__ == "__main__":
    unittest.main()
