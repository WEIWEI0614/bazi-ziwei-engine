"""Chinese lunisolar calendar built from first principles.

A 歲 (sui) runs from the 十一月 that contains the winter solstice to the next
one.  It holds 12 or 13 lunar months; when it holds 13, the first month with no
中氣 becomes a leap month repeating the previous number (置閏法).
"""

from __future__ import annotations

import functools

from . import astro
from .ganzhi import GAN, ZHI

# ---- day pillar -----------------------------------------------------------
# Calibrated against 1900-01-01 == 甲戌 (see tests/test_calendar.py).
_DAY_OFFSET = 49


def day_ganzhi_index(jd_civil: float) -> int:
    """0..59 index of the day pillar for a civil JD (day changes at 00:00)."""
    return (int(jd_civil + 0.5) + _DAY_OFFSET) % 60


class LunarDate:
    """A point in the Chinese lunisolar calendar."""

    __slots__ = ("year", "month", "day", "is_leap", "month_days",
                 "year_days", "leap_month", "month_start")

    def __init__(self, year, month, day, is_leap, month_days, year_days,
                 leap_month, month_start=0.0):
        self.year = year
        self.month = month
        self.day = day
        self.is_leap = is_leap
        self.month_days = month_days
        self.year_days = year_days
        self.leap_month = leap_month
        self.month_start = month_start

    def __repr__(self):
        tag = f"-{self.month}" if self.is_leap else f"{self.month}"
        return f"LunarDate({self.year}, {tag}, {self.day})"


@functools.lru_cache(maxsize=4096)
def term_day(year: int, name: str) -> int:
    """Civil day number of a solar term (Beijing time)."""
    return _day_num(astro.term_local(year, name))


def _last_new_moon_before(jd: float) -> tuple[int, float]:
    """Index and civil day-number of the latest 朔 whose *day* <= `jd`'s day.

    Days are compared, not instants: a 朔 that occurs later on the same civil
    day still opens that day's month (国标 GB/T 33661-2017 口径).
    """
    target = _day_num(jd)
    k = int(astro.k_estimate(jd))
    while _day_num(astro.new_moon_local(k)) > target:
        k -= 1
    while _day_num(astro.new_moon_local(k + 1)) <= target:
        k += 1
    return k, astro.new_moon_local(k)


def _day_num(t: float) -> int:
    """Civil day number (integer) of a civil-JD instant."""
    return int(t + 0.5)


def _day_start(day_num: int) -> float:
    """Civil JD of 00:00 on that civil day."""
    return day_num - 0.5


@functools.lru_cache(maxsize=1024)
def sui_start(year_of_solstice: int) -> float:
    """Civil JD of 00:00 on the 朔 day opening the 歲 that holds 冬至 of `Y`."""
    ws = astro.term_local(year_of_solstice, "冬至")
    return _day_start(_day_num(_last_new_moon_before(ws)[1]))


@functools.lru_cache(maxsize=512)
def _sui(year_of_solstice: int):
    """(starts, zhongqi) for one 歲.  starts[-1] is the next 歲's opening 朔."""
    Y = year_of_solstice
    k1, _ = _last_new_moon_before(astro.term_local(Y, "冬至"))
    k2, _ = _last_new_moon_before(astro.term_local(Y + 1, "冬至"))
    starts = tuple(_day_num(astro.new_moon_local(k)) for k in range(k1, k2 + 1))
    zq = []
    for yy in (Y, Y + 1):
        for name in astro.ZHONGQI_NAMES:
            t = term_day(yy, name)
            if starts[0] <= t < starts[-1]:
                zq.append(t)
    zq.sort()
    return starts, tuple(zq)


def _number_months(starts, zq):
    """Assign (is_leap, number) to every month in a 歲."""
    n = len(starts) - 1
    has_zq = [any(starts[i] <= t < starts[i + 1] for t in zq) for i in range(n)]
    nums = []
    num, prev, leap_used = 11, 11, False
    for i in range(n):
        if n == 13 and not leap_used and i > 0 and not has_zq[i]:
            nums.append((True, prev))
            leap_used = True
        else:
            nums.append((False, num))
            prev = num
            num = 1 if num == 12 else num + 1
    return nums, has_zq


def sui_of_jd(jd: float) -> int:
    """Gregorian year of the winter solstice that opens the 歲 holding `jd`."""
    Y = astro.from_jd(jd)[0]
    while sui_start(Y) > jd:
        Y -= 1
    while sui_start(Y + 1) <= jd:
        Y += 1
    return Y


def lunar_from_jd(jd: float) -> LunarDate:
    """Civil JD (UTC+8) -> LunarDate."""
    Y = sui_of_jd(jd)
    starts, zq = _sui(Y)
    nums, _ = _number_months(starts, zq)
    n = len(starts) - 1
    idx_zheng = next((j for j in range(n)
                      if not nums[j][0] and nums[j][1] == 1), None)

    def _year_len_from(j):
        if j is None:
            return 0
        total, k = 0, j
        while True:
            total += starts[k + 1] - starts[k]
            k += 1
            if k >= n or (not nums[k][0] and nums[k][1] == 1):
                break
        return total

    day_i = int(jd + 0.5)
    for i in range(n):
        if starts[i] <= day_i < starts[i + 1]:
            is_leap, mnum = nums[i]
            lday = day_i - starts[i] + 1
            mdays = starts[i + 1] - starts[i]
            leap_month = next((mn for lp, mn in nums if lp), 0)
            if mnum >= 11:
                nyear = Y
                ylen = _year_len_from(idx_zheng)
                # 十一月/十二月 closing the previous lunar year
                head = sum(starts[j + 1] - starts[j]
                           for j in range(0, idx_zheng or 0))
                if head:
                    ylen = head
            else:
                nyear = Y + 1
                ylen = _year_len_from(idx_zheng)
            return LunarDate(nyear, mnum, lday, is_leap, mdays, ylen,
                             leap_month, _day_start(starts[i]))
    raise AssertionError("unreachable")


def lunar_to_jd(year: int, month: int, day: int, is_leap: bool = False) -> float:
    """Lunar date -> civil JD at local noon of that lunar day."""
    for Y in (year - 1, year, year + 1):
        starts, zq = _sui(Y)
        nums, _ = _number_months(starts, zq)
        for i, (lp, mn) in enumerate(nums):
            if lp == is_leap and mn == month:
                nyear = Y if (mn >= 11) else Y + 1
                if nyear == year:
                    return _day_start(starts[i] + day - 1)
    raise ValueError(f"lunar date not found: {year}-{month}-{day} leap={is_leap}")


# ---- pillars --------------------------------------------------------------


def year_pillar(jd: float) -> tuple[str, str, int]:
    """Year pillar using 立春 as the year boundary. Returns (gan, zhi, year)."""
    gy = astro.from_jd(jd)[0]
    sy = gy - 1 if jd < astro.term_local(gy, "立春") else gy
    idx = (sy - 4) % 60
    return GAN[idx % 10], ZHI[idx % 12], sy


_JIE_TO_ZHI = {
    "立春": "寅", "惊蛰": "卯", "清明": "辰", "立夏": "巳",
    "芒种": "午", "小暑": "未", "立秋": "申", "白露": "酉",
    "寒露": "戌", "立冬": "亥", "大雪": "子", "小寒": "丑",
}


def month_pillar(jd: float, year_gan: str) -> tuple[str, str, str]:
    """Month pillar using the 12 節 as boundaries. Returns (gan, zhi, jie)."""
    gy = astro.from_jd(jd)[0]
    marks = []
    for yy in (gy - 1, gy, gy + 1):
        for name in astro.JIE_NAMES:
            marks.append((astro.term_local(yy, name), name))
    marks.sort()
    cur = marks[0]
    for t, name in marks:
        if t <= jd:
            cur = (t, name)
        else:
            break
    jie = cur[1]
    zhi = _JIE_TO_ZHI[jie]
    yg = GAN.index(year_gan)
    # 五虎遁: stem index of the 寅 month
    first = {0: 2, 5: 2, 1: 4, 6: 4, 2: 6, 7: 6, 3: 8, 8: 8, 4: 0, 9: 0}[yg]
    gan = GAN[(first + (ZHI.index(zhi) - 2) % 12) % 10]
    return gan, zhi, jie


def day_pillar(jd: float, zi_boundary: str = "zi_start") -> tuple[str, str]:
    """Day pillar.

    zi_boundary:
      'zi_start' - day changes at 23:00 (子初換日, traditional)
      'zi_mid'   - day changes at 00:00 (子正換日, almanac default)
    """
    if zi_boundary == "zi_start":
        frac_of_day = jd + 0.5 - int(jd + 0.5)   # 0.0 = midnight
        if frac_of_day >= 23.0 / 24.0:
            jd += 1
    idx = day_ganzhi_index(jd)
    return GAN[idx % 10], ZHI[idx % 12]


def hour_pillar(day_gan: str, hour_branch: str) -> str:
    """五鼠遁: stem of the hour pillar."""
    dg = GAN.index(day_gan)
    first = {0: 0, 5: 0, 1: 2, 6: 2, 2: 4, 7: 4, 3: 6, 8: 6, 4: 8, 9: 8}[dg]
    return GAN[(first + ZHI.index(hour_branch)) % 10]


def hour_branch_of(clock_hour: float) -> str:
    """Branch of a true-solar hour (0..24). 子時 runs 23:00-01:00."""
    return ZHI[int(((clock_hour + 1) % 24) // 2)]
