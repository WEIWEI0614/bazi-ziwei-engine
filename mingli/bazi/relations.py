"""Structural interactions — one model, shared by the natal chart and by the
annual / monthly scoring.

Why this module exists
----------------------
Three things were wrong before, and all three had the same shape: an interaction
was treated as a *label* rather than as a change to the elements.

1. **合化 did not change anything.** 寅午戌 was recorded as the sentence
   "三合火局" and charged a flat ±5.5, while the branches kept their own
   elements. So 寅 stayed wood. In a chart that takes fire as 七杀, a fire month
   read as 偏财 — comfortable on paper, oppressive in fact.

2. **墓库 did not exist.** 辰戌丑未 were plain 土. An element that was buried
   with no way out scored the same as an element that was simply absent, and a
   storehouse that could be opened by a clash scored the same as a tomb.

3. **Every clash had one weight.** 冲 is not one thing: what matters is which
   side is weaker, whether the month command is involved, and whether the branch
   being hit is 用神 or 忌神.

The model here is deliberately arithmetic rather than qualitative, because the
rest of the engine needs a number. Where a rule is contested between schools the
choice is written down and the reason is given, so it can be argued with.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from itertools import combinations

from ..calendar.ganzhi import (
    CHONG, GAN, GAN_CHONG, GAN_HE, GAN_WUXING, HAI6, HE6, HE6_ELEMENT, HIDDEN,
    PO, SANHE, SANHUI, SEASON_STATE, SELF_XING, TOMB, XING_FULL, XING_PAIR,
    ZHI, ZHI_WUXING,
)

POSN = ("年", "月", "日", "时")

#: Positional distance. Adjacent pillars act on each other; one apart is
#: noticeably weaker; the two ends of the chart barely meet.
DIST_W = {1: 1.00, 2: 0.72, 3: 0.50}

#: Base strength of each relation kind before season, stems and distance.
#: The ordering 三会 > 三合 > 半合 > 六合 > 刑 > 冲 > 害 > 破 is the one every
#: school agrees on; the absolute numbers are ours.
BASE = {
    "三会": 1.00, "三合": 0.95, "半合": 0.55, "拱合": 0.30, "六合": 0.40,
    "三刑": 0.90, "相刑": 0.50, "自刑": 0.45,
    "六冲": 0.85, "六害": 0.35, "六破": 0.30,
    "干合": 0.45, "干冲": 0.55,
}

COMBINING = {"三会", "三合", "半合", "拱合", "六合", "干合"}
#: 争合只在同类之间比：两支争一合是争，天干合与地支合各走各的路。
BRANCH_COMBINING = {"三会", "三合", "半合", "拱合", "六合"}

#: 合化之后，参与的地支/天干有几分之几真的变成化神。
#:
#: 三会三合三支俱全，整体转化（1.0）——这是「合化」的定义。
#: 但**半合只算牵动，不算化**：寅午两支就断定寅变成了火，会把原局的
#: 印星直接抹掉，于是「五行分布说寅是火、格位判定说寅是木」自相矛盾
#: （丙火午月那张盘，火被算到 81.8%）。传统上地支半合要化，需三支齐
#: 或月令强力支持；半合本身只表示「有向化之意」。这里给 0.35。
#: 拱合无中神，只是「拱」，0.15；六合是一绊，同样 0.35。
SHARE_CAP = {"三会": 1.00, "三合": 1.00, "半合": 0.35,
             "拱合": 0.15, "六合": 0.35, "干合": 0.80}

SEASON_MULT = {"旺": 1.25, "相": 1.12, "休": 0.90, "囚": 0.80, "死": 0.70}

#: A combination only transforms when it has enough support. Full 三会 / 三合
#: always transform (the three branches are simply there); everything else has
#: to earn it through the month command and a transparent stem.
TRANSFORM_AT = 0.55


@dataclass
class Rel:
    """One interaction, with the strength it actually carries."""

    kind: str
    pos: tuple            # position indices; 4 means "the incoming year/month"
    zhis: tuple
    element: str = ""     # transformed element, when the relation has one
    strength: float = 0.0
    transforms: bool = False
    note: str = ""

    @property
    def where(self) -> str:
        return "·".join(POSN[i] if i < 4 else "运" for i in self.pos)

    @property
    def label(self) -> str:
        body = "".join(self.zhis)
        if self.kind in ("三会", "三合", "半合", "拱合", "六合", "干合"):
            tail = f"化{self.element}" if self.transforms else "不化"
            return f"{body}{self.kind}{tail}"
        if self.kind in ("三刑", "相刑", "自刑"):
            return f"{body}{self.kind}"
        return f"{body}{self.kind}"


@dataclass
class Model:
    """Everything one `analyse()` call worked out."""

    items: list = field(default_factory=list)
    nodes: list = field(default_factory=list)        # [(index, zhi)]
    merged: dict = field(default_factory=dict)       # index -> (element, share)
    suppressed: dict = field(default_factory=dict)   # index -> factor (<=1)
    tombstones: dict = field(default_factory=dict)   # index -> ("库"|"墓", element)
    tomb_mult: dict = field(default_factory=dict)    # element -> multiplier
    stem_merged: dict = field(default_factory=dict)  # pillar -> (element, share)
    extra: int = -1                                   # index of the incoming branch

    def of(self, kind: str) -> list:
        return [r for r in self.items if r.kind == kind]

    def touching(self, idx: int) -> list:
        return [r for r in self.items if idx in r.pos]

    def merge_of(self, idx: int):
        return self.merged.get(idx)

    @property
    def notes(self) -> list:
        return [r.label for r in self.items]


# ---------------------------------------------------------------------------
# Strength
# ---------------------------------------------------------------------------


def _dist(a: int, b: int) -> int:
    """An incoming year/month branch acts on the whole chart, not from afar."""
    if a >= 4 or b >= 4:
        return 2
    return abs(a - b)


def _position_weight(pos: tuple) -> float:
    if len(pos) < 2:
        return 1.0
    ds = [_dist(a, b) for a, b in combinations(pos, 2)]
    return sum(DIST_W[min(d, 3)] for d in ds) / len(ds)


def _strength(chart, rel: Rel, stem_elements: set) -> float:
    s = BASE[rel.kind]
    if rel.element:
        season = SEASON_STATE.get(chart.month.zhi, {})
        s *= SEASON_MULT[season.get(rel.element, "休")]
        if rel.element in stem_elements:
            s *= 1.15                       # 化神透干，化得成
    s *= _position_weight(rel.pos)
    if 1 in rel.pos:                        # 月令参与，力量最重
        s *= 1.10
    return min(1.25, s)


def _transforms(kind: str, strength: float) -> bool:
    if kind in ("三会", "三合"):
        return True                         # 三支俱全即成局，月令只影响大小
    if kind in ("半合", "六合", "干合"):
        return strength >= TRANSFORM_AT
    return False


# ---------------------------------------------------------------------------
# Detection
# ---------------------------------------------------------------------------


def _unique_by_branch(nodes, group):
    """One occurrence per distinct branch of `group` present in `nodes`.

    Duplicates collapse: 卯辰 plus another 辰 is two branches, not a 三会.

    When a year/month branch is being analysed (index 4), a duplicate of an
    existing branch must resolve to the *incoming* one, not the natal one —
    otherwise "what does this 寅 do" answers with the 寅 that was already there.
    """
    seen = {}
    for i, z in nodes:
        if z in group[:3] and z not in seen:
            seen[z] = i
    if any(i == 4 for i, _ in nodes):
        for z, i in list(seen.items()):
            if i != 4 and any(i2 == 4 and z2 == z for i2, z2 in nodes):
                seen[z] = 4
    return seen


def analyse(chart, extra: str | None = None) -> Model:
    """Build the interaction model for a chart, optionally with one more branch."""
    nodes = [(i, p.zhi) for i, p in enumerate(chart.pillars)]
    if extra:
        nodes.append((4, extra))
    model = Model(nodes=nodes, extra=4 if extra else -1)
    stem_elements = {GAN_WUXING[GAN.index(g)] for g in chart.all_gan()}

    claimed: set = set()          # positions already inside a full 三会/三合

    # --- full groups first: they dominate everything they touch -------------
    for kind, groups in (("三会", SANHUI), ("三合", SANHE)):
        for grp in groups:
            seen = _unique_by_branch(nodes, grp)
            if len(seen) == 3:
                rel = Rel(kind, tuple(seen.values()), tuple(seen.keys()), element=grp[3])
                rel.strength = _strength(chart, rel, stem_elements)
                rel.transforms = True
                model.items.append(rel)
                claimed |= set(seen.values())

    # --- partial combinations ----------------------------------------------
    for grp in SANHE:
        seen = _unique_by_branch(nodes, grp)
        if len(seen) != 2 or set(seen.values()) & claimed:
            continue
        middle = grp[1] in seen            # 子午卯酉为中神，带中神才算半合
        kind = "半合" if middle else "拱合"
        rel = Rel(kind, tuple(seen.values()), tuple(seen.keys()), element=grp[3])
        rel.strength = _strength(chart, rel, stem_elements)
        rel.transforms = _transforms(kind, rel.strength)
        rel.note = "带中神" if middle else "无中神，拱而不实"
        model.items.append(rel)

    # --- pairwise relations -------------------------------------------------
    seen_pairs: set = set()
    for a, b in combinations(range(len(nodes)), 2):
        ia, za = nodes[a]
        ib, zb = nodes[b]
        key = (min(ia, ib), max(ia, ib), za, zb)
        if key in seen_pairs:
            continue
        seen_pairs.add(key)
        pos = (ia, ib)

        if HE6.get(za) == zb:
            el = HE6_ELEMENT.get("".join(sorted((za, zb))), "")
            rel = Rel("六合", pos, (za, zb), element=el)
            rel.strength = _strength(chart, rel, stem_elements)
            rel.transforms = _transforms("六合", rel.strength)
            model.items.append(rel)
        if CHONG.get(za) == zb:
            rel = Rel("六冲", pos, (za, zb))
            rel.strength = _strength(chart, rel, stem_elements)
            model.items.append(rel)
        if HAI6.get(za) == zb:
            rel = Rel("六害", pos, (za, zb))
            rel.strength = _strength(chart, rel, stem_elements)
            model.items.append(rel)
        if PO.get(za) == zb:
            rel = Rel("六破", pos, (za, zb))
            rel.strength = _strength(chart, rel, stem_elements)
            model.items.append(rel)

        # 天干只在四个命局柱之间论；运/年的地支没有对应的“原局天干”
        if ia >= 4 or ib >= 4:
            continue
        ga, gb = chart.all_gan()[ia], chart.all_gan()[ib]
        if GAN_HE.get(ga, ("",))[0] == gb:
            rel = Rel("干合", pos, (ga, gb), element=GAN_HE[ga][1])
            rel.strength = _strength(chart, rel, stem_elements)
            rel.transforms = _transforms("干合", rel.strength)
            model.items.append(rel)
        if GAN_CHONG.get(ga) == gb:
            rel = Rel("干冲", pos, (ga, gb))
            rel.strength = _strength(chart, rel, stem_elements)
            model.items.append(rel)

    # --- punishments --------------------------------------------------------
    for grp in XING_FULL:
        seen = _unique_by_branch(nodes, grp)
        if len(seen) == 3:
            rel = Rel("三刑", tuple(seen.values()), tuple(seen.keys()))
            rel.strength = _strength(chart, rel, stem_elements)
            model.items.append(rel)
        elif len(seen) == 2:
            rel = Rel("相刑", tuple(seen.values()), tuple(seen.keys()))
            rel.strength = _strength(chart, rel, stem_elements) * 0.7
            model.items.append(rel)

    for ga, gb in XING_PAIR:
        pa = [i for i, z in nodes if z == ga]
        pb = [i for i, z in nodes if z == gb]
        for ia in pa:
            for ib in pb:
                rel = Rel("相刑", (ia, ib), (ga, gb))
                rel.strength = _strength(chart, rel, stem_elements)
                model.items.append(rel)

    for z in SELF_XING:
        hits = [i for i, zz in nodes if zz == z]
        if len(hits) >= 2:
            rel = Rel("自刑", (hits[0], hits[1]), (z, z))
            rel.strength = _strength(chart, rel, stem_elements)
            model.items.append(rel)

    _resolve_competition(model)
    return model


def _resolve_competition(model: Model) -> None:
    """争合：two branches competing for the same partner halve each other.

    两子合一丑 is not two combinations, it is one contested one. Ignoring this
    is why charts with repeated branches get over-credited for "合".
    """
    counts: dict = {}
    kinds: dict = {}
    for r in model.items:
        if r.kind not in BRANCH_COMBINING:
            continue
        for i in r.pos:
            counts[i] = counts.get(i, 0) + 1
            kinds.setdefault(i, set()).add(r.kind)
    for r in model.items:
        if r.kind not in BRANCH_COMBINING:
            continue
        hit = [i for i in r.pos if counts.get(i, 0) > 1]
        if not hit:
            continue
        # 两支争一合罚得重；同一支被不同类型的合同时拉住（午合戌又合未）罚得轻，
        # 那更接近「合多则绊」，不是「争」。
        same = any(len(kinds.get(i, ())) == 1 for i in hit)
        r.strength *= 0.55 if same else 0.75
        r.note = (r.note + "；争合").strip("；")
        r.transforms = _transforms(r.kind, r.strength)

    # 天干妒合：两庚合一乙，两个合都不是真合
    stems: dict = {}
    for r in model.items:
        if r.kind != "干合":
            continue
        for i in r.pos:
            stems[i] = stems.get(i, 0) + 1
    for r in model.items:
        if r.kind != "干合":
            continue
        if any(stems.get(i, 0) > 1 for i in r.pos):
            r.strength *= 0.55
            r.note = (r.note + "；妒合").strip("；")
            r.transforms = _transforms(r.kind, r.strength)


# ---------------------------------------------------------------------------
# What the model does to the elements
# ---------------------------------------------------------------------------


def _base_vector(zhi: str) -> dict:
    """Hidden-stem weights of one branch, summing to 1."""
    weights = {1: (1.0,), 2: (0.7, 0.3), 3: (0.6, 0.28, 0.12)}[len(HIDDEN[zhi])]
    out = {}
    for h, w in zip(HIDDEN[zhi], weights):
        el = GAN_WUXING[GAN.index(h)]
        out[el] = out.get(el, 0.0) + w
    return out


def _mix(vec: dict, element: str, share: float) -> dict:
    """Move `share` of the way from the branch's own elements to the transformed one.

    The addition matters: `{**a, element: share}` would *replace* the element's
    existing weight instead of adding to it, and the vector stops summing to 1.
    A 午 that is 65% fire must be .65 fire *plus* its own hidden 丁, not .65 flat.
    """
    out = {e: v * (1 - share) for e, v in vec.items()}
    out[element] = out.get(element, 0.0) + share
    return out


def settle(model: Model) -> Model:
    """Fill in `merged`, `suppressed`, `tombstones` and `tomb_mult`.

    Kept separate from `analyse()` so the detection can be inspected on its own,
    and so the incoming-year branch can be analysed without rebuilding the chart.
    """
    for r in model.items:
        # 干合只改天干，绝不能落到地支向量上：它的 pos 同样是柱位序号，
        # 不排掉就会把年支酉也「化成火」。
        if r.kind not in BRANCH_COMBINING or not r.transforms:
            continue
        share = min(SHARE_CAP.get(r.kind, 1.0), r.strength)
        for i in r.pos:
            if i >= 4:
                model.merged[i] = (r.element, share)
                continue
            # A branch already claimed by a stronger group keeps the first result.
            if i in model.merged and model.merged[i][1] >= share:
                continue
            model.merged[i] = (r.element, share)

    for r in model.items:
        if r.kind == "干合" and r.transforms:
            share = min(SHARE_CAP["干合"], r.strength)
            for i in r.pos:
                if i < 4 and (i not in model.stem_merged
                              or model.stem_merged[i][1] < share):
                    model.stem_merged[i] = (r.element, share)

    for r in model.items:
        if r.kind not in ("六冲", "三刑", "相刑", "自刑", "六害", "六破"):
            continue
        if r.kind == "六冲":
            bite = 0.22 * r.strength
        elif r.kind in ("三刑", "相刑", "自刑"):
            bite = 0.14 * r.strength
        else:
            bite = 0.08 * r.strength
        for i in r.pos:
            local = bite * (0.6 if i >= 4 else 1.0)
            if i == 1:                     # 月令被冲，根基动摇，伤得更重
                local *= 1.35
            model.suppressed[i] = (model.suppressed.get(i, 1.0)
                                   * (1 - min(0.5, local)))

    _settle_tombs(model)
    return model


def _settle_tombs(model: Model) -> None:
    """四墓库：旺为库，衰为墓。

    The same 辰 is a storehouse when the chart has plenty of 水 and a tomb when
    it has little. Only the second one costs anything: an element in a 库 can be
    released by a clash, an element in a 墓 is simply gone.
    """
    totals: dict = {}
    for i, z in model.nodes:
        if i >= 4:
            continue
        for el, w in _vector_for(model, i).items():
            totals[el] = totals.get(el, 0.0) + w
    grand = sum(totals.values()) or 1.0
    share = {el: v / grand * 100 for el, v in totals.items()}

    for i, z in model.nodes:
        if z not in TOMB:
            continue
        stored = TOMB[z]
        if share.get(stored, 0.0) <= 0:
            continue
        kind = "库" if share[stored] >= 9.0 else "墓"
        if i >= 4:
            continue
        model.tombstones[i] = (kind, stored)
        if kind == "墓":
            model.tomb_mult[stored] = min(model.tomb_mult.get(stored, 1.0), 0.72)


def _vector_for(model: Model, idx: int) -> dict:
    z = dict(model.nodes)[idx]
    vec = _base_vector(z)
    merged = model.merged.get(idx)
    if merged:
        vec = _mix(vec, merged[0], merged[1])
    factor = model.suppressed.get(idx)
    if factor is not None:
        vec = {e: v * factor for e, v in vec.items()}
    return vec


def element_vectors(model: Model) -> list:
    """One weight vector per natal pillar, after combinations and clashes."""
    return [_vector_for(model, i) for i in range(4)]


# ---------------------------------------------------------------------------
# The incoming year / month branch
# ---------------------------------------------------------------------------


def incoming(model: Model) -> dict:
    """What the extra branch becomes once the chart has acted on it."""
    if model.extra < 0:
        return {}
    idx = model.extra
    zhi = [z for i, z in model.nodes if i == idx][0]
    merged = model.merged.get(idx)
    element, share = merged if merged else (ZHI_WUXING[ZHI.index(zhi)], 0.0)
    factor = model.suppressed.get(idx, 1.0)
    hits = [r for r in model.items if idx in r.pos]
    return {
        "zhi": zhi,
        "element": element,
        "share": round(share, 3),
        "element_after_clash": element if factor >= 0.999 else "",
        "suppressed": round(factor, 3),
        "merged": bool(merged),
        "relations": hits,
        "labels": [r.label for r in hits],
    }


# ---------------------------------------------------------------------------
# Summary used by the overall score
# ---------------------------------------------------------------------------


def tally(model: Model) -> dict:
    """Counts and totals the scoring layer can quote without re-walking."""
    out = {k: 0 for k in ("三会", "三合", "半合", "拱合", "六合", "三刑",
                          "相刑", "自刑", "六冲", "六害", "六破", "干合", "干冲")}
    merged_share = 0.0
    for r in model.items:
        out[r.kind] = out.get(r.kind, 0) + 1
        if r.kind in COMBINING and r.transforms:
            merged_share += r.strength * len(r.pos) / 4.0
    out["total"] = len(model.items)
    out["merged_share"] = round(merged_share, 2)
    out["tomb"] = sum(1 for v in model.tombstones.values() if v[0] == "墓")
    out["store"] = sum(1 for v in model.tombstones.values() if v[0] == "库")
    out["clash_n"] = out["六冲"] + out["三刑"] + out["相刑"] + out["自刑"]
    out["combine_n"] = (out["三会"] + out["三合"] + out["半合"]
                        + out["六合"] + out["拱合"])
    return out
