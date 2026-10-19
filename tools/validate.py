"""Validate all game content against the schema and quality rules.

Usage: python tools/validate.py [--strict]
Exit code 0 = OK, 1 = errors. Warnings never fail unless --strict.
"""
from __future__ import annotations

import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path
from typing import Literal, Optional

from pydantic import BaseModel, Field, ValidationError, field_validator

ROOT = Path(__file__).resolve().parent.parent
CONTENT = ROOT / "content"
STATES = CONTENT / "states"
# Sign facts tagged scope "national" in this state are shared with states not yet written.
NATIONAL_SOURCE = "va"

DISTRICT_IDS = [
    "d01-rookie", "d02-shapes", "d03-regulatory", "d04-warning", "d05-workzone",
    "d06-signals", "d07-rightofway", "d08-speed", "d09-lanes", "d10-sharing",
    "d11-conditions", "d12-impaired", "d13-belts", "d14-penalties", "d15-licensing",
    "d16-examday",
]
SCENE_PROPS = {
    "traffic-light-red", "traffic-light-yellow", "traffic-light-green",
    "traffic-light-flashing-red", "traffic-light-flashing-yellow", "traffic-light-out",
    "school-bus-stopped", "pedestrian-crosswalk", "blind-pedestrian", "cyclist-ahead",
    "motorcycle-ahead", "deer-on-road", "emergency-behind", "emergency-stopped",
    "tow-truck-stopped", "trash-truck-stopped", "railroad-gate-down",
    "railroad-lights-flashing", "flagger-stop", "flagger-slow", "funeral-procession",
    "work-zone-cones", "truck-ahead", "tailgater-behind", "ponded-water", "icy-bridge",
    "stop-line", "driveway-exit",
}
STATE_NAME_RE = re.compile(r"\bVirginia\b|\bVA\b")
ID_RE = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")
REF_RE = re.compile(r"^Section [1-8](, p\. \d+(-\d+)?)?$")


def words(s: str) -> int:
    return len(s.split())


def ends_with_period(choice: str) -> bool:
    """A choice must not end in a sentence period; times such as "5 a.m." are fine."""
    c = choice.strip().lower()
    return c.endswith((".", "!")) and not c.endswith(("a.m.", "p.m."))


def grammar_shape(where: str, label: str, text: str, ends: str, errors: list[str]) -> None:
    """Cheap guards against clipped, telegraphic wording (full grammar is reviewed by people)."""
    t = text.strip()
    if not t:
        errors.append(f"[{where}] {label} is empty")
        return
    if t[-1] not in ends:
        errors.append(f"[{where}] {label} must end with one of {ends!r}: {t!r}")
    if t.endswith("...") or "…" in t:
        errors.append(f"[{where}] {label} uses an ellipsis: {t!r}")
    if re.search(r"->|→|&| w/ ", t):
        errors.append(f"[{where}] {label} uses a symbol shortcut: {t!r}")
    if t[0].islower():
        errors.append(f"[{where}] {label} starts with a lowercase letter: {t!r}")
    if "  " in text or text != t:
        errors.append(f"[{where}] {label} has stray whitespace: {text!r}")


class Item(BaseModel):
    id: str
    district: Literal[tuple(DISTRICT_IDS)]  # type: ignore[valid-type]
    kind: Literal["sign", "rule", "number"]
    scope: Optional[Literal["national", "state"]] = None
    title: str = Field(min_length=2)
    simple: str = Field(min_length=10)
    official: str = Field(min_length=10)
    image: Optional[str] = None
    mnemonic: Optional[str] = None
    manualRef: str

    @field_validator("id")
    @classmethod
    def _id(cls, v: str) -> str:
        if not ID_RE.match(v):
            raise ValueError(f"id not kebab-case: {v}")
        return v

    @field_validator("manualRef")
    @classmethod
    def _ref(cls, v: str) -> str:
        if not REF_RE.match(v):
            raise ValueError(f"manualRef must look like 'Section 3, p. 15': {v!r}")
        return v


class GateEvent(BaseModel):
    id: str
    item: str
    kind: Literal["gates"]
    prompt: str
    image: Optional[str] = None
    choices: list[str] = Field(min_length=3, max_length=3)
    answer: Literal[0, 1, 2]
    missLine: str


class ActionEvent(BaseModel):
    id: str
    item: str
    kind: Literal["action"]
    prompt: str
    prop: Optional[str] = None
    sign: Optional[str] = None
    weather: Optional[Literal["clear", "rain", "fog", "night", "snow"]] = None
    action: Literal["stop", "slow", "go", "move-left", "move-right", "pull-over", "brake-straight"]
    missLine: str


class Question(BaseModel):
    id: str
    item: str
    part: Literal[1, 2]
    prompt: str
    image: Optional[str] = None
    choices: list[str] = Field(min_length=4, max_length=4)
    answer: Literal[0, 1, 2, 3]
    explain: str


class StateExam(BaseModel):
    questions: Optional[int] = None
    passPercent: Optional[int] = None
    note: Optional[str] = None


class StateInfo(BaseModel):
    code: str = Field(pattern=r"^[a-z]{2}$")
    name: str = Field(min_length=4)
    status: Literal["ready", "preview"]
    agency: Optional[str] = None
    manualTitle: Optional[str] = None
    manualUrl: Optional[str] = None
    exam: StateExam = StateExam()
    sources: list[str] = []


class DistrictFile(BaseModel):
    district: Literal[tuple(DISTRICT_IDS)]  # type: ignore[valid-type]
    items: list[Item]
    events: list[dict]
    questions: list[Question]


def validate_state(code: str, ready: bool, image_ids: set[str], errors: list[str], warnings: list[str]) -> None:
    """Validate one state's course in content/states/<code>/."""
    state_dir = STATES / code
    all_ids: Counter[str] = Counter()
    item_district: dict[str, str] = {}
    totals = Counter()
    per_item_events: dict[str, int] = defaultdict(int)
    per_item_questions: dict[str, int] = defaultdict(int)
    answer_dist = Counter()

    files = sorted((state_dir / "districts").glob("*.json"))
    if not files:
        errors.append(f"no district files found in {state_dir.relative_to(ROOT)}/districts/")
    seen_districts = set()
    for f in files:
        where = f"{code}/{f.name}"
        try:
            raw = json.loads(f.read_text(encoding="utf-8"))
            df = DistrictFile.model_validate(raw)
        except (json.JSONDecodeError, ValidationError) as e:
            errors.append(f"[{where}] {e}")
            continue
        if f.stem != df.district:
            errors.append(f"[{where}] file name must equal district id {df.district}")
        seen_districts.add(df.district)

        for it in df.items:
            all_ids[it.id] += 1
            item_district[it.id] = df.district
            if it.district != df.district:
                errors.append(f"[{where}] item {it.id} district mismatch")
            if words(it.simple) > 40:
                errors.append(f"[{where}] item {it.id} simple text is {words(it.simple)} words (max 40)")
            grammar_shape(where, f"item {it.id} simple", it.simple, ".!?", errors)
            if words(it.title) > 6:
                warnings.append(f"[{where}] item {it.id} title > 6 words")
            if it.mnemonic and words(it.mnemonic) > 20:
                warnings.append(f"[{where}] item {it.id} mnemonic > 20 words")
            if it.image and it.image not in image_ids:
                errors.append(f"[{where}] item {it.id} unknown image {it.image}")
            if it.kind == "sign" and not it.image:
                errors.append(f"[{where}] sign item {it.id} needs an image")
            totals["items"] += 1
            totals[f"kind:{it.kind}"] += 1

        item_ids = {it.id for it in df.items}
        # National facts are shown to every state, so they must not name one.
        national = {it.id for it in df.items if it.scope == "national"}
        for raw_any in [*(it.model_dump() for it in df.items if it.id in national),
                        *(e for e in df.events if e.get("item") in national),
                        *(q.model_dump() for q in df.questions if q.item in national)]:
            if STATE_NAME_RE.search(json.dumps(raw_any, ensure_ascii=False)):
                errors.append(f"[{where}] national fact {raw_any.get('id')} names a state; tag it scope state")
        for raw_ev in df.events:
            kind = raw_ev.get("kind")
            try:
                ev = GateEvent.model_validate(raw_ev) if kind == "gates" else ActionEvent.model_validate(raw_ev)
            except ValidationError as e:
                errors.append(f"[{where}] event {raw_ev.get('id')}: {e}")
                continue
            all_ids[ev.id] += 1
            if ev.item not in item_ids:
                errors.append(f"[{where}] event {ev.id} references unknown item {ev.item}")
            per_item_events[ev.item] += 1
            if isinstance(ev, GateEvent):
                if words(ev.prompt) > 16:
                    errors.append(f"[{where}] event {ev.id} prompt > 16 words")
                grammar_shape(where, f"event {ev.id} prompt", ev.prompt, "?", errors)
                for c in ev.choices:
                    if len(c) > 32:
                        errors.append(f"[{where}] event {ev.id} choice > 32 chars: {c!r}")
                    if ends_with_period(c):
                        errors.append(f"[{where}] event {ev.id} choice ends with a period: {c!r}")
                    if c[:1].islower():
                        errors.append(f"[{where}] event {ev.id} choice starts lowercase: {c!r}")
                if len(set(c.strip().lower() for c in ev.choices)) != 3:
                    errors.append(f"[{where}] event {ev.id} duplicate choices")
                if ev.image and ev.image not in image_ids:
                    errors.append(f"[{where}] event {ev.id} unknown image {ev.image}")
                answer_dist[f"gate:{ev.answer}"] += 1
                totals["gate events"] += 1
            else:
                if words(ev.prompt) > 14:
                    errors.append(f"[{where}] event {ev.id} prompt > 14 words")
                grammar_shape(where, f"event {ev.id} prompt", ev.prompt, ".!?", errors)
                if not ev.prop and not ev.sign:
                    errors.append(f"[{where}] action event {ev.id} needs a prop or a sign")
                if ev.prop and ev.prop not in SCENE_PROPS:
                    errors.append(f"[{where}] event {ev.id} unknown prop {ev.prop}")
                if ev.sign and ev.sign not in image_ids:
                    errors.append(f"[{where}] event {ev.id} unknown sign {ev.sign}")
                totals["action events"] += 1
            if words(ev.missLine) > 24:
                errors.append(f"[{where}] event {ev.id} missLine > 24 words")
            grammar_shape(where, f"event {ev.id} missLine", ev.missLine, ".!", errors)

        for q in df.questions:
            all_ids[q.id] += 1
            if q.item not in item_ids:
                errors.append(f"[{where}] question {q.id} references unknown item {q.item}")
            per_item_questions[q.item] += 1
            if q.part == 1 and not q.image:
                errors.append(f"[{where}] part-1 question {q.id} needs an image")
            if q.image and q.image not in image_ids:
                errors.append(f"[{where}] question {q.id} unknown image {q.image}")
            if len(set(c.strip().lower() for c in q.choices)) != 4:
                errors.append(f"[{where}] question {q.id} duplicate choices")
            if words(q.prompt) > 32:
                errors.append(f"[{where}] question {q.id} prompt > 32 words")
            grammar_shape(where, f"question {q.id} prompt", q.prompt, "?:", errors)
            if words(q.explain) > 30:
                errors.append(f"[{where}] question {q.id} explain > 30 words")
            grammar_shape(where, f"question {q.id} explain", q.explain, ".!", errors)
            for c in q.choices:
                if ends_with_period(c):
                    errors.append(f"[{where}] question {q.id} choice ends with a period: {c!r}")
                if c[:1].islower():
                    errors.append(f"[{where}] question {q.id} choice starts lowercase: {c!r}")
            answer_dist[f"q:{q.answer}"] += 1
            totals["questions"] += 1
            totals[f"part{q.part}"] += 1

    for iid, d in item_district.items():
        if per_item_events[iid] < 2:
            errors.append(f"[{d}] item {iid} has {per_item_events[iid]} events (min 2)")
        if per_item_questions[iid] < 2:
            errors.append(f"[{d}] item {iid} has {per_item_questions[iid]} questions (min 2)")

    for i, n in all_ids.items():
        if n > 1:
            errors.append(f"duplicate id across content: {i} x{n}")

    # A "ready" state is the full course; a state still being written may be partial.
    for d in DISTRICT_IDS:
        if d != "d16-examday" and d not in seen_districts:
            (errors if ready else warnings).append(f"[{code}] missing district file for {d}")

    if ready and totals["part1"] < 40:
        warnings.append(f"[{code}] only {totals['part1']} part-1 sign questions; want 40+ for varied Exam Days")

    if ready and not (state_dir / "story.json").exists():
        errors.append(f"[{code}] missing {state_dir.relative_to(ROOT)}/story.json")

    print(f"[{code}] totals:", dict(totals))
    print(f"[{code}] answer index spread:", dict(sorted(answer_dist.items())))



def main() -> int:
    strict = "--strict" in sys.argv
    errors: list[str] = []
    warnings: list[str] = []

    registry = json.loads((CONTENT / "signs" / "registry.json").read_text(encoding="utf-8"))
    image_ids = {r["id"] for r in registry}
    for r in registry:
        if not (CONTENT / "signs" / f"{r['id']}.svg").exists():
            errors.append(f"[art] missing SVG for registry id {r['id']}")
    for svg in (CONTENT / "signs").glob("*.svg"):
        if svg.stem not in image_ids:
            warnings.append(f"[art] SVG not in registry: {svg.name}")
        text = svg.read_text(encoding="utf-8", errors="replace")
        if "<svg" not in text or "viewBox" not in text:
            errors.append(f"[art] {svg.name} is not a valid SVG with a viewBox")

    states_file = STATES / "states.json"
    try:
        states = [StateInfo.model_validate(x) for x in json.loads(states_file.read_text(encoding="utf-8"))]
    except (OSError, json.JSONDecodeError, ValidationError) as e:
        errors.append(f"[states.json] {e}")
        states = []
    codes = Counter(s.code for s in states)
    for c, n in codes.items():
        if n > 1:
            errors.append(f"[states.json] duplicate state code {c}")
    if len(codes) != 50:
        errors.append(f"[states.json] expected 50 states, found {len(codes)}")
    by_code = {s.code: s for s in states}
    if NATIONAL_SOURCE not in by_code or by_code[NATIONAL_SOURCE].status != "ready":
        errors.append(f"[states.json] the national sign pack comes from {NATIONAL_SOURCE!r}, which must be ready")

    for d in sorted(p for p in STATES.iterdir() if p.is_dir()):
        if d.name not in by_code:
            errors.append(f"[states] folder content/states/{d.name} is not in states.json")
            continue
        validate_state(d.name, by_code[d.name].status == "ready", image_ids, errors, warnings)
    for s in states:
        if s.status == "ready" and not (STATES / s.code / "districts").is_dir():
            errors.append(f"[{s.code}] marked ready but content/states/{s.code}/districts is missing")

    for w in warnings:
        print("WARN ", w)
    for e in errors:
        print("ERROR", e)
    print(f"\n{len(errors)} errors, {len(warnings)} warnings")
    if errors or (strict and warnings):
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
