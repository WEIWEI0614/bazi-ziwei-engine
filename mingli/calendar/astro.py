"""Astronomical core: Julian Day, Delta-T, nutation, apparent solar longitude,
lunar phases and solar terms.

No third-party dependencies. Algorithms follow Jean Meeus, *Astronomical
Algorithms* (2nd ed.), chapters 7 (JD), 22 (nutation), 25 (solar coordinates),
49 (lunar phases), and the truncated VSOP87 series for the Earth.

Accuracy targets (validated in tests/ against `lunar_python` and `sxtwl`):

  * apparent solar longitude : ~0.3 arcsec  -> solar terms within ~10 s
  * new moon instants        : ~30 s
  * therefore 节气 / 农历 boundary decisions are correct for any birth
    moment that is not within ~30 s of a boundary.
"""

from __future__ import annotations

import math

D2R = math.pi / 180.0
R2D = 180.0 / math.pi

# --------------------------------------------------------------------------
# Julian Day
# --------------------------------------------------------------------------


def to_jd(year: int, month: int, day: int, hour: int = 0, minute: int = 0,
          second: float = 0.0) -> float:
    """Gregorian calendar -> Julian Day (fractional)."""
    y, m = year, month
    if m <= 2:
        y -= 1
        m += 12
    a = y // 100
    b = 2 - a + a // 4
    jd = (math.floor(365.25 * (y + 4716)) + math.floor(30.6001 * (m + 1))
          + day + b - 1524.5)
    return jd + (hour + minute / 60.0 + second / 3600.0) / 24.0


def from_jd(jd: float) -> tuple[int, int, int, int, int, float]:
    """Julian Day -> Gregorian (year, month, day, hour, minute, second)."""
    jd = jd + 0.5
    z = math.floor(jd)
    f = jd - z
    if z < 2299161:
        a = z
    else:
        alpha = math.floor((z - 1867216.25) / 36524.25)
        a = z + 1 + alpha - math.floor(alpha / 4)
    b = a + 1524
    c = math.floor((b - 122.1) / 365.25)
    d = math.floor(365.25 * c)
    e = math.floor((b - d) / 30.6001)
    day_f = b - d - math.floor(30.6001 * e) + f
    day = int(math.floor(day_f))
    frac = day_f - day
    month = e - 1 if e < 14 else e - 13
    year = c - 4716 if month > 2 else c - 4715
    total = frac * 24.0
    hour = int(total)
    minute = int((total - hour) * 60)
    second = ((total - hour) * 60 - minute) * 60
    return year, month, day, hour, minute, second


# --------------------------------------------------------------------------
# Delta-T  (TT - UT, in seconds)  -- Espenak & Meeus polynomial set
# --------------------------------------------------------------------------


def delta_t(year: float) -> float:
    y = year
    if y < 1600:
        u = (y - 1820) / 100.0
        return -20.0 + 32.0 * u * u
    if y < 1700:
        t = y - 1600
        return 120.0 - 0.9808 * t - 0.01532 * t * t + t ** 3 / 7129.0
    if y < 1800:
        t = y - 1700
        return 8.83 + 0.1603 * t - 0.0059285 * t ** 2 + 0.00013336 * t ** 3 - t ** 4 / 1174000.0
    if y < 1860:
        t = y - 1800
        return (13.72 - 0.332447 * t + 0.0068612 * t ** 2 + 0.0041116 * t ** 3
                - 0.00037436 * t ** 4 + 0.0000121272 * t ** 5
                - 0.0000001699 * t ** 6 + 0.000000000875 * t ** 7)
    if y < 1900:
        t = y - 1860
        return (7.62 + 0.5737 * t - 0.251754 * t ** 2 + 0.01680668 * t ** 3
                - 0.0004473624 * t ** 4 + t ** 5 / 233174.0)
    if y < 1920:
        t = y - 1900
        return -2.79 + 1.494119 * t - 0.0598939 * t ** 2 + 0.0061966 * t ** 3 - 0.000197 * t ** 4
    if y < 1941:
        t = y - 1920
        return 21.20 + 0.84493 * t - 0.076100 * t ** 2 + 0.0020936 * t ** 3
    if y < 1961:
        t = y - 1950
        return 29.07 + 0.407 * t - t ** 2 / 233.0 + t ** 3 / 2547.0
    if y < 1986:
        t = y - 1975
        return 45.45 + 1.067 * t - t ** 2 / 260.0 - t ** 3 / 718.0
    if y < 2005:
        t = y - 2000
        return (63.86 + 0.3345 * t - 0.060374 * t ** 2 + 0.0017275 * t ** 3
                + 0.000651814 * t ** 4 + 0.00002373599 * t ** 5)
    if y < 2050:
        t = y - 2000
        return 62.92 + 0.32217 * t + 0.005589 * t ** 2
    if y < 2150:
        return -20.0 + 32.0 * ((y - 1820) / 100.0) ** 2 - 0.5628 * (2150.0 - y)
    u = (y - 1820) / 100.0
    return -20.0 + 32.0 * u * u


# --------------------------------------------------------------------------
# Nutation (Meeus ch.22, low precision: < 0.5")
# --------------------------------------------------------------------------


def nutation(T: float) -> tuple[float, float]:
    """Return (delta_psi, delta_eps) in arcseconds. T in Julian centuries TDB."""
    omega = (125.04452 - 1934.136261 * T) * D2R
    l_sun = (280.4665 + 36000.7698 * T) * D2R
    l_moon = (218.3165 + 481267.8813 * T) * D2R
    dpsi = (-17.20 * math.sin(omega) - 1.32 * math.sin(2 * l_sun)
            - 0.23 * math.sin(2 * l_moon) + 0.21 * math.sin(2 * omega))
    deps = (9.20 * math.cos(omega) + 0.57 * math.cos(2 * l_sun)
            + 0.10 * math.cos(2 * l_moon) - 0.09 * math.cos(2 * omega))
    return dpsi, deps


# --------------------------------------------------------------------------
# Earth heliocentric longitude / radius (truncated VSOP87, Meeus App. III)
# Terms are (A, B, C) meaning  A * cos(B + C*tau) ,  A in units of 1e-8 rad.
# --------------------------------------------------------------------------

_L0 = [
    (175347046, 0.0, 0.0), (3341656, 4.6692568, 6283.07585),
    (34894, 4.6261, 12566.1517), (3497, 2.7441, 5753.3849),
    (3418, 2.8289, 3.5231), (3136, 3.6277, 77713.7715),
    (2676, 4.4181, 7860.4194), (2343, 6.1352, 3930.2097),
    (1324, 0.7425, 11506.7698), (1273, 2.0371, 529.691),
    (1199, 1.1096, 1577.3435), (990, 5.233, 5884.927),
    (902, 2.045, 26.298), (857, 3.508, 398.149),
    (780, 1.179, 5223.694), (753, 2.533, 5507.553),
    (505, 4.583, 18849.228), (492, 4.205, 775.523),
    (357, 2.92, 0.067), (317, 5.849, 11790.629),
    (284, 1.899, 796.298), (271, 0.315, 10977.079),
    (243, 0.345, 5486.778), (206, 4.806, 2544.314),
    (205, 1.869, 5573.143), (202, 2.458, 6069.777),
    (156, 0.833, 213.299), (132, 3.411, 2942.463),
    (126, 1.083, 20.775), (115, 0.645, 0.98),
    (103, 0.636, 4694.003), (102, 0.976, 15720.839),
    (102, 4.267, 7.114), (99, 6.21, 2146.17),
    (98, 0.68, 155.42), (86, 5.98, 161000.69),
    (85, 1.3, 6275.96), (85, 3.67, 71430.7),
    (80, 1.81, 17260.15), (79, 3.04, 12036.46),
    (75, 1.76, 5088.63), (74, 3.5, 3154.69),
    (74, 4.68, 801.82), (70, 0.83, 9437.76),
    (62, 3.98, 8827.39), (61, 1.82, 7084.9),
    (57, 2.78, 6286.6), (56, 4.39, 14143.5),
    (56, 3.47, 6279.55), (52, 0.19, 12139.55),
    (52, 1.33, 1748.02), (51, 0.28, 5856.48),
    (49, 0.49, 1194.45), (41, 5.37, 8429.24),
    (41, 2.4, 19651.05), (39, 6.17, 10447.39),
    (37, 6.04, 10213.29), (37, 2.57, 1059.38),
    (36, 1.71, 2352.87), (36, 1.78, 6812.77),
    (33, 0.59, 17789.85), (30, 0.44, 83996.85),
    (30, 2.74, 1349.87), (25, 3.16, 4690.48),
]

_L1 = [
    (628331966747, 0.0, 0.0), (206059, 2.678235, 6283.07585),
    (4303, 2.6351, 12566.1517), (425, 1.59, 3.523),
    (119, 5.796, 26.298), (109, 2.966, 1577.344),
    (93, 2.59, 18849.23), (72, 1.14, 529.69),
    (68, 1.87, 398.15), (67, 4.41, 5507.55),
    (59, 2.89, 5223.69), (56, 2.17, 155.42),
    (45, 0.4, 796.3), (36, 0.47, 775.52),
    (29, 2.65, 7.11), (21, 5.34, 0.98),
    (19, 1.85, 5486.78), (19, 4.97, 213.3),
    (17, 2.99, 6275.96), (16, 0.03, 2544.31),
    (16, 1.43, 2146.17), (15, 1.21, 10977.08),
    (12, 2.83, 1748.02), (12, 3.26, 5088.63),
    (12, 5.27, 1194.45), (12, 2.08, 4694.0),
    (11, 0.77, 553.57), (10, 1.3, 6286.6),
    (10, 4.24, 1349.87), (9, 2.7, 242.73),
    (9, 5.64, 951.72), (8, 5.3, 2352.87),
    (6, 2.65, 9437.76), (6, 4.67, 4690.48),
]

_L2 = [
    (52919, 0.0, 0.0), (8720, 1.0721, 6283.0758),
    (309, 0.867, 12566.152), (27, 0.05, 3.52),
    (16, 5.19, 26.3), (16, 3.68, 155.42),
    (10, 0.76, 18849.23), (9, 2.06, 77713.77),
    (7, 0.83, 775.52), (5, 4.66, 1577.34),
    (4, 1.03, 7.11), (4, 3.44, 5573.14),
    (3, 5.14, 796.3),
]

_L3 = [
    (289, 5.844, 6283.076), (35, 0.0, 0.0),
    (17, 5.49, 12566.15), (3, 5.2, 155.42),
    (1, 4.72, 3.52), (1, 5.3, 18849.23),
    (1, 5.97, 242.73),
]

_L4 = [(114, 3.142, 0.0), (8, 4.13, 6283.08), (1, 3.84, 12566.15)]
_L5 = [(1, 3.14, 0.0)]

_R0 = [
    (100013989, 0.0, 0.0), (1670700, 3.0984635, 6283.07585),
    (13956, 3.05525, 12566.1517), (3084, 5.1985, 77713.7715),
    (1628, 1.1739, 5753.3849), (1576, 2.8469, 7860.4194),
    (925, 5.453, 11506.77), (542, 4.564, 3930.21),
    (472, 3.661, 5884.927), (346, 0.964, 5507.553),
    (329, 5.9, 5223.694), (307, 0.299, 5573.143),
    (291, 4.273, 11790.629), (251, 5.847, 1577.344),
    (229, 5.022, 10977.079), (226, 0.275, 18849.228),
    (224, 5.14, 5486.778),
]
_R1 = [(103019, 1.10749, 6283.07585), (1721, 1.0644, 12566.1517)]
_R2 = [(4359, 5.7846, 6283.0758)]


def _series(terms, tau: float) -> float:
    return sum(a * math.cos(b + c * tau) for a, b, c in terms)


def earth_longitude_deg(T: float) -> float:
    """Earth heliocentric longitude, degrees (VSOP87, truncated)."""
    tau = T / 10.0
    val = (_series(_L0, tau) + _series(_L1, tau) * tau
           + _series(_L2, tau) * tau ** 2 + _series(_L3, tau) * tau ** 3
           + _series(_L4, tau) * tau ** 4 + _series(_L5, tau) * tau ** 5)
    return (val / 1e8) * R2D % 360.0


def earth_radius_au(T: float) -> float:
    tau = T / 10.0
    val = (_series(_R0, tau) + _series(_R1, tau) * tau
           + _series(_R2, tau) * tau ** 2)
    return val / 1e8


def sun_apparent_longitude(jde: float) -> float:
    """Apparent geocentric longitude of the Sun, degrees [0, 360).

    jde is in Terrestrial Time expressed as a Julian Day.
    """
    T = (jde - 2451545.0) / 36525.0
    theta = earth_longitude_deg(T) + 180.0
    # VSOP87 dynamical ecliptic -> FK5
    lam = theta - 0.09033 / 3600.0
    dpsi, _ = nutation(T)
    lam += dpsi / 3600.0
    lam -= 20.4898 / 3600.0 / earth_radius_au(T)
    return lam % 360.0


# --------------------------------------------------------------------------
# Solving for solar terms
# --------------------------------------------------------------------------

# Names ordered by increasing apparent solar longitude, 春分 == 0 deg.
TERM_NAMES = [
    "春分", "清明", "谷雨", "立夏", "小满", "芒种",
    "夏至", "小暑", "大暑", "立秋", "处暑", "白露",
    "秋分", "寒露", "霜降", "立冬", "小雪", "大雪",
    "冬至", "小寒", "大寒", "立春", "雨水", "惊蛰",
]
TERM_INDEX = {n: i for i, n in enumerate(TERM_NAMES)}

# The 12 節 (month boundaries) : 立春 starts 寅月.
JIE_NAMES = ["立春", "惊蛰", "清明", "立夏", "芒种", "小暑",
             "立秋", "白露", "寒露", "立冬", "大雪", "小寒"]
# The 12 中氣 (used for leap-month rule)
ZHONGQI_NAMES = ["雨水", "春分", "谷雨", "小满", "夏至", "大暑",
                 "处暑", "秋分", "霜降", "小雪", "冬至", "大寒"]


def _solve_longitude(target_deg: float, jd_guess: float) -> float:
    """Newton iteration: find jde such that apparent longitude == target."""
    jd = jd_guess
    for _ in range(14):
        lon = sun_apparent_longitude(jd)
        diff = ((lon - target_deg + 180.0) % 360.0) - 180.0
        if abs(diff) < 1e-8:
            break
        jd -= diff / 0.9856473
    return jd


def term_jde(year: int, name: str) -> float:
    """Julian Day in TT of a named solar term inside Gregorian `year`.

    `year` is the Gregorian year in which the term's *date* falls.
    """
    idx = TERM_INDEX[name]
    lon = idx * 15.0
    # rough day-of-year for a given longitude (Spring equinox ~ Mar 20)
    doy = (79 + (lon / 360.0) * 365.2422) % 365.2422
    guess = to_jd(year, 1, 1) + doy
    # resolve the year ambiguity by re-checking the resulting date
    jde = _solve_longitude(lon, guess)
    gy = from_jd(jde - delta_t(year) / 86400.0)[0]
    if gy != year:
        jde = _solve_longitude(lon, guess + 365.2422 * (year - gy))
    return jde


def term_local(year: int, name: str) -> float:
    """Julian Day (UT-based, but as a civil-JD) of a solar term in Beijing
    civil time (UTC+8)."""
    jde = term_jde(year, name)
    ut = jde - delta_t(year) / 86400.0
    return ut + 8.0 / 24.0


def term_datetime(year: int, name: str) -> tuple[int, int, int, int, int, float]:
    """Solar term as Beijing civil datetime tuple."""
    return from_jd(term_local(year, name))


def year_terms(year: int) -> dict[str, float]:
    """All 24 terms whose civil date falls in `year`, as civil JD (UTC+8)."""
    return {n: term_local(year, n) for n in TERM_NAMES}


# --------------------------------------------------------------------------
# Lunar phases (Meeus ch.49)
# --------------------------------------------------------------------------


def _new_moon_jde(k: float) -> float:
    """JDE of the k-th new moon (k=0 -> 2000 Jan 6)."""
    T = k / 1236.85
    jde = (2451550.09766 + 29.530588861 * k + 0.00015437 * T ** 2
           - 0.000000150 * T ** 3 + 0.00000000073 * T ** 4)
    E = 1.0 - 0.002516 * T - 0.0000074 * T ** 2
    M = (2.5534 + 29.10535670 * k - 0.0000014 * T ** 2 - 0.00000011 * T ** 3) * D2R
    Mp = (201.5643 + 385.81693528 * k + 0.0107582 * T ** 2
          + 0.00001238 * T ** 3 - 0.000000058 * T ** 4) * D2R
    F = (160.7108 + 390.67050284 * k - 0.0016118 * T ** 2
         - 0.00000227 * T ** 3 + 0.000000011 * T ** 4) * D2R
    Om = (124.7746 - 1.56375588 * k + 0.0020672 * T ** 2 + 0.00000215 * T ** 3) * D2R
    s = math.sin
    corr = (-0.40720 * s(Mp) + 0.17241 * E * s(M) + 0.01608 * s(2 * Mp)
            + 0.01039 * s(2 * F) + 0.00739 * E * s(Mp - M) - 0.00514 * E * s(Mp + M)
            + 0.00208 * E * E * s(2 * M) - 0.00111 * s(Mp - 2 * F)
            - 0.00057 * s(Mp + 2 * F) + 0.00056 * E * s(2 * Mp + M)
            - 0.00042 * s(3 * Mp) + 0.00042 * E * s(M + 2 * F)
            + 0.00038 * E * s(M - 2 * F) - 0.00024 * E * s(2 * Mp - M)
            - 0.00017 * s(Om) - 0.00007 * s(Mp + 2 * M)
            + 0.00004 * s(2 * Mp - 2 * F) + 0.00004 * s(3 * M)
            + 0.00003 * s(Mp + M - 2 * F) + 0.00003 * s(2 * Mp + 2 * F)
            - 0.00003 * s(Mp + M + 2 * F) + 0.00003 * s(Mp - M + 2 * F)
            - 0.00002 * s(Mp - M - 2 * F) - 0.00002 * s(3 * Mp + M)
            + 0.00002 * s(4 * Mp))
    # additional planetary corrections (dominant terms only)
    A1 = (299.77 + 0.107408 * k - 0.009173 * T ** 2) * D2R
    A2 = (251.88 + 0.016321 * k) * D2R
    A3 = (251.83 + 26.651886 * k) * D2R
    A4 = (349.42 + 36.412478 * k) * D2R
    A5 = (84.66 + 18.206239 * k) * D2R
    A6 = (141.74 + 53.303771 * k) * D2R
    A7 = (207.14 + 2.453732 * k) * D2R
    A8 = (154.84 + 7.306860 * k) * D2R
    extra = (0.000325 * s(A1) + 0.000165 * s(A2) + 0.000164 * s(A3)
             + 0.000126 * s(A4) + 0.000110 * s(A5) + 0.000062 * s(A6)
             + 0.000060 * s(A7) + 0.000056 * s(A8))
    return jde + corr + extra


def new_moon_local(k: float) -> float:
    """New moon instant as civil JD (UTC+8)."""
    jde = _new_moon_jde(k)
    approx_year = from_jd(jde)[0]
    return jde - delta_t(approx_year) / 86400.0 + 8.0 / 24.0


def k_estimate(jd: float) -> float:
    """Approximate lunation number for a civil JD."""
    return (jd - 2451550.09766) / 29.530588861


# --------------------------------------------------------------------------
# Timezone / true solar time
# --------------------------------------------------------------------------


def equation_of_time_minutes(jd_ut: float) -> float:
    """Apparent minus mean solar time, in minutes."""
    jde = jd_ut + delta_t(from_jd(jd_ut)[0]) / 86400.0
    T = (jde - 2451545.0) / 36525.0
    lam = sun_apparent_longitude(jde)
    # right ascension of the sun
    eps = (23.0 + 26.0 / 60 + 21.448 / 3600
           - (46.8150 * T + 0.00059 * T ** 2 - 0.001813 * T ** 3) / 3600.0)
    lam_r = lam * D2R
    eps_r = eps * D2R
    alpha = math.atan2(math.cos(eps_r) * math.sin(lam_r), math.cos(lam_r)) * R2D
    alpha %= 360.0
    # mean longitude of the sun
    L0 = (280.46646 + 36000.76983 * T + 0.0003032 * T ** 2) % 360.0
    e = L0 - 0.0057183 - alpha
    e = ((e + 180.0) % 360.0) - 180.0
    return e * 4.0
