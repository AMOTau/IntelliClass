"""Draw the IntelliClass assignment figures at print size."""

from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).resolve().parent / "figures"
DPI = 180
SCALE = 2

NAVY = (14, 42, 71)
NAVY_MID = (31, 78, 121)
BLUE = (36, 90, 148)
TEAL = (15, 110, 107)
TEAL_DARK = (11, 90, 88)
GOLD = (164, 124, 46)
GOLD_DEEP = (122, 90, 28)
INK = (32, 42, 54)
SLATE = (70, 84, 102)
MUTED = (110, 122, 138)
LINE = (36, 58, 82)
WHITE = (255, 255, 255)
OFFWHITE = (248, 250, 252)
PALE = (236, 242, 248)
PALE_TEAL = (232, 245, 243)
PALE_GOLD = (251, 246, 234)
PALE_SAND = (247, 242, 232)
CREAM = (255, 252, 246)
HAIR = (214, 222, 232)
SHADOW = (226, 232, 238)

FONTS = {
    "regular": r"C:\Windows\Fonts\segoeui.ttf",
    "semibold": r"C:\Windows\Fonts\seguisb.ttf",
    "bold": r"C:\Windows\Fonts\segoeuib.ttf",
    "light": r"C:\Windows\Fonts\segoeuil.ttf",
}


def pt_px(points: float) -> float:
    return points / 72 * DPI


class Canvas:
    def __init__(self, w: int, h: int, bg=WHITE):
        self.w = w
        self.h = h
        self.sc = SCALE
        self.im = Image.new("RGB", (w * SCALE, h * SCALE), bg)
        self.d = ImageDraw.Draw(self.im)
        self._fonts: dict = {}

    def font(self, size: float, weight: str = "regular"):
        key = (weight, round(size, 1))
        if key not in self._fonts:
            self._fonts[key] = ImageFont.truetype(FONTS[weight], max(8, int(round(size * self.sc))))
        return self._fonts[key]

    def px(self, v: float) -> int:
        return int(round(v * self.sc))

    def xy(self, x: float, y: float):
        return (self.px(x), self.px(y))

    def text_w(self, text: str, font) -> float:
        return self.d.textlength(text, font=font) / self.sc

    def text_h(self, text: str, font) -> float:
        box = self.d.textbbox((0, 0), text, font=font)
        return (box[3] - box[1]) / self.sc

    def wrap(self, text: str, font, max_w: float) -> list[str]:
        if not text:
            return []
        lines = []
        for paragraph in text.split("\n"):
            words = paragraph.split()
            if not words:
                lines.append("")
                continue
            cur = words[0]
            for word in words[1:]:
                trial = f"{cur} {word}"
                if self.text_w(trial, font) <= max_w:
                    cur = trial
                else:
                    lines.append(cur)
                    cur = word
            lines.append(cur)
        return lines

    def text(self, x, y, text, font, fill, anchor="lt"):
        self.d.text(self.xy(x, y), text, font=font, fill=fill, anchor=anchor)

    def center_lines(self, cx, cy, lines, font, fill, gap=2):
        heights = [self.text_h(ln, font) for ln in lines]
        total = sum(heights) + gap * (len(lines) - 1)
        y = cy - total / 2
        for ln, h in zip(lines, heights):
            self.text(cx, y, ln, font, fill, anchor="mt")
            y += h + gap

    def rounded(self, x, y, w, h, r, fill, outline=None, width=2):
        self.d.rounded_rectangle(
            [self.px(x), self.px(y), self.px(x + w), self.px(y + h)],
            radius=self.px(r),
            fill=fill,
            outline=outline,
            width=self.px(width) if outline else 0,
        )

    def shadow_round(self, x, y, w, h, r, fill, outline=None, width=2):
        self.rounded(x + 4, y + 5, w, h, r, SHADOW)
        self.rounded(x, y, w, h, r, fill, outline, width)

    def ellipse(self, x, y, w, h, fill, outline, width=2):
        self.d.ellipse(
            [self.px(x), self.px(y), self.px(x + w), self.px(y + h)],
            fill=fill,
            outline=outline,
            width=self.px(width),
        )

    def line(self, points, fill, width=2):
        pts = [self.xy(x, y) for x, y in _clean(points)]
        if len(pts) >= 2:
            self.d.line(pts, fill=fill, width=self.px(width), joint="curve")

    def dashed(self, points, fill, width=2, dash=10, gap=7):
        pts = _clean(points)
        if len(pts) < 2:
            return
        # Draw in logical space so dash length stays stable.
        dist_left = 0
        drawing = True
        cx, cy = pts[0]
        for x2, y2 in pts[1:]:
            dx, dy = x2 - cx, y2 - cy
            seg = math.hypot(dx, dy)
            if seg == 0:
                continue
            ux, uy = dx / seg, dy / seg
            travelled = 0
            while travelled < seg - 0.2:
                step = (dash if drawing else gap) - dist_left
                step = min(step, seg - travelled)
                nx = cx + ux * (travelled + step)
                ny = cy + uy * (travelled + step)
                if drawing and step > 0.4:
                    self.line([(cx + ux * travelled, cy + uy * travelled), (nx, ny)], fill, width)
                travelled += step
                if abs(step - ((dash if drawing else gap) - dist_left)) < 0.2 or travelled >= seg - 0.2:
                    # consumed a dash or gap, or hit the end
                    if travelled < seg - 0.2:
                        drawing = not drawing
                        dist_left = 0
                    else:
                        used = step
                        budget = dash if drawing else gap
                        dist_left = used if used < budget - 0.1 else 0
                        if used >= budget - 0.1:
                            drawing = not drawing
                else:
                    dist_left = 0
            cx, cy = x2, y2

    def arrow(self, points, fill, width=2, head="filled", dashed=False, size=11):
        pts = _clean(points)
        if len(pts) < 2:
            return
        end = pts[-1]
        prev = pts[-2]
        ang = math.atan2(end[1] - prev[1], end[0] - prev[0])
        tip_back = size + 1
        sx = end[0] - tip_back * math.cos(ang)
        sy = end[1] - tip_back * math.sin(ang)
        shortened = pts[:-1] + [(sx, sy)]
        if dashed:
            self.dashed(shortened, fill, width)
        else:
            self.line(shortened, fill, width)
        self._head(end, ang, fill, head, size)

    def _head(self, tip, ang, fill, kind, size):
        a1 = ang + math.radians(152)
        a2 = ang - math.radians(152)
        p1 = (tip[0] + size * math.cos(a1), tip[1] + size * math.sin(a1))
        p2 = (tip[0] + size * math.cos(a2), tip[1] + size * math.sin(a2))
        if kind == "filled":
            poly = [self.xy(*tip), self.xy(*p1), self.xy(*p2)]
            self.d.polygon(poly, fill=fill)
        elif kind == "open":
            self.line([p1, tip, p2], fill, 2)
        elif kind == "hollow":
            poly = [self.xy(*tip), self.xy(*p1), self.xy(*p2)]
            self.d.polygon(poly, fill=WHITE, outline=fill)

    def chip(self, cx, cy, text, font, fg, bg=WHITE, outline=None, radius=6, pad_x=8, pad_y=3):
        tw = self.text_w(text, font)
        th = self.text_h(text, font)
        self.rounded(cx - tw / 2 - pad_x, cy - th / 2 - pad_y, tw + pad_x * 2, th + pad_y * 2, radius, bg, outline, 1.4)
        self.text(cx, cy + 1, text, font, fg, anchor="mm")

    def save(self, name: str) -> Path:
        OUT.mkdir(parents=True, exist_ok=True)
        path = OUT / name
        self.im.save(path, "PNG", dpi=(DPI * SCALE, DPI * SCALE))
        print(f"saved {path.name} {self.im.size[0]}x{self.im.size[1]}")
        return path


def _clean(points):
    out = []
    for p in points:
        if not out or abs(out[-1][0] - p[0]) > 0.4 or abs(out[-1][1] - p[1]) > 0.4:
            out.append(p)
    return out


def ellipse_edge(cx, cy, rx, ry, toward_x, toward_y):
    ang = math.atan2(toward_y - cy, toward_x - cx)
    return cx + rx * math.cos(ang), cy + ry * math.sin(ang)


def rect_anchor(rect, side, t=0.5):
    x, y, w, h = rect
    if side == "N":
        return x + w * t, y
    if side == "S":
        return x + w * t, y + h
    if side == "W":
        return x, y + h * t
    if side == "E":
        return x + w, y + h * t
    raise ValueError(side)


def ortho(a, a_side, b, b_side, gap=28):
    ax, ay = a
    bx, by = b
    if a_side == "E" and b_side == "W":
        mid = ax + gap if bx - ax > gap * 2 else (ax + bx) / 2
        return [(ax, ay), (mid, ay), (mid, by), (bx, by)]
    if a_side == "W" and b_side == "E":
        mid = (ax + bx) / 2
        return [(ax, ay), (mid, ay), (mid, by), (bx, by)]
    if a_side == "S" and b_side == "N":
        mid = (ay + by) / 2
        return [(ax, ay), (ax, mid), (bx, mid), (bx, by)]
    if a_side == "N" and b_side == "S":
        mid = (ay + by) / 2
        return [(ax, ay), (ax, mid), (bx, mid), (bx, by)]
    if a_side in ("E", "W"):
        return [(ax, ay), (bx, ay), (bx, by)]
    return [(ax, ay), (ax, by), (bx, by)]


# ---------------------------------------------------------------------------
# Cover
# ---------------------------------------------------------------------------

def draw_cover():
    W, H = int(8.27 * DPI), int(11.69 * DPI)
    c = Canvas(W, H, WHITE)
    c.d.rectangle([0, 0, c.px(W), c.px(920)], fill=NAVY)
    c.d.rectangle([0, 0, c.px(W), c.px(10)], fill=GOLD)
    c.d.rectangle([0, c.px(910), c.px(W), c.px(920)], fill=TEAL)

    def tracked(x, y, text, font, fill, tracking, anchor_y="t"):
        widths = [c.text_w(ch, font) for ch in text]
        total = sum(widths) + tracking * (len(text) - 1)
        cx = x - total / 2
        for ch, w in zip(text, widths):
            c.text(cx, y, ch, font, fill, anchor="lt")
            cx += w + tracking

    tracked(W / 2, 78, "ISJ107V", c.font(22, "semibold"), GOLD, 6)
    c.text(W / 2, 148, "ASSIGNMENT 2", c.font(18, "semibold"), (214, 224, 234), anchor="mt")
    c.text(W / 2, 250, "Formal System Proposal", c.font(40, "bold"), WHITE, anchor="mt")
    c.text(W / 2, 312, "and Specification", c.font(40, "bold"), WHITE, anchor="mt")
    c.d.rectangle([c.px(W / 2 - 48), c.px(390), c.px(W / 2 + 48), c.px(395)], fill=TEAL)
    sub = "A formal proposal for an AI-assisted academic\nmanagement platform for South African schools"
    c.center_lines(W / 2, 470, sub.split("\n"), c.font(18), (214, 224, 234), gap=8)

    # three facts
    facts = [("4", "User roles"), ("3", "AI capabilities"), ("1", "Web platform")]
    fw = 280
    start = (W - fw * 3) / 2
    for i, (num, label) in enumerate(facts):
        x = start + i * fw
        c.text(x + fw / 2, 640, num, c.font(32, "bold"), WHITE, anchor="mt")
        c.text(x + fw / 2, 692, label.upper(), c.font(13, "semibold"), (186, 204, 214), anchor="mt")
        if i:
            c.d.rectangle([c.px(x), c.px(648), c.px(x + 1.4), c.px(710)], fill=(70, 98, 124))

    # white body
    c.text(W / 2, 980, "PROJECT TITLE", c.font(13, "semibold"), TEAL, anchor="mt")
    c.text(W / 2, 1024, "IntelliClass", c.font(52, "bold"), NAVY, anchor="mt")
    c.text(W / 2, 1110, "AI-Assisted Academic Management Platform", c.font(18), SLATE, anchor="mt")
    c.d.rectangle([c.px(W / 2 - 36), c.px(1162), c.px(W / 2 + 36), c.px(1167)], fill=GOLD)

    blurb = (
        "Centralised homework, assessment, performance analytics\n"
        "and teacher-controlled artificial intelligence for schools."
    )
    c.center_lines(W / 2, 1230, blurb.split("\n"), c.font(16), SLATE, gap=6)

    # layer stack graphic
    layers = [
        (NAVY, "Presentation", "React and Vite"),
        (BLUE, "Application", "Node.js and Express"),
        (TEAL, "Data and AI", "PostgreSQL and Hugging Face"),
    ]
    lw, lh, gap = 620, 58, 12
    lx = (W - lw) / 2
    ly = 1340
    for i, (color, name, detail) in enumerate(layers):
        y = ly + i * (lh + gap)
        c.rounded(lx, y, lw, lh, 10, color)
        c.text(lx + 22, y + lh / 2, name, c.font(16, "semibold"), WHITE, anchor="lm")
        c.text(lx + lw - 22, y + lh / 2, detail, c.font(14), (232, 240, 246), anchor="rm")

    # footer panel
    c.d.rectangle([0, c.px(1688), c.px(W), c.px(H)], fill=(244, 247, 251))
    c.d.rectangle([0, c.px(1688), c.px(W), c.px(1694)], fill=NAVY)

    c.text(90, 1744, "STUDENT DETAILS", c.font(12, "semibold"), TEAL, anchor="lt")
    fields = [("Student name", 1808), ("Student number", 1906)]
    for label, y in fields:
        c.text(90, y, label, c.font(14), SLATE, anchor="lt")
        c.d.rectangle([c.px(280), c.px(y + 16), c.px(W - 90), c.px(y + 18)], fill=(186, 198, 210))

    meta = [("Module", "ISJ107V"), ("Document", "Assignment 2"), ("Date", "14 October 2026")]
    mx = 90
    for label, value in meta:
        c.text(mx, 1995, label.upper(), c.font(11, "semibold"), MUTED, anchor="lt")
        c.text(mx, 2018, value, c.font(15, "semibold"), NAVY, anchor="lt")
        mx += 360

    c.text(W / 2, 2072, "Emerging technology  ·  Artificial Intelligence", c.font(12), TEAL, anchor="mt")
    return c.save("00-cover.png")


# ---------------------------------------------------------------------------
# Architecture
# ---------------------------------------------------------------------------

def _layer_box(c, x, y, w, h, title, accent):
    c.shadow_round(x, y, w, h, 16, WHITE, HAIR, 2)
    c.rounded(x, y, w, 52, 16, accent)
    c.d.rectangle([c.px(x), c.px(y + 28), c.px(x + w), c.px(y + 52)], fill=accent)
    c.text(x + 22, y + 26, title, c.font(20, "bold"), WHITE, anchor="lm")
    return y + 52


def _pill(c, x, y, w, h, text, fill, fg, outline=None):
    c.rounded(x, y, w, h, h / 2, fill, outline, 1.6)
    c.text(x + w / 2, y + h / 2 + 1, text, c.font(16, "semibold"), fg, anchor="mm")


def draw_architecture():
    W, H = int(6.7 * DPI), int(5.95 * DPI)
    c = Canvas(W, H, OFFWHITE)
    x, w = 48, W - 96

    head = _layer_box(c, x, 28, w, 228, "PRESENTATION LAYER", NAVY)
    c.text(x + w / 2, head + 26, "React  +  Vite", c.font(26, "bold"), NAVY, anchor="mt")
    c.text(x + w / 2, head + 60, "Role-based web interface", c.font(16), SLATE, anchor="mt")
    roles = ["Administrator", "Teacher", "Learner", "Parent"]
    pw, ph, pg = 230, 36, 14
    row_w = len(roles) * pw + (len(roles) - 1) * pg
    rx = x + (w - row_w) / 2
    for i, role in enumerate(roles):
        _pill(c, rx + i * (pw + pg), head + 104, pw, ph, role, PALE, NAVY, HAIR)

    # arrow
    c.arrow([(W / 2, 268), (W / 2, 318)], NAVY, 2.4, "filled", size=12)
    c.chip(W / 2 + 150, 292, "HTTPS   ·   REST API", c.font(13, "semibold"), NAVY, WHITE, HAIR)

    head = _layer_box(c, x, 324, w, 292, "APPLICATION LAYER", BLUE)
    c.text(x + w / 2, head + 22, "Node.js  +  Express", c.font(26, "bold"), NAVY, anchor="mt")
    modules = [
        "Authentication",
        "Homework",
        "Quiz management",
        "Analytics",
        "AI integration",
        "Notifications",
    ]
    mw, mh, mgx, mgy = 300, 40, 16, 12
    cols = 3
    block_w = cols * mw + (cols - 1) * mgx
    mx0 = x + (w - block_w) / 2
    my0 = head + 68
    for i, name in enumerate(modules):
        col, row = i % cols, i // cols
        fill = PALE_TEAL if name == "AI integration" else PALE
        fg = TEAL_DARK if name == "AI integration" else NAVY
        outline = TEAL if name == "AI integration" else HAIR
        _pill(c, mx0 + col * (mw + mgx), my0 + row * (mh + mgy), mw, mh, name, fill, fg, outline)

    c.arrow([(W / 2 - 180, 628), (W / 2 - 180, 678)], NAVY, 2.4, "filled", size=12)
    c.arrow([(W / 2 + 180, 628), (W / 2 + 180, 678)], TEAL, 2.4, "filled", size=12)

    bw = (w - 28) / 2
    _layer_box(c, x, 684, bw, 300, "DATA LAYER", NAVY_MID)
    c.text(x + 22, 756, "PostgreSQL", c.font(22, "bold"), NAVY, anchor="lt")
    for i, item in enumerate(["Users and roles", "Classes and subjects", "Study materials", "Homework and quizzes", "Results and notifications"]):
        c.rounded(x + 22, 800 + i * 32, 10, 10, 2, TEAL)
        c.text(x + 44, 805 + i * 32, item, c.font(16), INK, anchor="lm")

    ax = x + bw + 28
    _layer_box(c, ax, 684, bw, 300, "EXTERNAL AI SERVICE", TEAL)
    c.text(ax + 22, 756, "Hugging Face", c.font(22, "bold"), TEAL_DARK, anchor="lt")
    c.text(ax + 22, 788, "Inference API", c.font(16), SLATE, anchor="lt")
    notes = ["Pre-trained model", "Quiz generation", "Performance insights", "Answer explanations"]
    for i, item in enumerate(notes):
        c.rounded(ax + 22, 836 + i * 32, 10, 10, 2, GOLD)
        c.text(ax + 44, 841 + i * 32, item, c.font(16), INK, anchor="lm")

    c.text(W / 2, H - 22, "The API key stays on the server and is never sent to the browser.", c.font(15), SLATE, anchor="mm")
    return c.save("01-architecture.png")


def draw_deployment():
    W, H = int(6.7 * DPI), int(5.35 * DPI)
    c = Canvas(W, H, OFFWHITE)

    c.text(W / 2, 28, "IntelliClass deployment", c.font(24, "bold"), NAVY, anchor="mt")
    c.text(W / 2, 62, "Web clients use the platform over HTTPS. AI and email stay outside the core application.", c.font(15), SLATE, anchor="mt")

    # users
    users = ["Administrator", "Teacher", "Learner", "Parent"]
    uw = 230
    gap = 16
    total = len(users) * uw + 3 * gap
    ux = (W - total) / 2
    for i, name in enumerate(users):
        _pill(c, ux + i * (uw + gap), 110, uw, 40, name, WHITE, NAVY, HAIR)

    c.arrow([(W / 2, 158), (W / 2, 198)], NAVY, 2.2, "filled", size=11)
    c.chip(W / 2 + 70, 178, "HTTPS", c.font(12, "semibold"), NAVY, WHITE, HAIR)

    # platform boundary
    c.rounded(70, 214, W - 140, 620, 18, WHITE, NAVY, 2)
    c.chip(W / 2, 214, "  Hosted web application  ", c.font(13, "bold"), WHITE, NAVY, NAVY, pad_x=12, pad_y=5)

    c.shadow_round(W / 2 - 280, 270, 560, 88, 14, PALE, HAIR, 2)
    c.text(W / 2, 300, "React frontend", c.font(20, "bold"), NAVY, anchor="mt")
    c.text(W / 2, 332, "Role-based pages served to the browser", c.font(13), SLATE, anchor="mt")

    c.arrow([(W / 2, 366), (W / 2, 408)], NAVY, 2.2, "filled", size=11)
    c.chip(W / 2 + 110, 386, "REST", c.font(12, "semibold"), NAVY, WHITE, HAIR)

    c.shadow_round(W / 2 - 280, 416, 560, 100, 14, (232, 240, 248), BLUE, 2)
    c.text(W / 2, 446, "Node.js  /  Express API", c.font(20, "bold"), NAVY, anchor="mt")
    c.text(W / 2, 480, "Authentication, business rules and AI orchestration", c.font(13), SLATE, anchor="mt")

    c.arrow([(360, 524), (250, 590)], NAVY, 2.2, "filled", size=11)
    c.arrow([(W / 2, 524), (W / 2, 590)], TEAL, 2.2, "filled", size=11)
    c.arrow([(W - 360, 524), (W - 250, 590)], GOLD_DEEP, 2.2, "filled", size=11)

    boxes = [
        (90, "PostgreSQL", "System of record", NAVY),
        (W / 2 - 170, "AI service", "Hugging Face API", TEAL),
        (W - 90 - 340, "Email service", "Notifications", GOLD_DEEP),
    ]
    for bx, title, sub, color in boxes:
        c.shadow_round(bx, 598, 340, 110, 14, WHITE, HAIR, 2)
        c.d.rectangle([c.px(bx), c.px(598), c.px(bx + 8), c.px(708)], fill=color)
        c.text(bx + 28, 632, title, c.font(18, "bold"), NAVY, anchor="lm")
        c.text(bx + 28, 668, sub, c.font(14), SLATE, anchor="lm")

    c.arrow([(W / 2, 716), (W / 2, 756)], TEAL, 2.2, "filled", size=11)
    c.rounded(W / 2 - 190, 764, 380, 48, 24, PALE_TEAL, TEAL, 1.8)
    c.text(W / 2, 788, "Pre-trained AI model", c.font(15, "semibold"), TEAL_DARK, anchor="mm")

    c.text(W / 2, H - 20, "No specialised AI hardware is required. The model is called through an external API.", c.font(15), SLATE, anchor="mm")
    return c.save("02-deployment.png")


# ---------------------------------------------------------------------------
# Use-case diagram
# ---------------------------------------------------------------------------

BREAKS = {
    "Manage School Information": "Manage School\nInformation",
    "Upload Study Material": "Upload Study\nMaterial",
    "View Performance Analytics": "View Performance\nAnalytics",
    "Request AI Performance Insights": "Request AI\nPerformance Insights",
    "Generate Performance Insights": "Generate\nPerformance Insights",
    "Generate Answer Explanation": "Generate Answer\nExplanation",
    "Request AI Answer Explanation": "Request AI\nAnswer Explanation",
    "View Learner Progress": "View Learner\nProgress",
    "View Homework Completion": "View Homework\nCompletion",
    "View Assessment Results": "View Assessment\nResults",
    "View Performance Insights": "View Performance\nInsights",
    "Generate AI Quiz": "Generate\nAI Quiz",
}

AI_CASES = {
    "Generate AI Quiz",
    "Review AI Quiz",
    "Generate Quiz",
    "Request AI Performance Insights",
    "Generate Performance Insights",
    "Request AI Answer Explanation",
    "Generate Answer Explanation",
}


def draw_usecase():
    W, H = int(10.45 * DPI), int(6.42 * DPI)
    c = Canvas(W, H, WHITE)

    columns = ["Administrator", "Teacher", "AI Service", "Learner", "Parent"]
    grid = {
        "Administrator": {
            0: "Login",
            1: "Manage Users",
            2: "Manage Classes",
            3: "Manage Subjects",
            4: "Manage School Information",
        },
        "Teacher": {
            0: "Create Homework",
            1: "Manage Quizzes",
            2: "Upload Study Material",
            3: "Generate AI Quiz",
            4: "Review AI Quiz",
            5: "Approve Quiz",
            6: "Request AI Performance Insights",
            7: "View Performance Analytics",
        },
        "AI Service": {
            3: "Generate Quiz",
            6: "Generate Performance Insights",
            7: "Generate Answer Explanation",
        },
        "Learner": {
            0: "View Homework",
            1: "Submit Homework",
            2: "View Results",
            3: "View Performance",
            4: "Calculate Score",
            5: "Take Quiz",
            7: "Request AI Answer Explanation",
        },
        "Parent": {
            0: "View Learner Progress",
            1: "View Homework Completion",
            2: "View Assessment Results",
            3: "View Performance Insights",
        },
    }
    tints = {
        "Administrator": (244, 248, 252),
        "Teacher": (244, 248, 246),
        "AI Service": (236, 247, 246),
        "Learner": (251, 248, 242),
        "Parent": (246, 245, 250),
    }

    sys = (24, 156, W - 48, 860)
    c.rounded(*sys, 18, WHITE, NAVY, 2.4)
    c.chip(sys[0] + 150, sys[1], "  IntelliClass  ", c.font(18, "bold"), WHITE, NAVY, NAVY, pad_x=10, pad_y=4)

    n = len(columns)
    pad_x, gap = 14, 22
    slot = (sys[2] - pad_x * 2 - gap * (n - 1)) / n
    ell_h = 74
    pitch = 88
    grid_top = sys[1] + 34
    font = c.font(16, "semibold")

    rects = {}
    buses = {}
    for i, name in enumerate(columns):
        sx = sys[0] + pad_x + i * (slot + gap)
        tint_h = pitch * 8 - 12
        c.rounded(sx + 4, grid_top - 6, slot - 8, tint_h, 12, tints[name])
        # actor
        cx = sx + slot / 2
        _stick(c, cx, 18, name, TEAL if name == "AI Service" else NAVY)
        cases = grid[name]
        if not cases:
            continue
        rows = sorted(cases)
        bus_x = sx + 12
        first_y = grid_top + rows[0] * pitch + ell_h / 2
        last_y = grid_top + rows[-1] * pitch + ell_h / 2
        buses[name] = (bus_x, first_y, last_y, cx)
        c.line([(cx, 148), (cx, sys[1]), (bus_x, sys[1] + 8), (bus_x, last_y)], LINE, 1.6)
        for row in rows:
            label = cases[row]
            ex = sx + 26
            ey = grid_top + row * pitch
            ew = slot - 36
            ai = label in AI_CASES
            c.ellipse(ex, ey, ew, ell_h, PALE_TEAL if ai else WHITE, TEAL if ai else NAVY_MID, 2)
            shown = BREAKS.get(label, label)
            lines = shown.split("\n") if "\n" in shown else c.wrap(shown, font, ew - 36)
            c.center_lines(ex + ew / 2, ey + ell_h / 2 + 1, lines, font, TEAL_DARK if ai else NAVY, gap=2)
            rects[label] = (ex, ey, ew, ell_h)
            mid_y = ey + ell_h / 2
            c.line([(bus_x, mid_y), (ex, mid_y)], LINE, 1.6)

    # shared login from the other human actors
    login = rects["Login"]
    lx = login[0] + login[2]
    ly = login[1] + 10
    corridor = sys[1] + 16
    for name in ("Teacher", "Learner", "Parent"):
        bus_x, first_y, last_y, cx = buses[name]
        c.line([(bus_x, corridor), (login[0] + login[2] / 2, corridor), (login[0] + login[2] / 2, login[1])], LINE, 1.5)

    def center(name):
        x, y, w, h = rects[name]
        return x + w / 2, y + h / 2, w, h, x, y

    def include_vertical(src, dst):
        x, y, w, h = rects[src]
        x2, y2, w2, h2 = rects[dst]
        gutter = x + w + 11
        if y < y2:
            c.arrow([(gutter, y + h + 1), (gutter, y2 - 1)], TEAL, 1.8, "open", dashed=True, size=8)
        else:
            c.arrow([(gutter, y - 1), (gutter, y2 + h2 + 1)], TEAL, 1.8, "open", dashed=True, size=8)

    def include_horizontal(src, dst):
        x, y, w, h = rects[src]
        x2, y2, w2, h2 = rects[dst]
        if x + w < x2:
            c.arrow([(x + w, y + h / 2), (x2, y2 + h2 / 2)], TEAL, 1.8, "open", dashed=True, size=9)
        else:
            c.arrow([(x, y + h / 2), (x2 + w2, y2 + h2 / 2)], TEAL, 1.8, "open", dashed=True, size=9)

    include_vertical("Generate AI Quiz", "Upload Study Material")
    include_vertical("Generate AI Quiz", "Review AI Quiz")
    include_horizontal("Generate AI Quiz", "Generate Quiz")
    include_vertical("Take Quiz", "Calculate Score")
    include_horizontal("Request AI Performance Insights", "Generate Performance Insights")
    include_horizontal("Request AI Answer Explanation", "Generate Answer Explanation")

    # enable through the empty AI cell on the approve/take row
    approve = rects["Approve Quiz"]
    take = rects["Take Quiz"]
    y = approve[1] + approve[3] / 2
    c.arrow([(approve[0] + approve[2], y), (take[0], y)], GOLD_DEEP, 1.8, "open", dashed=True, size=9)
    c.chip((approve[0] + approve[2] + take[0]) / 2, y - 18, "«enable»", c.font(13, "semibold"), GOLD_DEEP, CREAM, GOLD)

    # email
    email_y = sys[1] + sys[3] - 86
    ew, eh = 280, 64
    ex = sys[0] + sys[2] - ew - 28
    c.ellipse(ex, email_y, ew, eh, WHITE, SLATE, 2)
    c.center_lines(ex + ew / 2, email_y + eh / 2, ["Send Notification"], c.font(15, "semibold"), NAVY)
    # actor below boundary
    email_cx = ex + ew / 2
    boundary_bottom = sys[1] + sys[3]
    c.line([(email_cx, email_y + eh), (email_cx, boundary_bottom)], SLATE, 1.6)
    _stick(c, email_cx, boundary_bottom + 8, "Email Service", SLATE)

    # legend
    ly = H - 28
    c.line([(40, ly), (78, ly)], LINE, 2)
    c.text(86, ly, "Association", c.font(12), INK, anchor="lm")
    c.dashed([(210, ly), (258, ly)], TEAL, 2)
    c.arrow([(250, ly), (270, ly)], TEAL, 2, "open", dashed=False, size=8)
    c.text(278, ly, "«include»", c.font(12, "semibold"), TEAL_DARK, anchor="lm")
    c.text(400, ly, "Teal use cases are the artificial-intelligence behaviour. Login is shared by every human role.", c.font(13), SLATE, anchor="lm")
    return c.save("03-usecase.png")


def _stick(c: Canvas, cx, top, label, color):
    r = 13
    head_y = top + r
    c.d.ellipse([c.px(cx - r), c.px(head_y - r), c.px(cx + r), c.px(head_y + r)], outline=color, width=c.px(2))
    body_top = head_y + r
    body_bot = body_top + 28
    c.line([(cx, body_top), (cx, body_bot)], color, 2)
    c.line([(cx - 16, body_top + 12), (cx + 16, body_top + 12)], color, 2)
    c.line([(cx, body_bot), (cx - 14, body_bot + 20)], color, 2)
    c.line([(cx, body_bot), (cx + 14, body_bot + 20)], color, 2)
    font = c.font(15, "semibold")
    lines = c.wrap(label, font, 160)
    c.center_lines(cx, body_bot + 34 + 8 * (len(lines) - 1), lines, font, color, gap=1)
    return body_bot + 36


# ---------------------------------------------------------------------------
# Activity
# ---------------------------------------------------------------------------

def draw_activity():
    W, H = int(6.7 * DPI), int(8.85 * DPI)
    c = Canvas(W, H, WHITE)
    font = c.font(15, "semibold")
    small = c.font(12, "bold")

    styles = {
        "teacher": (PALE, NAVY_MID, NAVY),
        "system": (OFFWHITE, SLATE, INK),
        "learner": (PALE_SAND, GOLD_DEEP, INK),
        "ai": (PALE_TEAL, TEAL, TEAL_DARK),
        "decision": (CREAM, GOLD, INK),
    }

    nodes = {}

    def remember(key, x, y, w, h, kind):
        nodes[key] = {"x": x, "y": y, "w": w, "h": h, "cx": x + w / 2, "cy": y + h / 2, "kind": kind}

    def box(key, cx, y, text, kind, w=290, h=52):
        x = cx - w / 2
        fill, outline, fg = styles[kind]
        c.shadow_round(x, y, w, h, 10, fill, outline, 2)
        if kind == "ai":
            c.rounded(x + 8, y + 14, 28, 24, 6, TEAL)
            c.text(x + 22, y + 26, "AI", c.font(11, "bold"), WHITE, anchor="mm")
            lines = c.wrap(text, font, w - 56)
            c.center_lines(x + 36 + (w - 48) / 2, y + h / 2, lines, font, fg, gap=1)
        else:
            lines = c.wrap(text, font, w - 24)
            c.center_lines(cx, y + h / 2, lines, font, fg, gap=1)
        remember(key, x, y, w, h, kind)
        return y + h

    def diamond(key, cx, y, text, w=168, h=92):
        x = cx - w / 2
        pts = [(cx, y), (cx + w / 2, y + h / 2), (cx, y + h), (cx - w / 2, y + h / 2)]
        shadow = [(p[0] + 3, p[1] + 4) for p in pts]
        c.d.polygon([c.xy(*p) for p in shadow], fill=SHADOW)
        c.d.polygon([c.xy(*p) for p in pts], fill=CREAM, outline=GOLD)
        c.d.line([c.xy(*p) for p in pts + [pts[0]]], fill=GOLD, width=c.px(2))
        lines = c.wrap(text, small, w - 70)
        c.center_lines(cx, y + h / 2, lines, small, INK, gap=1)
        remember(key, x, y, w, h, "decision")
        return y + h

    main = 470
    left = 175
    right = 980

    # start
    c.d.ellipse([c.px(main - 14), c.px(16), c.px(main + 14), c.px(44)], fill=NAVY)
    nodes["start"] = {"x": main - 14, "y": 16, "w": 28, "h": 28, "cx": main, "cy": 30, "kind": "start"}

    y = 62
    y = box("login", main, y, "Teacher logs in", "teacher") + 16
    y = box("upload", main, y, "Upload study material", "teacher") + 18
    d1 = y
    diamond("valid", main, d1, "Valid file?")
    box("error", left, d1 + 18, "Display error", "system", w=210, h=52)
    y = d1 + 108
    y = box("extract", main, y, "Extract PDF text", "system") + 16
    y = box("generate", main, y, "Generate quiz", "ai") + 16
    y = box("draft", main, y, "Display draft quiz", "system") + 16
    y = box("review", main, y, "Teacher reviews quiz", "teacher") + 18
    d2 = y
    diamond("accept", main, d2, "Acceptable?")
    box("edit", left, d2 + 18, "Edit or reject", "teacher", w=210, h=52)
    y = d2 + 108
    y = box("approve", main, y, "Approve quiz", "teacher") + 16
    y = box("publish", main, y, "Publish quiz", "system") + 16
    y = box("take", main, y, "Learner takes quiz", "learner") + 16
    y = box("submit", main, y, "Submit answers", "learner") + 16
    y = box("score", main, y, "Calculate score", "system") + 16
    y = box("store", main, y, "Store result", "system") + 18
    d3 = y
    diamond("wrong", main, d3, "Incorrect?")
    box("request", right, d3 + 4, "Request explanation", "learner", w=230, h=52)
    box("explain", right, d3 + 72, "Generate explanation", "ai", w=250, h=52)
    y = d3 + 150
    y = box("result", main, y, "Display result", "system") + 18
    # end
    c.d.ellipse([c.px(main - 16), c.px(y), c.px(main + 16), c.px(y + 32)], outline=NAVY, width=c.px(2))
    c.d.ellipse([c.px(main - 8), c.px(y + 8), c.px(main + 8), c.px(y + 24)], fill=NAVY)
    nodes["end"] = {"cx": main, "cy": y + 16, "x": main - 16, "y": y, "w": 32, "h": 32, "kind": "end"}

    def bottom(k):
        n = nodes[k]
        return n["cx"], n["y"] + n["h"]

    def top(k):
        n = nodes[k]
        return n["cx"], n["y"]

    def vlink(a, b, label=None, color=LINE):
        x1, y1 = bottom(a)
        x2, y2 = top(b)
        c.arrow([(x1, y1), (x2, y2)], color, 2, "filled", size=9)
        if label:
            c.chip((x1 + x2) / 2 + 28, (y1 + y2) / 2, label, small, color, WHITE, None)

    vlink("start", "login")
    vlink("login", "upload")
    vlink("upload", "valid")
    vlink("valid", "extract", "Yes")
    vlink("extract", "generate")
    vlink("generate", "draft")
    vlink("draft", "review")
    vlink("review", "accept")
    vlink("accept", "approve", "Yes")
    vlink("approve", "publish")
    vlink("publish", "take")
    vlink("take", "submit")
    vlink("submit", "score")
    vlink("score", "store")
    vlink("store", "wrong")
    vlink("wrong", "result", "No")
    vlink("result", "end")

    # invalid file
    err = nodes["error"]
    val = nodes["valid"]
    up = nodes["upload"]
    c.arrow([(val["x"], val["cy"]), (err["x"] + err["w"], err["cy"])], (150, 72, 72), 2, "filled", size=9)
    c.chip((val["x"] + err["x"] + err["w"]) / 2, val["cy"] - 14, "No", small, (150, 72, 72), WHITE)
    c.arrow(
        [(err["x"], err["cy"]), (56, err["cy"]), (56, up["cy"]), (up["x"], up["cy"])],
        (150, 72, 72),
        2,
        "filled",
        size=9,
    )
    c.chip(200, up["cy"] - 20, "Upload again", c.font(12, "semibold"), (150, 72, 72), WHITE)

    # edit loop
    ed = nodes["edit"]
    acc = nodes["accept"]
    rev = nodes["review"]
    c.arrow([(acc["x"], acc["cy"]), (ed["x"] + ed["w"], ed["cy"])], GOLD_DEEP, 2, "filled", size=9)
    c.chip((acc["x"] + ed["x"] + ed["w"]) / 2, acc["cy"] - 14, "No", small, GOLD_DEEP, WHITE)
    c.arrow(
        [(ed["x"], ed["cy"]), (56, ed["cy"]), (56, rev["cy"]), (rev["x"], rev["cy"])],
        GOLD_DEEP,
        2,
        "filled",
        size=9,
    )
    c.chip(200, rev["cy"] - 20, "Review again", c.font(12, "semibold"), GOLD_DEEP, CREAM)

    # explanation branch
    wrong = nodes["wrong"]
    req = nodes["request"]
    exp = nodes["explain"]
    res = nodes["result"]
    c.arrow([(wrong["x"] + wrong["w"], wrong["cy"]), (req["x"], req["cy"])], TEAL, 2, "filled", size=9)
    c.chip((wrong["x"] + wrong["w"] + req["x"]) / 2, wrong["cy"] - 16, "Yes", small, TEAL_DARK, WHITE)
    c.arrow([(req["cx"], req["y"] + req["h"]), (exp["cx"], exp["y"])], TEAL, 2, "filled", size=9)
    c.arrow([(exp["x"], exp["cy"]), (res["x"] + res["w"], res["cy"])], TEAL, 2, "filled", size=9)

    # legend
    legend_y = H - 36
    items = [
        (PALE, NAVY_MID, "Teacher"),
        (OFFWHITE, SLATE, "System"),
        (PALE_SAND, GOLD_DEEP, "Learner"),
        (PALE_TEAL, TEAL, "AI service"),
    ]
    lx = 48
    for fill, outline, label in items:
        c.rounded(lx, legend_y - 12, 22, 22, 5, fill, outline, 1.6)
        c.text(lx + 30, legend_y, label, c.font(12, "semibold"), INK, anchor="lm")
        lx += 150
    c.text(lx + 10, legend_y, "Teal steps are the emerging technology.", c.font(12), TEAL_DARK, anchor="lm")
    return c.save("04-activity.png")


# ---------------------------------------------------------------------------
# Class diagrams
# ---------------------------------------------------------------------------

def _class_size(c: Canvas, title, stereotype, attrs, ops, font_h, font_b, font_s):
    pad = 16
    widths = [c.text_w(title, font_h)]
    if stereotype:
        widths.append(c.text_w(stereotype, font_s))
    for line in attrs + ops:
        widths.append(c.text_w(line, font_b))
    w = max(widths + [180]) + pad * 2
    header = 18 + c.text_h(title, font_h) + (c.text_h(stereotype, font_s) + 2 if stereotype else 0)
    line_h = c.text_h("Ag", font_b) + 7
    body = 10 + len(attrs) * line_h + 8
    if ops:
        body += 6 + len(ops) * line_h + 8
    else:
        body += 4
    return w, header + body, header, line_h


def _draw_class(c: Canvas, x, y, w, h, header_h, line_h, title, stereotype, attrs, ops, font_h, font_b, font_s, accent=NAVY):
    c.shadow_round(x, y, w, h, 8, WHITE, accent, 2)
    c.d.rectangle([c.px(x), c.px(y), c.px(x + w), c.px(y + header_h)], fill=accent)
    # restore bottom square and side outline
    c.d.rectangle([c.px(x), c.px(y + 8), c.px(x + w), c.px(y + header_h)], fill=accent)
    c.d.line([c.xy(x, y + 8), c.xy(x, y + header_h), c.xy(x + w, y + header_h), c.xy(x + w, y + 8)], fill=accent, width=c.px(2))
    ty = y + 8
    if stereotype:
        c.text(x + w / 2, ty, stereotype, font_s, (220, 232, 240), anchor="mt")
        ty += c.text_h(stereotype, font_s) + 1
    c.text(x + w / 2, ty, title, font_h, WHITE, anchor="mt")
    yy = y + header_h + 8
    for attr in attrs:
        c.text(x + 12, yy, attr, font_b, INK, anchor="lt")
        yy += line_h
    yy += 2
    c.line([(x + 8, yy), (x + w - 8, yy)], HAIR, 1.4)
    yy += 6
    for op in ops:
        c.text(x + 12, yy, op, font_b, NAVY, anchor="lt")
        yy += line_h
    return (x, y, w, h)


def _place_rows(rows, canvas_w, top, gap_x, gap_y):
    """rows: list of list of (name, w, h). Returns rects and next y."""
    rects = {}
    y = top
    for row in rows:
        widths = [w for _, w, h in row]
        height = max(h for _, w, h in row)
        row_w = sum(widths) + gap_x * (len(row) - 1)
        x = (canvas_w - row_w) / 2
        for name, w, h in row:
            rects[name] = (x, y, w, h)
            x += w + gap_x
        y += height + gap_y
    return rects, y


def _assoc(c, rects, a, a_side, b, b_side, card_a=None, card_b=None, name=None, dashed=False, color=LINE):
    p1 = rect_anchor(rects[a], a_side)
    p2 = rect_anchor(rects[b], b_side)
    pts = ortho(p1, a_side, p2, b_side)
    if dashed:
        c.arrow(pts, color, 1.8, "open", dashed=True, size=9)
    else:
        c.line(pts, color, 1.8)
    font = c.font(13, "bold")
    name_font = c.font(12, "semibold")
    offsets = {"N": (0, -14), "S": (0, 16), "E": (22, -12), "W": (-22, -12)}
    if card_a:
        ox, oy = offsets[a_side]
        c.chip(p1[0] + ox, p1[1] + oy, card_a, font, NAVY, WHITE)
    if card_b:
        ox, oy = offsets[b_side]
        c.chip(p2[0] + ox, p2[1] + oy, card_b, font, NAVY, WHITE)
    if name and len(pts) >= 2:
        mx = sum(p[0] for p in pts) / len(pts)
        my = sum(p[1] for p in pts) / len(pts)
        c.chip(mx, my - 12, name, name_font, TEAL_DARK if dashed else SLATE, WHITE)


def _inherit_tree(c, parent, children):
    px, py, pw, ph = parent
    parent_bottom = (px + pw / 2, py + ph)
    child_tops = [(r[0] + r[2] / 2, r[1]) for r in children]
    bar_y = parent_bottom[1] + 36
    # triangle
    tip = parent_bottom
    base_y = tip[1] + 16
    tri = [tip, (tip[0] - 12, base_y), (tip[0] + 12, base_y)]
    c.d.polygon([c.xy(*p) for p in tri], fill=WHITE, outline=NAVY)
    c.d.line([c.xy(*p) for p in tri + [tri[0]]], fill=NAVY, width=c.px(2))
    c.line([(tip[0], base_y), (tip[0], bar_y)], NAVY, 1.8)
    xs = [t[0] for t in child_tops]
    c.line([(min(xs), bar_y), (max(xs), bar_y)], NAVY, 1.8)
    for x, y in child_tops:
        c.line([(x, bar_y), (x, y)], NAVY, 1.8)


def _specs(font_note=""):
    A = "− "
    O = "+ "
    return {
        "User": ("", [f"{A}userId: int", f"{A}firstName: string", f"{A}lastName: string", f"{A}email: string", f"{A}password: string", f"{A}role: string"], [f"{O}login()", f"{O}logout()", f"{O}updateProfile()"]),
        "Administrator": ("", [], [f"{O}manageUsers()", f"{O}manageClasses()", f"{O}manageSubjects()"]),
        "Teacher": ("", [], [f"{O}uploadMaterial()", f"{O}createHomework()", f"{O}generateQuiz()", f"{O}reviewQuiz()", f"{O}approveQuiz()", f"{O}viewPerformance()", f"{O}requestPerformanceInsights()"]),
        "Learner": ("", [], [f"{O}viewHomework()", f"{O}submitHomework()", f"{O}takeQuiz()", f"{O}viewResult()", f"{O}requestAnswerExplanation()"]),
        "Parent": ("", [], [f"{O}viewLearnerProgress()", f"{O}viewHomeworkStatus()", f"{O}viewAssessmentResults()", f"{O}viewPerformanceInsights()"]),
        "School": ("", [f"{A}schoolId: int", f"{A}name: string", f"{A}address: string"], [f"{O}addClass()", f"{O}addUser()"]),
        "Class": ("", [f"{A}classId: int", f"{A}name: string", f"{A}grade: string"], [f"{O}addLearner()", f"{O}assignTeacher()"]),
        "Subject": ("", [f"{A}subjectId: int", f"{A}name: string", f"{A}code: string"], []),
        "StudyMaterial": ("", [f"{A}materialId: int", f"{A}title: string", f"{A}filePath: string", f"{A}extractedText: string", f"{A}uploadDate: date"], [f"{O}upload()", f"{O}extractText()", f"{O}delete()"]),
        "Homework": ("", [f"{A}homeworkId: int", f"{A}title: string", f"{A}description: string", f"{A}dueDate: date", f"{A}createdDate: date"], [f"{O}create()", f"{O}assign()"]),
        "Submission": ("", [f"{A}submissionId: int", f"{A}submissionDate: date", f"{A}status: string", f"{A}filePath: string"], [f"{O}submit()", f"{O}updateStatus()"]),
        "Quiz": ("", [f"{A}quizId: int", f"{A}title: string", f"{A}description: string", f"{A}status: string", f"{A}createdDate: date"], [f"{O}create()", f"{O}publish()", f"{O}approve()"]),
        "Question": ("", [f"{A}questionId: int", f"{A}questionText: string", f"{A}optionA: string", f"{A}optionB: string", f"{A}optionC: string", f"{A}optionD: string", f"{A}correctAnswer: string", f"{A}explanation: string", f"{A}difficulty: string", f"{A}topic: string"], [f"{O}validate()", f"{O}update()"]),
        "QuizResult": ("", [f"{A}resultId: int", f"{A}score: float", f"{A}percentage: float", f"{A}completedDate: date"], [f"{O}calculateScore()", f"{O}saveResult()"]),
        "AIService": ("«external»", [], [f"{O}generateQuiz()", f"{O}generatePerformanceInsights()", f"{O}generateAnswerExplanation()"]),
        "Notification": ("", [f"{A}notificationId: int", f"{A}message: string", f"{A}type: string", f"{A}sentDate: date", f"{A}status: string"], [f"{O}send()"]),
    }


def _build_boxes(c, names, accent_map=None):
    font_h = c.font(18, "bold")
    font_b = c.font(15)
    font_s = c.font(13, "semibold")
    specs = _specs()
    accent_map = accent_map or {}
    measured = {}
    for name in names:
        stereo, attrs, ops = specs[name]
        w, h, header_h, line_h = _class_size(c, name, stereo, attrs, ops, font_h, font_b, font_s)
        measured[name] = {
            "w": w, "h": h, "header": header_h, "line": line_h,
            "stereo": stereo, "attrs": attrs, "ops": ops, "accent": accent_map.get(name, NAVY),
        }
    return measured, font_h, font_b, font_s


def _paint(c, measured, rects, fonts):
    font_h, font_b, font_s = fonts
    for name, (x, y, w, h) in rects.items():
        m = measured[name]
        _draw_class(
            c, x, y, w, h, m["header"], m["line"], name, m["stereo"], m["attrs"], m["ops"],
            font_h, font_b, font_s, m["accent"],
        )


def _below_link(c, rects, a, b, card_a, card_b, name=None, drop=34):
    ax, ay, aw, ah = rects[a]
    bx, by, bw, bh = rects[b]
    y = max(ay + ah, by + bh) + drop
    p1 = (ax + aw - 18, ay + ah)
    p2 = (bx + 18, by + bh)
    c.line([p1, (p1[0], y), (p2[0], y), p2], LINE, 1.8)
    font = c.font(14, "bold")
    c.chip(p1[0] - 8, y + 14, card_a, font, NAVY, WHITE)
    c.chip(p2[0] + 8, y + 14, card_b, font, NAVY, WHITE)
    if name:
        c.chip((p1[0] + p2[0]) / 2, y + 14, name, c.font(13, "semibold"), SLATE, WHITE)


def draw_class_users():
    W, H = int(10.45 * DPI), int(6.42 * DPI)
    c = Canvas(W, H, WHITE)
    names = ["User", "Administrator", "Teacher", "Learner", "Parent", "School", "Class"]
    measured, *fonts = _build_boxes(c, names)
    rows = [
        [("User", measured["User"]["w"], measured["User"]["h"])],
        [(n, measured[n]["w"], measured[n]["h"]) for n in ["Administrator", "Teacher", "Learner", "Parent"]],
        [(n, measured[n]["w"], measured[n]["h"]) for n in ["School", "Class"]],
    ]
    for row in rows:
        rw = sum(w for _, w, h in row) + 48 * (len(row) - 1)
        print(f"class1 row width {rw:.0f} / {W}")
    rects, bottom = _place_rows(rows, W, 36, 48, 86)
    print(f"class1 bottom {bottom:.0f} / {H}")
    _paint(c, measured, rects, fonts)
    _inherit_tree(c, rects["User"], [rects[n] for n in ["Administrator", "Teacher", "Learner", "Parent"]])
    _assoc(c, rects, "School", "E", "Class", "W", "1", "1..*")
    _assoc(c, rects, "Class", "N", "Teacher", "S", "1", "1..*")
    _assoc(c, rects, "Class", "N", "Learner", "S", "1", "1..*")
    _below_link(c, rects, "Learner", "Parent", "1..*", "1", "monitors")
    # School registers users, routed in the left margin so it does not cross the subclasses.
    school, user = rects["School"], rects["User"]
    rail = min(school[0], rects["Administrator"][0]) - 36
    p_school = (school[0], school[1] + 28)
    p_user = (user[0], user[1] + user[3] - 22)
    c.line([p_school, (rail, p_school[1]), (rail, p_user[1]), p_user], LINE, 1.8)
    c.chip(rail + 28, p_school[1], "1", c.font(14, "bold"), NAVY, WHITE)
    c.chip(p_user[0] - 28, p_user[1], "1..*", c.font(14, "bold"), NAVY, WHITE)
    c.chip(W - 78, 24, "class", c.font(13, "bold"), WHITE, NAVY, NAVY)
    c.text(36, H - 22, "Hollow triangle = generalisation.    A school registers users and owns classes.    A parent monitors learners.", c.font(14), SLATE, anchor="lm")
    return c.save("05-class-users.png")


def draw_class_academic():
    W, H = int(10.45 * DPI), int(6.42 * DPI)
    c = Canvas(W, H, WHITE)
    names = ["Teacher", "Learner", "Subject", "StudyMaterial", "Homework", "Submission", "Quiz", "Question", "QuizResult", "AIService", "Notification"]
    measured, *fonts = _build_boxes(c, names, {"AIService": TEAL})
    order = [
        ["StudyMaterial", "Teacher", "Quiz", "Question"],
        ["Subject", "Homework", "QuizResult", "AIService"],
        ["Notification", "Submission", "Learner"],
    ]
    rows = [[(n, measured[n]["w"], measured[n]["h"]) for n in row] for row in order]
    for i, row in enumerate(rows):
        rw = sum(w for _, w, h in row) + 40 * (len(row) - 1)
        print(f"class2 row {i} width {rw:.0f} / {W}")
    rects, bottom = _place_rows(rows, W, 36, 40, 58)
    print(f"class2 bottom {bottom:.0f} / {H}")
    _paint(c, measured, rects, fonts)

    _assoc(c, rects, "Teacher", "W", "StudyMaterial", "E", "1", "1..*")
    _assoc(c, rects, "Teacher", "E", "Quiz", "W", "1", "1..*")
    _assoc(c, rects, "Quiz", "E", "Question", "W", "1", "1..*")
    _assoc(c, rects, "Subject", "N", "StudyMaterial", "S", "1", "1..*")
    _assoc(c, rects, "Teacher", "S", "Homework", "N", "1", "1..*")
    _assoc(c, rects, "Homework", "S", "Submission", "N", "1", "1..*")
    _assoc(c, rects, "Quiz", "S", "QuizResult", "N", "1", "1..*")
    _assoc(c, rects, "Learner", "N", "QuizResult", "S", "1", "1..*")
    _assoc(c, rects, "QuizResult", "E", "AIService", "W", None, None, "«uses»", dashed=True, color=TEAL)

    # Study material and quiz depend on the AI service. Route both in the top margin.
    rail = W - 28
    ai = rects["AIService"]
    ai_target = (ai[0] + ai[2], ai[1] + 28)
    top_y = 18
    for name, label_y in (("StudyMaterial", top_y), ("Quiz", top_y)):
        box = rects[name]
        start = (box[0] + box[2] / 2, box[1])
        c.arrow([start, (start[0], top_y), (rail, top_y), (rail, ai_target[1]), ai_target], TEAL, 1.6, "open", dashed=True, size=8)
    c.chip((rects["StudyMaterial"][0] + rects["Quiz"][0]) / 2, top_y - 2, "«uses»", c.font(13, "semibold"), TEAL_DARK, WHITE)

    c.chip(W - 78, H - 48, "class", c.font(13, "bold"), WHITE, NAVY, NAVY)
    c.text(36, H - 22, "Teacher and Learner specialise User, shown on the users diagram.    Dashed arrows are dependencies on the external AI service.", c.font(14), SLATE, anchor="lm")
    return c.save("06-class-academic.png")


# ---------------------------------------------------------------------------
# Sequence
# ---------------------------------------------------------------------------

def draw_sequence():
    W, H = int(10.45 * DPI), int(6.42 * DPI)
    c = Canvas(W, H, WHITE)
    participants = [
        ("Teacher", NAVY, WHITE),
        ("React UI", BLUE, WHITE),
        ("Node / Express API", NAVY_MID, WHITE),
        ("PostgreSQL", (55, 74, 98), WHITE),
        ("AI Service", TEAL, WHITE),
    ]
    margin = 40
    gap = (W - margin * 2) / len(participants)
    xs = [margin + gap * (i + 0.5) for i in range(len(participants))]
    top = 48
    box_w = min(250, gap - 24)
    box_h = 48
    font = c.font(16, "bold")
    msg_font = c.font(14, "semibold")

    events = [
        ("call", 0, 1, "Upload study material"),
        ("call", 1, 2, "POST /api/materials/upload"),
        ("self", 2, 2, "Validate file"),
        ("self", 2, 2, "Extract PDF text"),
        ("call", 2, 3, "Save material"),
        ("ret", 3, 2, "Material saved"),
        ("ret", 2, 1, "Upload confirmation"),
        ("ret", 1, 0, "Display material"),
        ("call", 0, 1, "Click Generate Quiz"),
        ("call", 1, 2, "POST /api/ai/generate-quiz"),
        ("call", 2, 3, "Retrieve extracted text"),
        ("ret", 3, 2, "Return study material"),
        ("ai", 2, 4, "Send content and prompt"),
        ("ret", 4, 2, "Generated quiz"),
        ("self", 2, 2, "Validate AI response"),
        ("call", 2, 3, "Save quiz draft"),
        ("ret", 3, 2, "Quiz draft saved"),
        ("ret", 2, 1, "Return generated quiz"),
        ("ret", 1, 0, "Display quiz draft"),
        ("call", 0, 1, "Review, edit and approve"),
        ("call", 1, 2, "Submit approval"),
        ("call", 2, 3, "Set status = Approved"),
    ]

    y = top + box_h + 22
    ys = []
    for kind, a, b, label in events:
        ys.append(y)
        y += 42 if kind != "self" else 38
    life_bottom = y + 10

    # lifelines
    for x in xs:
        c.dashed([(x, top + box_h), (x, life_bottom)], HAIR, 1.6, dash=5, gap=5)

    # activations on API (index 2), UI (1), DB (3), AI (4)
    def activate(index, y1, y2, color):
        c.d.rectangle([c.px(xs[index] - 5), c.px(y1), c.px(xs[index] + 5), c.px(y2)], fill=color)

    def y_of(i):
        return ys[i]

    activate(1, y_of(0), y_of(7) + 8, (186, 208, 230))
    activate(2, y_of(1), y_of(6) + 8, (176, 196, 216))
    activate(3, y_of(4), y_of(5) + 8, (196, 204, 214))
    activate(1, y_of(8), y_of(18) + 8, (186, 208, 230))
    activate(2, y_of(9), y_of(17) + 8, (176, 196, 216))
    activate(3, y_of(10), y_of(11) + 8, (196, 204, 214))
    activate(4, y_of(12), y_of(13) + 8, (176, 214, 210))
    activate(3, y_of(15), y_of(16) + 8, (196, 204, 214))
    activate(1, y_of(19), y_of(20) + 8, (186, 208, 230))
    activate(2, y_of(20), y_of(21) + 14, (176, 196, 216))
    activate(3, y_of(21) - 4, y_of(21) + 16, (196, 204, 214))

    for i, (kind, a, b, label) in enumerate(events):
        yy = ys[i]
        color = TEAL if kind == "ai" or (kind == "ret" and (a == 4 or b == 4)) else LINE
        if kind == "self":
            x = xs[a]
            c.arrow([(x, yy), (x + 54, yy), (x + 54, yy + 22), (x + 8, yy + 22)], color, 1.7, "filled", size=8)
            c.chip(x + 54 + c.text_w(label, msg_font) / 2 + 8, yy + 4, label, msg_font, INK, WHITE)
        else:
            x1, x2 = xs[a], xs[b]
            head = "open" if kind == "ret" else "filled"
            dashed = kind == "ret"
            c.arrow([(x1, yy), (x2, yy)], color, 1.8, head, dashed=dashed, size=9)
            c.chip((x1 + x2) / 2, yy - 12, label, msg_font, TEAL_DARK if color == TEAL else INK, WHITE)

    # headers on top
    for x, (name, fill, fg) in zip(xs, participants):
        c.shadow_round(x - box_w / 2, top, box_w, box_h, 8, fill, fill, 1)
        lines = c.wrap(name, font, box_w - 16)
        c.center_lines(x, top + box_h / 2, lines, font, fg, gap=0)

    c.chip(78, 26, "sd   AI quiz generation", c.font(13, "bold"), WHITE, NAVY, NAVY, pad_x=10, pad_y=4)
    c.text(W - 36, H - 22, "Dashed arrows are replies. Teal marks the AI service call.", c.font(12), SLATE, anchor="rm")
    if life_bottom > H - 30:
        print(f"WARNING sequence overflow {life_bottom:.0f} > {H}")
    else:
        print(f"sequence bottom {life_bottom:.0f} / {H}")
    return c.save("07-sequence.png")


def draw_ai_flow():
    W, H = int(6.7 * DPI), int(5.15 * DPI)
    c = Canvas(W, H, OFFWHITE)
    steps = [
        (NAVY, "Teacher or learner", "Requests quiz generation, an insight, or an explanation"),
        (BLUE, "React frontend", "Sends the request to the application API"),
        (NAVY_MID, "Node.js API", "Checks the role, loads the context, and builds the prompt"),
        (TEAL, "Hugging Face model", "Pre-trained model returns draft questions, a summary, or an explanation"),
        (NAVY, "API and database", "Validates the response, stores a draft or result, and returns it"),
    ]
    y = 28
    box_w = W - 180
    x = 90
    h = 92
    for i, (color, title, detail) in enumerate(steps):
        c.shadow_round(x, y, box_w, h, 14, WHITE, HAIR, 2)
        c.rounded(x, y, 12, h, 8, color)
        c.d.rectangle([c.px(x + 6), c.px(y), c.px(x + 12), c.px(y + h)], fill=color)
        c.rounded(x + 28, y + 28, 36, 36, 18, color)
        c.text(x + 46, y + 46, str(i + 1), c.font(16, "bold"), WHITE, anchor="mm")
        c.text(x + 80, y + 30, title, c.font(18, "bold"), NAVY, anchor="lt")
        c.text(x + 80, y + 58, detail, c.font(14), SLATE, anchor="lt")
        y += h
        if i < len(steps) - 1:
            c.arrow([(W / 2, y), (W / 2, y + 22)], TEAL if i == 2 else NAVY, 2.2, "filled", size=9)
            y += 22
    c.text(W / 2, H - 22, "The teacher still reviews and approves a generated quiz before learners can take it.", c.font(13, "semibold"), TEAL_DARK, anchor="mm")
    return c.save("08-ai-flow.png")


def main():
    draw_cover()
    draw_architecture()
    draw_deployment()
    draw_usecase()
    draw_activity()
    draw_class_users()
    draw_class_academic()
    draw_sequence()
    draw_ai_flow()


if __name__ == "__main__":
    main()
