"""Calendar, pillar and Zi Wei regression tests.

Reference values were produced independently by `lunar_python` (a port of
6tail's lunar-javascript) and `iztro` (the most widely used Zi Wei library),
never by this package.  Run with:

    python -m unittest discover -s tests -v

No third-party dependencies are needed for the core tests.
"""

from __future__ import annotations

import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from mingli.bazi.chart import build_chart  # noqa: E402
from mingli.calendar import astro, lunar  # noqa: E402
from mingli.ziwei.chart import build_ziwei  # noqa: E402


class TestSolarTerms(unittest.TestCase):
    """Solar terms must land on the same *minute* as the reference."""

    CASES = [
        (2023, "冬至", (2023, 12, 22, 11, 27)),
        (2024, "立春", (2024, 2, 4, 16, 27)),
        (2025, "立春", (2025, 2, 3, 22, 10)),
        (2025, "冬至", (2025, 12, 21, 23, 3)),
        (2026, "立春", (2026, 2, 4, 4, 2)),
        (2000, "立春", (2000, 2, 4, 20, 40)),
        (1950, "立春", (1950, 2, 4, 17, 20)),
        (1900, "立春", (1900, 2, 4, 13, 51)),
    ]

    def test_terms(self):
        for year, name, expected in self.CASES:
            got = astro.term_datetime(year, name)
            with self.subTest(year=year, term=name):
                self.assertEqual(got[:3], expected[:3],
                                 f"{year} {name} date: {got} != {expected}")
                # minute agreement, allowing the reference's truncation
                self.assertLessEqual(
                    abs((got[3] * 60 + got[4]) - (expected[3] * 60 + expected[4])),
                    1, f"{year} {name} time: {got} != {expected}")

    def test_term_ordering(self):
        # within one Gregorian year the 24 terms are monotonically increasing
        # except 小寒/大寒/立春/雨水/惊蛰 which all fall in Jan-Mar as well
        vals = [astro.term_local(2025, n) for n in
                ["小寒", "大寒", "立春", "雨水", "惊蛰", "春分", "清明",
                 "谷雨", "立夏", "小满", "芒种", "夏至", "小暑", "大暑",
                 "立秋", "处暑", "白露", "秋分", "寒露", "霜降", "立冬",
                 "小雪", "大雪", "冬至"]]
        for a, b in zip(vals, vals[1:]):
            self.assertLess(a, b)


class TestLunar(unittest.TestCase):
    def test_day_pillar_anchor(self):
        # 1900-01-01 is 甲戌 (reference: lunar-python)
        jd = astro.to_jd(1900, 1, 1, 12)
        self.assertEqual(lunar.day_pillar(jd, "zi_mid"), ("甲", "戌"))

    def test_spring_festival(self):
        cases = [(1900, (1900, 1, 31)), (1949, (1949, 1, 29)),
                 (2000, (2000, 2, 5)), (2020, (2020, 1, 25)),
                 (2024, (2024, 2, 10)), (2025, (2025, 1, 29)),
                 (2026, (2026, 2, 17)), (2033, (2033, 1, 31))]
        for ly, (y, m, d) in cases:
            jd = lunar.lunar_to_jd(ly, 1, 1)
            got = astro.from_jd(jd)
            with self.subTest(year=ly):
                self.assertEqual(got[:3], (y, m, d))

    def test_leap_months(self):
        # (lunar year, leap month, first day of that leap month)
        cases = [(2025, 6, (2025, 7, 25)), (2023, 2, (2023, 3, 22)),
                 (2020, 4, (2020, 5, 23)), (2017, 6, (2017, 7, 23))]
        for ly, lm, expected in cases:
            jd = lunar.lunar_to_jd(ly, lm, 1, is_leap=True)
            got = astro.from_jd(jd)[:3]
            with self.subTest(year=ly, leap=lm):
                self.assertEqual(got, expected)

    def test_roundtrip(self):
        for y in (1902, 1955, 1993, 2012, 2024, 2049, 2098):
            for m in (1, 6, 12):
                jd = astro.to_jd(y, m, 15, 12)
                ld = lunar.lunar_from_jd(jd)
                back = lunar.lunar_to_jd(ld.year, ld.month, ld.day, ld.is_leap)
                self.assertEqual(int(back + 0.5), int(jd + 0.5),
                                 f"{y}-{m}-15 roundtrip")

    def test_lunar_month_days(self):
        for y in (1993, 2024, 2025):
            jd = astro.to_jd(y, 6, 1)
            ld = lunar.lunar_from_jd(jd)
            self.assertIn(ld.month_days, (29, 30))
            self.assertIn(ld.day, range(1, 31))


class TestPillars(unittest.TestCase):
    def test_known_chart(self):
        c = build_chart("t", "male", 1993, 6, 14, 17, 31,
                        longitude=116.40, use_true_solar=False)
        self.assertEqual(c.four(), "癸酉 戊午 丙寅 丁酉")
        self.assertEqual(c.day_master, "丙")

    def test_lichun_boundary(self):
        before = build_chart("t", "male", 2024, 2, 4, 16, 0, use_true_solar=False)
        after = build_chart("t", "male", 2024, 2, 4, 17, 0, use_true_solar=False)
        self.assertEqual(before.year.gan + before.year.zhi, "癸卯")
        self.assertEqual(after.year.gan + after.year.zhi, "甲辰")

    def test_jie_boundary(self):
        # 清明 2024 = 2024-04-04 15:02 -> month turns from 丁卯 to 戊辰
        before = build_chart("t", "male", 2024, 4, 4, 14, 0, use_true_solar=False)
        after = build_chart("t", "male", 2024, 4, 4, 16, 0, use_true_solar=False)
        self.assertEqual(before.month.zhi, "卯")
        self.assertEqual(after.month.zhi, "辰")

    def test_zi_boundary(self):
        # 23:30 belongs to the next day pillar under 子初換日
        late = build_chart("t", "male", 2000, 1, 1, 23, 30,
                           use_true_solar=False, zi_boundary="zi_start")
        nxt = build_chart("t", "male", 2000, 1, 2, 12, 0, use_true_solar=False)
        self.assertEqual(late.day.gan + late.day.zhi, nxt.day.gan + nxt.day.zhi)

    def test_true_solar_shift(self):
        c = build_chart("t", "male", 1993, 6, 14, 17, 31,
                        longitude=116.65, use_true_solar=True)
        # Beijing 116.65E is ~13 min behind 120E, plus equation of time
        self.assertLess(c.true_solar, c.birth_local)

    def test_decade_direction(self):
        # 癸 is a yin stem: yin male runs backwards
        c = build_chart("t", "male", 1993, 6, 14, 17, 31, use_true_solar=False)
        from mingli.bazi import luck
        self.assertEqual(luck.luck_direction(c), -1)


class TestZiwei(unittest.TestCase):
    """Reference: iztro 2.x, astro.bySolar('1993-6-14', 9, '男', true)."""

    REF = {
        "ju": "木三局", "ming": "申", "ziwei": "子",
        "palaces": {
            "寅": ["破军"], "卯": [], "辰": ["廉贞", "天府"], "巳": ["太阴"],
            "午": ["贪狼"], "未": ["天同", "巨门"], "申": ["武曲", "天相"],
            "酉": ["太阳", "天梁"], "戌": ["七杀"], "亥": ["天机"],
            "子": ["紫微"], "丑": [],
        },
    }

    def test_reference_chart(self):
        z = build_ziwei("t", "male", 1993, 6, 14, 18, 0, use_true_solar=False)
        self.assertEqual(z.ming_branch, self.REF["ming"])
        self.assertEqual(z.ju, self.REF["ju"])
        self.assertEqual(z.ziwei_branch, self.REF["ziwei"])
        for p in z.palaces:
            got = sorted(s.name for s in p.stars if s.kind == "主星")
            self.assertEqual(got, sorted(self.REF["palaces"][p.branch]),
                             f"{p.branch} palace")

    def test_aux_stars(self):
        z = build_ziwei("t", "male", 1993, 6, 14, 18, 0, use_true_solar=False)
        expect = {"寅": {"地空"}, "卯": {"天魁"}, "巳": {"天钺"},
                  "未": {"左辅", "右弼", "铃星"}, "申": {"地劫"},
                  "亥": {"天马", "陀罗"}, "子": {"禄存", "火星"},
                  "丑": {"文昌", "文曲", "擎羊"}}
        for br, names in expect.items():
            got = {s.name for s in z.by_branch(br).stars
                   if s.kind in ("辅星", "煞星")}
            self.assertEqual(got, names, br)

    def test_adjective_stars(self):
        # verified against iztro: 寅 carries 天月 / 月德, 丑 carries the天伤 group
        z = build_ziwei("t", "male", 1993, 6, 14, 18, 0, use_true_solar=False)
        self.assertEqual({s.name for s in z.by_branch("寅").adj}, {"天月", "月德"})
        self.assertIn("天伤", {s.name for s in z.by_branch("丑").adj})
        self.assertIn("天使", {s.name for s in z.by_branch("卯").adj})

    def test_twelve_gods(self):
        z = build_ziwei("t", "male", 1993, 6, 14, 18, 0, use_true_solar=False)
        br = {p.branch: p for p in z.palaces}
        self.assertEqual(br["亥"].changsheng, "长生")
        self.assertEqual(br["申"].boshi, "将军")
        self.assertEqual(br["酉"].jiangqian, "将星")
        self.assertEqual(br["酉"].suiqian, "岁建")
        self.assertEqual(z.ming_zhu, "廉贞")
        self.assertEqual(z.shen_zhu, "天同")

    def test_ming_index_formula(self):
        # 正月子時 -> 命宮在寅
        z = build_ziwei("t", "male", 2000, 2, 5, 0, 30, use_true_solar=False)
        self.assertEqual(z.lunar_date.month, 1)
        self.assertEqual(z.ming_branch, "寅")

    def test_sihua_schools(self):
        a = build_ziwei("t", "male", 1993, 6, 14, 18, use_true_solar=False)
        b = build_ziwei("t", "male", 1993, 6, 14, 18, use_true_solar=False,
                        sihua_school="feixing")
        # 癸 is identical in both tables; 庚 differs
        self.assertEqual(a.sihua, b.sihua)
        g1 = build_ziwei("t", "male", 1990, 6, 14, 18, use_true_solar=False)
        g2 = build_ziwei("t", "male", 1990, 6, 14, 18, use_true_solar=False,
                         sihua_school="feixing")
        if g1.year_gan == "庚":
            self.assertNotEqual(g1.sihua, g2.sihua)


class TestReading(unittest.TestCase):
    def test_reading_shape(self):
        from mingli.reading import build_reading
        r = build_reading("t", "male", 1993, 6, 14, 17, 31,
                          longitude=116.65, focus_year=2026)
        self.assertGreater(len(r.timeline), 5)
        self.assertEqual(len(r.months), 12)
        self.assertEqual(len(r.cycles), 10)
        self.assertGreaterEqual(r.scores["overall"], 0)
        self.assertLessEqual(r.scores["overall"], 100)
        for d in r.timeline:
            self.assertGreaterEqual(d["score"], 0)
            self.assertLessEqual(d["score"], 100)

    def test_event_calibration(self):
        from mingli.reading import compare_events
        c = build_chart("t", "male", 1993, 6, 14, 17, 31,
                        longitude=116.65, use_true_solar=True)
        ev = [{"year": 2016, "kind": "study", "impact": 2},
              {"year": 2020, "kind": "career", "impact": -1},
              {"year": 2023, "kind": "career", "impact": -2},
              {"year": 2025, "kind": "career", "impact": 1}]
        res = compare_events(c, ev)
        self.assertEqual(res["n"], 4)
        self.assertIn("hit_rate", res)
        self.assertIn("weights", res)


if __name__ == "__main__":
    unittest.main(verbosity=2)
