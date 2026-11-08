# -*- coding: utf-8 -*-
"""Grade 9 CAPS Mathematics exam pack: teaching slides, question paper, memorandum.

Original material aligned to the DBE CAPS Senior Phase Mathematics curriculum and
the 2025 Grade 9 Annual Teaching Plan. Topic names match Platinum Mathematics
Grade 9 so a learner can find the chapter. Questions are not copied from the
textbook or from past papers.
"""

from __future__ import annotations

import os

from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import MSO_ANCHOR, PP_ALIGN
from pptx.oxml.ns import qn
from pptx.util import Emu, Inches, Pt
from reportlab.lib.colors import HexColor, white
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate,
    CondPageBreak,
    Flowable,
    Frame,
    KeepTogether,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)

OUT_DIR = os.path.dirname(os.path.abspath(__file__))
SLIDES_PATH = os.path.join(OUT_DIR, "Grade-9-Mathematics-Teaching-Slides.pptx")
QUESTION_PATH = os.path.join(OUT_DIR, "Grade-9-Mathematics-Question-Paper.pdf")
MEMO_PATH = os.path.join(OUT_DIR, "Grade-9-Mathematics-Answer-Memorandum.pdf")

NAVY = RGBColor(0x1B, 0x3A, 0x4B)
TEAL = RGBColor(0x0F, 0x6E, 0x6B)
AMBER = RGBColor(0xB5, 0x72, 0x12)
INK = RGBColor(0x1C, 0x2B, 0x33)
MUTED = RGBColor(0x3E, 0x52, 0x5C)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
CREAM = RGBColor(0xF7, 0xF4, 0xEF)
CARD = RGBColor(0xFF, 0xFC, 0xF8)
GREEN = RGBColor(0x1B, 0x6B, 0x45)
GREEN_BG = RGBColor(0xE5, 0xF4, 0xEC)
AMBER_BG = RGBColor(0xFB, 0xF3, 0xE4)
TEAL_BG = RGBColor(0xE7, 0xF3, 0xF2)
CORAL = RGBColor(0xA3, 0x3B, 0x32)

PDF_NAVY = HexColor("#1B3A4B")
PDF_TEAL = HexColor("#0F6E6B")
PDF_AMBER = HexColor("#B57212")
PDF_INK = HexColor("#1C2B33")
PDF_MUTED = HexColor("#3E525C")
PDF_CREAM = HexColor("#F7F4EF")
PDF_LINE = HexColor("#D5DDD8")
PDF_GREEN = HexColor("#1B6B45")
PDF_SOFT = HexColor("#F4FAF9")

pdfmetrics.registerFont(TTFont("Body", r"C:\Windows\Fonts\cambria.ttc", subfontIndex=0))
pdfmetrics.registerFont(TTFont("Body-Bold", r"C:\Windows\Fonts\cambriab.ttf"))
pdfmetrics.registerFont(TTFont("Body-Italic", r"C:\Windows\Fonts\cambriai.ttf"))
pdfmetrics.registerFont(TTFont("Body-BoldItalic", r"C:\Windows\Fonts\cambriaz.ttf"))
pdfmetrics.registerFontFamily(
    "Body",
    normal="Body",
    bold="Body-Bold",
    italic="Body-Italic",
    boldItalic="Body-BoldItalic",
)


def _no_line(shape):
    shape.line.fill.background()


def _rect(slide, x, y, w, h, fill, line=None, radius=None):
    kind = MSO_SHAPE.ROUNDED_RECTANGLE if radius else MSO_SHAPE.RECTANGLE
    shape = slide.shapes.add_shape(kind, Inches(x), Inches(y), Inches(w), Inches(h))
    shape.fill.solid()
    shape.fill.fore_color.rgb = fill
    if line is None:
        _no_line(shape)
    else:
        shape.line.color.rgb = line
        shape.line.width = Pt(1.25)
    if radius:
        # Adjust the corner radius (adj is a fraction of the shorter side).
        try:
            shape.adjustments[0] = radius
        except Exception:
            pass
    sp = shape._element
    style = sp.find(qn("p:style"))
    if style is not None:
        sp.remove(style)
    return shape


def _box(slide, x, y, w, h, paragraphs, size=20, color=INK, bold=False,
         align=PP_ALIGN.LEFT, anchor="top", spacing=8, font="Calibri"):
    shape = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    tf = shape.text_frame
    tf.word_wrap = True
    tf.auto_size = None
    tf.margin_left = Inches(0.06)
    tf.margin_right = Inches(0.06)
    tf.margin_top = Inches(0.04)
    tf.margin_bottom = Inches(0.04)
    anchor_map = {"top": "t", "middle": "ctr", "bottom": "b"}
    tf._txBody.bodyPr.set("anchor", anchor_map.get(anchor, "t"))
    for i, item in enumerate(paragraphs):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = align
        p.space_after = Pt(spacing)
        if isinstance(item, str):
            text, sz, is_bold, col = item, size, bold, color
        else:
            text = item[0]
            sz = item[1] if len(item) > 1 and item[1] is not None else size
            is_bold = item[2] if len(item) > 2 and item[2] is not None else bold
            col = item[3] if len(item) > 3 and item[3] is not None else color
        run = p.add_run()
        run.text = text
        run.font.name = font
        run.font.size = Pt(sz)
        run.font.bold = bool(is_bold)
        run.font.color.rgb = col
    return shape


def _footer(slide, label, number, total):
    _rect(slide, 0, 7.22, 13.333, 0.28, NAVY)
    _box(
        slide, 0.4, 7.22, 9.2, 0.28,
        [label], size=11, color=WHITE, anchor="middle", spacing=0,
    )
    _box(
        slide, 10.2, 7.22, 2.7, 0.28,
        [f"{number}  /  {total}"], size=11, color=WHITE,
        align=PP_ALIGN.RIGHT, anchor="middle", spacing=0,
    )


def _header_bar(slide):
    _rect(slide, 0, 0, 13.333, 0.1, TEAL)


def _notes(slide, text):
    if not text:
        return
    notes = slide.notes_slide.notes_text_frame
    notes.text = text


def _new(prs):
    return prs.slides.add_slide(prs.slide_layouts[6])


def slide_title(prs):
    s = _new(prs)
    _rect(s, 0, 0, 13.333, 7.5, NAVY)
    _rect(s, 0, 0, 0.18, 7.5, AMBER)
    _box(s, 0.7, 1.15, 11.5, 0.4, ["CAPS   ·   GRADE 9   ·   SOUTH AFRICA"],
         size=14, color=AMBER, bold=True, spacing=0)
    _box(s, 0.7, 1.7, 12, 1.3, ["Mathematics"], size=60, color=WHITE, bold=True, spacing=0)
    _box(s, 0.7, 3.05, 11, 1.1, ["A teaching pack for the final exam"],
         size=28, color=RGBColor(0xD7, 0xE6, 0xE4), spacing=0)
    _rect(s, 0.72, 4.35, 2.2, 0.07, AMBER)
    _box(
        s, 0.7, 4.6, 11.2, 1.1,
        [
            "Terms 1 to 4, from whole numbers to transformations.",
            "Use these slides to teach. The question paper and the memorandum are separate files.",
        ],
        size=18, color=WHITE, spacing=6,
    )
    _rect(s, 0, 6.55, 13.333, 0.95, RGBColor(0x14, 0x2C, 0x3A))
    _box(
        s, 0.7, 6.7, 12, 0.65,
        ["Slides to teach from     ·     100-mark question paper     ·     Full memorandum"],
        size=16, color=RGBColor(0xF4, 0xE2, 0xC4), anchor="middle", spacing=0,
    )
    _notes(s, (
        "Open the slideshow and switch on Presenter View (Slide Show, then Presenter View, "
        "or Alt+F5). You will see this script. They should see only the slide. "
        "Tell them this pack covers the whole Grade 9 year. You will not finish it in one sitting. "
        "Five short sessions work better than one long one."
    ))


def slide_section(prs, kicker, title, subtitle, page, total):
    s = _new(prs)
    _rect(s, 0, 0, 13.333, 7.5, TEAL)
    _rect(s, 0, 0, 0.18, 7.5, AMBER)
    _box(s, 0.75, 2.05, 11, 0.4, [kicker], size=16, color=AMBER_BG, bold=True, spacing=0)
    _box(s, 0.75, 2.5, 11.5, 1.6, [title], size=40, color=WHITE, bold=True, spacing=0)
    _box(s, 0.75, 4.3, 11, 1.2, [subtitle], size=20, color=WHITE, spacing=0)
    _footer(s, "Grade 9 Mathematics  ·  CAPS final revision", page, total)
    _notes(s, f"Pause on this divider. Tell them the next block is {title}. One idea at a time.")


def slide_bullets(prs, term, title, items, notes, page, total, remember=None, tone="normal"):
    s = _new(prs)
    _rect(s, 0, 0, 13.333, 7.5, CREAM)
    _header_bar(s)
    _box(s, 0.5, 0.22, 12, 0.32, [term], size=13, color=TEAL, bold=True, spacing=0)
    _box(s, 0.48, 0.5, 12.3, 0.7, [title], size=30, color=NAVY, bold=True, spacing=0)
    top = 1.28
    if remember:
        _rect(s, 0.45, 6.22, 12.4, 0.88, AMBER_BG, radius=0.08)
        _rect(s, 0.45, 6.22, 0.1, 0.88, AMBER)
        _box(s, 0.7, 6.28, 11.95, 0.74, [("Remember", 12, True, AMBER), (remember, 15, False, INK)], spacing=1)
        body_h = 4.8
    else:
        body_h = 5.7
    _box(
        s, 0.5, top, 12.3, body_h,
        [("•  " + item, 18, False, INK) for item in items],
        spacing=6,
    )
    _footer(s, "Grade 9 Mathematics  ·  CAPS final revision", page, total)
    _notes(s, notes)


def slide_two(prs, term, title, left_title, left_items, right_title, right_items, notes, page, total, remember=None):
    s = _new(prs)
    _rect(s, 0, 0, 13.333, 7.5, CREAM)
    _header_bar(s)
    _box(s, 0.5, 0.22, 12, 0.32, [term], size=13, color=TEAL, bold=True, spacing=0)
    _box(s, 0.48, 0.48, 12.3, 0.55, [title], size=26, color=NAVY, bold=True, spacing=0)
    card_h = 4.55 if remember else 5.55
    _rect(s, 0.4, 1.18, 6.2, card_h, WHITE, line=RGBColor(0xE1, 0xE6, 0xE3), radius=0.06)
    _rect(s, 6.75, 1.18, 6.2, card_h, WHITE, line=RGBColor(0xE1, 0xE6, 0xE3), radius=0.06)
    _box(s, 0.55, 1.28, 5.9, 0.36, [left_title], size=15, color=TEAL, bold=True, spacing=0)
    _box(s, 0.55, 1.68, 5.85, card_h - 0.62, [("•  " + i, 14, False, INK) for i in left_items], spacing=3)
    _box(s, 6.9, 1.28, 5.9, 0.36, [right_title], size=15, color=TEAL, bold=True, spacing=0)
    _box(s, 6.9, 1.68, 5.85, card_h - 0.62, [("•  " + i, 14, False, INK) for i in right_items], spacing=3)
    if remember:
        _rect(s, 0.4, 5.88, 12.55, 1.18, TEAL_BG, radius=0.08)
        _box(s, 0.6, 6.0, 12.15, 0.94, [(remember, 15, False, INK)], anchor="middle", spacing=0)
    _footer(s, "Grade 9 Mathematics  ·  CAPS final revision", page, total)
    _notes(s, notes)


def slide_try(prs, term, title, questions, minutes, notes, page, total):
    s = _new(prs)
    _rect(s, 0, 0, 13.333, 7.5, CREAM)
    _header_bar(s)
    _box(s, 0.5, 0.22, 8, 0.32, [term], size=13, color=TEAL, bold=True, spacing=0)
    _box(s, 8.3, 0.22, 4.5, 0.32, [f"Pause  ·  {minutes} quiet minutes"],
         size=13, color=AMBER, bold=True, align=PP_ALIGN.RIGHT, spacing=0)
    _box(s, 0.48, 0.52, 12.3, 0.6, [title], size=30, color=NAVY, bold=True, spacing=0)
    _rect(s, 0.5, 1.4, 12.35, 5.0, WHITE, line=RGBColor(0xE4, 0xD3, 0xB0), radius=0.06)
    _box(s, 0.75, 1.6, 11.9, 4.6, [(q, 22, False, INK) for q in questions], spacing=14)
    _footer(s, "Grade 9 Mathematics  ·  CAPS final revision", page, total)
    _notes(s, notes)


def slide_answers(prs, term, title, lines, notes, page, total):
    s = _new(prs)
    _rect(s, 0, 0, 13.333, 7.5, CREAM)
    _header_bar(s)
    _box(s, 0.5, 0.22, 12, 0.32, [term + "   ·   click only after they have tried"],
         size=13, color=GREEN, bold=True, spacing=0)
    _box(s, 0.48, 0.52, 12.3, 0.6, [title], size=30, color=NAVY, bold=True, spacing=0)
    _rect(s, 0.5, 1.35, 12.35, 5.15, GREEN_BG, radius=0.06)
    _box(s, 0.75, 1.55, 11.9, 4.8, [(ln, 20, False, INK) for ln in lines], spacing=10)
    _footer(s, "Grade 9 Mathematics  ·  CAPS final revision", page, total)
    _notes(s, notes)


def slide_table(prs, term, title, headers, rows, notes, page, total, caption=None):
    s = _new(prs)
    _rect(s, 0, 0, 13.333, 7.5, CREAM)
    _header_bar(s)
    _box(s, 0.5, 0.22, 12, 0.32, [term], size=13, color=TEAL, bold=True, spacing=0)
    _box(s, 0.48, 0.5, 12.3, 0.55, [title], size=28, color=NAVY, bold=True, spacing=0)
    n_rows = 1 + len(rows)
    n_cols = len(headers)
    top = 1.35
    height = 5.15 if caption else 5.5
    table_shape = s.shapes.add_table(n_rows, n_cols, Inches(0.5), Inches(top), Inches(12.35), Inches(height))
    table = table_shape.table
    for j, head in enumerate(headers):
        cell = table.cell(0, j)
        cell.text = ""
        cell.fill.solid()
        cell.fill.fore_color.rgb = NAVY
        cell.vertical_anchor = MSO_ANCHOR.MIDDLE
        p = cell.text_frame.paragraphs[0]
        p.alignment = PP_ALIGN.LEFT
        run = p.add_run()
        run.text = head
        run.font.name = "Calibri"
        run.font.size = Pt(15)
        run.font.bold = True
        run.font.color.rgb = WHITE
        cell.text_frame.margin_left = Inches(0.1)
    for i, row in enumerate(rows):
        for j, value in enumerate(row):
            cell = table.cell(i + 1, j)
            cell.text = ""
            cell.fill.solid()
            cell.fill.fore_color.rgb = WHITE if i % 2 else TEAL_BG
            cell.vertical_anchor = MSO_ANCHOR.MIDDLE
            p = cell.text_frame.paragraphs[0]
            run = p.add_run()
            run.text = value
            run.font.name = "Calibri"
            run.font.size = Pt(15)
            run.font.bold = j == 0
            run.font.color.rgb = NAVY if j == 0 else INK
            cell.text_frame.margin_left = Inches(0.1)
            cell.text_frame.margin_right = Inches(0.08)
    if caption:
        _box(s, 0.5, 6.55, 12.3, 0.5, [caption], size=14, color=MUTED, spacing=0)
    _footer(s, "Grade 9 Mathematics  ·  CAPS final revision", page, total)
    _notes(s, notes)


def slide_close(prs, page, total):
    s = _new(prs)
    _rect(s, 0, 0, 13.333, 7.5, NAVY)
    _rect(s, 0, 0, 0.18, 7.5, AMBER)
    _box(s, 0.7, 0.45, 12, 0.4, ["BEFORE THE EXAM"], size=14, color=AMBER, bold=True, spacing=0)
    _box(s, 0.7, 0.9, 12, 0.7, ["You have covered the year if you can do these"],
         size=28, color=WHITE, bold=True, spacing=0)
    items = [
        "Sort a number, and find an HCF, an LCM, a rate and a yearly compound amount.",
        "Use the exponent laws, including a zero power and a negative power.",
        "Expand, factorise fully, and solve, including a product that equals zero.",
        "Write a general term, and read the gradient and both intercepts of a straight line.",
        "Give a geometry reason, use Pythagoras, and find an area and a volume.",
        "Move a point: translate it, or reflect it in an axis or in the line y = x.",
    ]
    _box(s, 0.7, 1.85, 12, 3.6, [("•  " + item, 18, False, WHITE) for item in items], spacing=10)
    _box(
        s, 0.7, 5.7, 12, 1.2,
        [
            "Then write the question paper once, timed, with every line of working.",
            "Mark it the next morning from the memorandum. Redo only the questions you missed.",
        ],
        size=16, color=RGBColor(0xD7, 0xE6, 0xE4), spacing=4,
    )
    _notes(s, (
        "End by asking each sibling which single skill still feels shaky. That is the next "
        "15 minutes. Do not restart the whole pack. Hand them the question paper only. "
        "Keep the memorandum until they have written."
    ))


def build_slides():
    prs = Presentation()
    prs.slide_width = Inches(13.333333)
    prs.slide_height = Inches(7.5)
    prs.core_properties.title = "Grade 9 Mathematics — final exam teaching pack"
    prs.core_properties.subject = "CAPS Grade 9 Mathematics, Terms 1 to 4"
    prs.core_properties.category = "Study material"
    prs.core_properties.keywords = "CAPS, Grade 9, Mathematics, Platinum, ATP 2025"

    # Build content first so the footer can show the real total.
    # Slides are created in order below; we count by constructing a plan list of callables
    # after a dummy pass is unnecessary if we pre-count. The plan length is fixed here.
    plan = _slide_plan()
    total = len(plan)
    for index, builder in enumerate(plan, start=1):
        builder(prs, index, total)
    prs.save(SLIDES_PATH)
    return total


def _slide_plan():
    T1 = "TERM 1"
    T2 = "TERM 2"
    T3 = "TERM 3"
    T4 = "TERM 4"
    ALL = "TERMS 1 TO 4"

    def title(prs, page, total):
        slide_title(prs)

    def how(prs, page, total):
        slide_bullets(
            prs, "HOW TO USE THIS PACK", "Three files, five sessions",
            [
                "These slides teach the idea, then a worked example. The notes underneath are your script.",
                "The question paper is different from the examples here, so the practice stays honest.",
                "The memorandum is for you. Give it to them only after they have written the paper.",
                "Do about 10 to 12 slides in a session, then stop and practise. One afternoon cannot hold the whole year.",
                "In Presenter View you see the script. They see only the slide.",
            ],
            "Say: we learn a rule, we do one together, you try one alone, then we mark it. "
            "If a try-slide appears, pause the show and give them the quiet minutes on the slide. "
            "Do not click the answer slide early.",
            page, total,
            remember="A calculator is allowed on the practice paper. Working still earns marks, so they must show it.",
        )

    def map_year(prs, page, total):
        slide_table(
            prs, "THE YEAR AT A GLANCE", "What the final exam is built from",
            ["Term", "Teach these topics", "Platinum chapters"],
            [
                ["1", "Whole numbers, integers, exponents, algebraic language", "1, 2 and 5, then 8"],
                ["2", "Factorising, equations, functions, straight-line graphs", "8, 9, 16, 17 and 18"],
                ["3", "Angles, triangles, quadrilaterals, area, volume", "11, 12, 14 and 19"],
                ["4", "Transformations, number patterns, revision of the year", "6, 7, 15 and 20"],
            ],
            "The 2025 DBE Annual Teaching Plan uses this order. Platinum prints some of the same chapters "
            "in a different week. Follow the topic name, then the contents page of their book. "
            "Pythagoras is Chapter 13 and is used all year. Data and probability are Chapters 22 to 25. "
            "Ask the teacher whether those two are on the school paper. These slides still teach them.",
            page, total,
            caption="Chapter numbers are the usual Platinum Mathematics Grade 9 contents. If a print differs, use the chapter title.",
        )

    def marks(prs, page, total):
        slide_bullets(
            prs, "HOW MARKS ARE EARNED", "The marker is on their side if the working is visible",
            [
                "Write the first step. A wrong final answer can still earn the method marks.",
                "One equal sign per line. Do not squash a whole solution into one line.",
                "Put the unit on the answer: cm, cm², km/h, or rand.",
                "In geometry, every angle needs a reason, written in words.",
                "If an equation has two answers, give both. x = 0 counts.",
                "If you cancelled a denominator, say which values are not allowed.",
            ],
            "Show them that a 3-mark question can still give 1 or 2 marks when the last line is wrong. "
            "That lowers panic. Then say the opposite is also true: a correct answer with no working is "
            "risky once the question is worth more than 1 mark.",
            page, total,
            remember="Check an equation by substituting the answer back into the original line.",
        )

    def sec_numbers(prs, page, total):
        slide_section(
            prs, "TERM 1", "Numbers",
            "The number system, factors, ratio, rate and money.",
            page, total,
        )

    def number_system(prs, page, total):
        slide_bullets(
            prs, T1, "The number system",
            [
                "Natural numbers: 1, 2, 3, 4, …  In Platinum these are the counting numbers, starting at 1.",
                "Whole numbers: the natural numbers and 0.",
                "Integers: … −3, −2, −1, 0, 1, 2, 3 …",
                "Rational numbers: any number that can be written as a fraction of integers. Examples: ½, −4, 0,75 and 0,333…",
                "Irrational numbers cannot be written as a fraction of integers. Examples: √2, √5 and π.",
                "A number belongs to every family above its most precise one. 4 is natural, whole, an integer and rational.",
            ],
            "Ask where √9 belongs before you tell them. Many say irrational because they see a root sign. "
            "The root sign does not decide. √9 = 3, so it is a natural number. √2 does not simplify, so it is irrational. "
            "If their teacher counts 0 as a natural number, follow the teacher. Platinum treats 0 as a whole number that is not natural.",
            page, total,
            remember="Name the most precise family. 0 is a whole number. −8 is an integer. 2/9 is rational. √7 is irrational.",
        )

    def hcf(prs, page, total):
        slide_two(
            prs, T1, "Prime factors, HCF and LCM",
            "Break the number down",
            [
                "A factor divides exactly. A multiple is the result of multiplying.",
                "A prime has exactly two factors: 1 and itself.",
                "60 = 2 × 2 × 3 × 5 = 2² × 3 × 5.",
                "Keep dividing by 2, then 3, then 5, and so on.",
            ],
            "HCF and LCM of 36 and 48",
            [
                "36 = 2² × 3²",
                "48 = 2⁴ × 3",
                "HCF uses each common prime at the lower power.",
                "HCF = 2² × 3 = 12",
                "LCM uses every prime at the higher power.",
                "LCM = 2⁴ × 3² = 144",
            ],
            "Point at the twos: the powers are 2 and 4. The lower power goes into the HCF. The higher power goes into the LCM. "
            "Check: HCF × LCM should equal the product of the two numbers. 12 × 144 = 1 728 and 36 × 48 = 1 728.",
            page, total,
            remember="Lower power for the HCF. Higher power for the LCM.",
        )

    def ratio(prs, page, total):
        slide_two(
            prs, T1, "Ratio, rate and proportion",
            "Ratio and rate",
            [
                "A ratio compares the same kind of unit. 15 girls to 10 boys is 3 : 2.",
                "Simplify a ratio the way you simplify a fraction.",
                "A rate compares different units.",
                "Speed = distance ÷ time.",
                "Price per kilogram is also a rate.",
            ],
            "Direct or indirect",
            [
                "Direct: both grow together. More kilograms cost more rands.",
                "4 kg costs R50, so 10 kg costs 10/4 × 50 = R125.",
                "Indirect: one grows, the other shrinks. More workers, fewer days.",
                "5 pumps take 6 hours. The job is 5 × 6 = 30 pump-hours.",
                "3 pumps take 30 ÷ 3 = 10 hours.",
            ],
            "Ask one question before they calculate: if I add more workers, does the time go up or down? "
            "Down means indirect. If I buy more, does the cost go up? Up means direct. "
            "Changing minutes into hours matters: 2 hours 15 minutes is 2,25 hours, not 2,15 hours.",
            page, total,
            remember="Direct: divide and multiply. Indirect: multiply the two given amounts, then divide by the new one.",
        )

    def money(prs, page, total):
        slide_bullets(
            prs, T1, "Percentages, commission, rentals and compound interest",
            [
                "8% of R2 400 = 0,08 × 2 400 = R192. The percent sign means ‘out of 100’.",
                "Commission is a percentage of the sales. 6% commission on R9 000 is 0,06 × 9 000 = R540.",
                "A rental is a rate times the time. R400 per day for 3 days is R1 200.",
                "Yearly compound interest: A = P(1 + r)ⁿ. P starts, r is the yearly rate as a decimal, n is the number of years.",
                "R3 000 at 5% per year for 2 years: 3 000 × 1,05 = 3 150, then 3 150 × 1,05 = R3 307,50.",
                "The same result: 3 000 × (1,05)² = R3 307,50. The interest earned is R307,50.",
            ],
            "The mistake is typing 1,5 instead of 1,05. Five percent is 5/100 = 0,05, so the growth factor is 1,05. "
            "This Grade 9 version compounds once a year. Do not divide by 12 unless the question says monthly. "
            "The year-by-year method and the formula are both accepted.",
            page, total,
            remember="r is the decimal. 10% means multiply by 1,10 each year, not by 10.",
        )

    def try_numbers(prs, page, total):
        slide_try(
            prs, T1, "Try this before the next slide",
            [
                "1.   Is √16 rational or irrational? Give the reason in one sentence.",
                "2.   Find the HCF and the LCM of 12 and 18.",
                "3.   6 workers build a wall in 4 days. How many days will 8 workers take?",
                "4.   R1 500 is invested at 10% per year, compounded yearly, for 2 years. Find A.",
            ],
            5,
            "Give them five quiet minutes. Walk past question 3. The usual slip is to treat the workers as direct proportion and get a larger number of days.",
            page, total,
        )

    def ans_numbers(prs, page, total):
        slide_answers(
            prs, T1, "Answers to the number questions",
            [
                "1.   Rational. √16 = 4, and 4 is a whole number.",
                "2.   12 = 2² × 3 and 18 = 2 × 3². HCF = 6. LCM = 36.",
                "3.   Indirect. 6 × 4 = 24 worker-days. 24 ÷ 8 = 3 days.",
                "4.   1 500 × (1,10)² = 1 500 × 1,21 = R1 815.",
            ],
            "If question 3 became 8 days, they multiplied instead of using the constant product. "
            "Redo that one sentence: more workers, fewer days.",
            page, total,
        )

    def sec_exp(prs, page, total):
        slide_section(prs, "TERM 1", "Integers and exponents",
                      "Signs, powers, and the exponent laws up to a negative power.", page, total)

    def integers(prs, page, total):
        slide_two(
            prs, T1, "Integer rules",
            "Add, subtract, multiply, divide",
            [
                "Same signs when adding: add, and keep the sign. −7 + (−4) = −11.",
                "Different signs: subtract, and keep the sign of the larger amount. −7 + 4 = −3.",
                "Subtracting is adding the opposite. 5 − (−2) = 5 + 2 = 7.",
                "Same signs when multiplying or dividing give a positive answer.",
                "Different signs give a negative answer. (−4) × 5 = −20.",
                "An odd count of negative factors gives a negative answer.",
            ],
            "Powers, roots and properties",
            [
                "(−3)² = 9, but −3² = −(3²) = −9. The brackets change the answer.",
                "(−3)³ = −27. A negative base to an odd power stays negative.",
                "√49 = 7. ∛(−8) = −2.",
                "Commutative: a + b = b + a, and a × b = b × a.",
                "Associative: the grouping can change when only adding, or only multiplying.",
                "Distributive: a(b + c) = ab + ac. Division by 0 is undefined.",
            ],
            "Write (−3)² and −3² on paper, side by side, before you move on. This one bracket loses marks in integers and again in substitution. "
            "Identity elements: adding 0 changes nothing, multiplying by 1 changes nothing. The additive inverse of 5 is −5.",
            page, total,
            remember="Count the negative signs when multiplying. Odd count: negative. Even count: positive.",
        )

    def integer_worked(prs, page, total):
        slide_bullets(
            prs, T1, "Worked example: integers",
            [
                "Calculate  −4 × (−3 + 5) − (−18) ÷ (−3).",
                "Bracket first: −3 + 5 = 2.",
                "Then multiply and divide: −4 × 2 = −8, and (−18) ÷ (−3) = 6.",
                "The expression is now −8 − 6 = −14.",
                "Second one: (−2)³ + √36 = −8 + 6 = −2.",
                "Order: brackets, then powers and roots, then × and ÷ from left to right, then + and −.",
            ],
            "Say the order out loud while you point. The minus between the product and the quotient is a subtraction of 6, so it is −8 − 6, which is −14.",
            page, total,
            remember="A positive divided by a negative, or a negative divided by a positive, is negative. Negative divided by negative is positive.",
        )

    def exponents(prs, page, total):
        slide_table(
            prs, T1, "Exponent laws",
            ["Law, for a ≠ 0", "In words", "Example"],
            [
                ["aᵐ × aⁿ = aᵐ⁺ⁿ", "Same base, multiply: add the powers", "2³ × 2⁴ = 2⁷ = 128"],
                ["aᵐ ÷ aⁿ = aᵐ⁻ⁿ", "Same base, divide: subtract the powers", "x⁹ ÷ x⁴ = x⁵"],
                ["(aᵐ)ⁿ = aᵐⁿ", "A power outside: multiply the powers", "(x³)² = x⁶"],
                ["(ab)ⁿ = aⁿbⁿ", "A power over a product reaches each factor", "(2y)³ = 8y³"],
                ["a⁰ = 1", "Any non-zero base to the power 0 is 1", "5⁰ = 1"],
                ["a⁻ⁿ = 1 / aⁿ", "A negative power is a reciprocal", "2⁻³ = 1/8"],
            ],
            "Repeat one sentence: a negative exponent sends the base downstairs, and the power becomes positive. "
            "It does not make the answer negative. 2⁻³ = 1/8, which is positive. "
            "Different bases do not combine: 2³ × 3² = 8 × 9 = 72. You cannot add those powers.",
            page, total,
        )

    def exp_worked(prs, page, total):
        slide_bullets(
            prs, T1, "Worked example: exponents",
            [
                "(x³)² × x⁻⁴ = x⁶ × x⁻⁴ = x².",
                "12a⁵b² ÷ 3a²b⁵ = 4 a³ b⁻³ = 4a³ / b³.",
                "(2x⁻¹y²)³ = 8 x⁻³ y⁶ = 8y⁶ / x³.",
                "0,00072 = 7,2 × 10⁻⁴. The first number must be from 1 up to, but not including, 10.",
                "45 000 = 4,5 × 10⁴. Move the comma until one non-zero digit sits in front of it.",
                "On the second line, b²⁻⁵ = b⁻³. Top power minus bottom power, even when the result is negative.",
            ],
            "Learners often subtract ‘the bigger power minus the smaller power’ and then guess the sign. "
            "Write the rule as top minus bottom. If the bottom power is larger, the answer has the base in the denominator.",
            page, total,
            remember="Scientific notation: one digit before the comma, then × 10 to a power.",
        )

    def try_exp(prs, page, total):
        slide_try(
            prs, T1, "Try this before the next slide",
            [
                "1.   Calculate (−5)² and −5².",
                "2.   Simplify (3a²)³.",
                "3.   Calculate 2⁻¹ + 4⁰.",
                "4.   Write 45 000 in scientific notation.",
            ],
            4,
            "Question 1 is the bracket test again. Stay quiet while they do it. If both answers come out as 25, stop and redo the bracket before algebra starts.",
            page, total,
        )

    def ans_exp(prs, page, total):
        slide_answers(
            prs, T1, "Answers to the exponent questions",
            [
                "1.   (−5)² = 25 and −5² = −25.",
                "2.   3³ × a⁶ = 27a⁶.",
                "3.   1/2 + 1 = 3/2.",
                "4.   4,5 × 10⁴.",
            ],
            "On question 3, 4⁰ is 1, not 0. 2⁻¹ is 1/2, not −2.",
            page, total,
        )

    def sec_alg(prs, page, total):
        slide_section(prs, "TERMS 1 AND 2", "Algebra",
                      "Language, expanding, factorising, fractions and equations.", page, total)

    def language(prs, page, total):
        slide_bullets(
            prs, T1, "The language of an expression",
            [
                "7x² − 4x + 3 has three terms, so it is a trinomial. The sign in front belongs to the term.",
                "The terms are +7x², −4x and +3.",
                "Coefficient of x²: 7. Coefficient of x: −4. Constant term: +3. Exponent of x in the first term: 2.",
                "Like terms have the same variables and the same exponents. 3x² and −x² are like terms. 3x² and 3x are not.",
                "Monomial: one term, such as 5x². Binomial: two terms, such as x + 4.",
                "An expression has no equal sign. An equation has an equal sign. Keep those words apart.",
            ],
            "Ask them to box each term, sign included. −4x is one term. If they box only 4x, later lines will drop the minus.",
            page, total,
            remember="The sign in front of a term is part of that term.",
        )

    def simplify(prs, page, total):
        slide_two(
            prs, T1, "Simplify, multiply and expand",
            "Like terms and products",
            [
                "5x − 2y + x + 6y = 6x + 4y.",
                "Add the coefficients. Keep the variable as it is.",
                "(−3x²)(4xy) = −12x³y.",
                "Coefficients multiply. Powers of the same base add.",
                "20x⁴y ÷ 5xy² = 4x³ / y.",
                "Coefficients divide. Powers subtract.",
            ],
            "Brackets",
            [
                "−2(x − 5) = −2x + 10.",
                "The minus in front changes every sign inside.",
                "(x + 3)(x − 4) = x² − 4x + 3x − 12.",
                "Each term in the first bracket multiplies each term in the second.",
                "That simplifies to x² − x − 12.",
                "Four arrows, four products, then like terms.",
            ],
            "Use ‘every term by every term’ rather than a shortcut name, unless they already use FOIL at school. "
            "Draw the four arrows on paper for the two brackets.",
            page, total,
            remember="A minus in front of a bracket changes the sign of every term inside it.",
        )

    def fractions_alg(prs, page, total):
        slide_bullets(
            prs, T1, "Fractions and decimals inside algebra",
            [
                "The teaching plan asks for fractions and decimals inside expressions, not as a separate term test.",
                "½x + ⅓x = ³⁄₆x + ²⁄₆x = ⁵⁄₆x. Add the tops only after the bottoms match.",
                "½ + ⅓ is not ²⁄₅. Adding the bottoms is the usual error.",
                "2,5x − 0,5x = 2x. Decimal coefficients add and subtract like ordinary decimals.",
                "¾(8x − 4) = 6x − 3. Multiply the fraction by each term inside the bracket.",
                "Substitution still needs brackets. If x = −2, then x² − 3x = (−2)² − 3(−2) = 4 + 6 = 10.",
            ],
            "Do the fraction addition slowly on paper. Common denominator first. Then show the decimal one as the easier cousin of the same idea. "
            "Finish with the substitution, because a negative value is where a correct expression still loses the mark.",
            page, total,
            remember="When you substitute a negative number, put it in brackets.",
        )

    def squares(prs, page, total):
        slide_bullets(
            prs, T2, "The square of a binomial",
            [
                "(a + b)² = a² + 2ab + b².",
                "(a − b)² = a² − 2ab + b².",
                "The middle term is the one that gets dropped. (a + b)² is not a² + b².",
                "(2x + 5)² = (2x)² + 2(2x)(5) + 5² = 4x² + 20x + 25.",
                "(x − 3)² = x² − 6x + 9.",
                "You can also expand (x − 3)(x − 3) with four products and land on the same answer.",
            ],
            "Ask them to expand (x + 4)² both ways: with the pattern, and with two brackets. The answers must match. "
            "If they get x² + 16, write the four products out.",
            page, total,
            remember="Square the first, square the last, and put twice the product in the middle.",
        )

    def factor(prs, page, total):
        slide_bullets(
            prs, T2, "Factorise fully, in this order",
            [
                "Take out a common factor first. 6x² − 9x = 3x(2x − 3).",
                "Difference of squares: a² − b² = (a − b)(a + b). So x² − 25 = (x − 5)(x + 5).",
                "4x² − 9 = (2x − 3)(2x + 3). There is a minus between the squares, and no middle term.",
                "x² + 25 does not factorise this way. The sign between the squares has to be minus.",
                "Trinomial: find two numbers that multiply to the last number and add to the middle number.",
                "x² + 5x + 6 = (x + 2)(x + 3). And x² + x − 6 = (x + 3)(x − 2).",
                "If a number sits in front of x², take it out first. 2x² + 10x + 12 = 2(x² + 5x + 6) = 2(x + 2)(x + 3).",
            ],
            "‘Fully’ means the common number must come out and the brackets must be finished. "
            "2(x² + 5x + 6) is only halfway. Check a trinomial by multiplying the brackets back.",
            page, total,
            remember="Common factor first. Then look for two squares with a minus, or for a trinomial.",
        )

    def alg_fractions(prs, page, total):
        slide_bullets(
            prs, T2, "Algebraic fractions",
            [
                "Factorise first. Cancel factors only. A factor is a whole bracket or a whole term that multiplies.",
                "(x² − 9) / (x + 3) = (x − 3)(x + 3) / (x + 3) = x − 3, provided x ≠ −3.",
                "The restriction matters: the original bottom becomes 0 when x = −3, and division by 0 is undefined.",
                "(6x² + 3x) / 3x = 3x(2x + 1) / 3x = 2x + 1, provided x ≠ 0.",
                "You may not cancel the 3 in (x + 3) against a 3 that is only part of the top.",
                "If nothing cancels after factorising, the fraction is already in its simplest form.",
            ],
            "Write the forbidden value on the same line as the simplified answer. "
            "A correct x − 3 with no restriction can lose a mark on a 2-mark question.",
            page, total,
            remember="Cancel matching factors. Then write the value that would have made the bottom zero.",
        )

    def factor_worked(prs, page, total):
        slide_answers(
            prs, T2, "Worked set: factorise or simplify",
            [
                "1.   4x² − 12x = 4x(x − 3)",
                "2.   9y² − 1 = (3y − 1)(3y + 1)",
                "3.   x² − 2x − 8 = (x − 4)(x + 2), because −4 × 2 = −8 and −4 + 2 = −2",
                "4.   (x² − 1) / (x − 1) = x + 1, with x ≠ 1",
            ],
            "Do these on paper first and let them compare. Question 3 is the one to talk through: the two numbers must multiply to −8 and add to −2.",
            page, total,
        )

    def equations(prs, page, total):
        slide_bullets(
            prs, T2, "Solving equations",
            [
                "An equation stays balanced. What you do on one side, do on the other.",
                "x + 7 = 2 gives x = −5. Adding a negative is allowed. The answer can be negative.",
                "4x = −12 gives x = −3.",
                "3x − 4 = 11 gives 3x = 15, so x = 5.",
                "Expand brackets first. 2(x + 3) = x − 1 becomes 2x + 6 = x − 1, so x = −7.",
                "Check: 2(−7 + 3) = −8, and −7 − 1 = −8. The answer works.",
            ],
            "Use the sentence their teacher uses, either ‘do the same to both sides’ or ‘move it across and change the sign’. "
            "Stay with one of those for the whole session. Always finish with a check on this slide’s last example.",
            page, total,
            remember="Expand brackets before you start moving terms.",
        )

    def product_zero(prs, page, total):
        slide_two(
            prs, T2, "A product equal to zero, and a word problem",
            "If a product is zero",
            [
                "(x − 4)(x + 1) = 0",
                "Then x − 4 = 0 or x + 1 = 0.",
                "x = 4 or x = −1.",
                "x² − 5x = 0",
                "Factorise: x(x − 5) = 0.",
                "x = 0 or x = 5. Do not divide by x. That drops the answer 0.",
            ],
            "Turn the sentence into algebra",
            [
                "A number added to 11 gives twice the number.",
                "Let the number be x.",
                "x + 11 = 2x",
                "11 = x",
                "Check: 11 + 11 = 22, and twice 11 is 22.",
                "Write the sentence in symbols before you solve.",
            ],
            "The word ‘or’ is part of the answer. One value, on a product question, is only half the marks. "
            "Dividing x² − 5x = 0 by x is the error to act out: pretend to divide, cross out x = 0, and show the lost mark.",
            page, total,
            remember="A product of factors equals zero only when at least one factor is zero.",
        )

    def try_alg(prs, page, total):
        slide_try(
            prs, T2, "Try this before the next slide",
            [
                "1.   Simplify −3(x − 2) + 4x.",
                "2.   Expand (x − 5)².",
                "3.   Factorise x² − 9 and x² + 6x + 8.",
                "4.   Solve x² − 4x = 0.",
            ],
            6,
            "Six minutes. On question 4, look for the second answer. If they only write x = 4, ask what happened to the common factor x.",
            page, total,
        )

    def ans_alg(prs, page, total):
        slide_answers(
            prs, T2, "Answers to the algebra questions",
            [
                "1.   −3x + 6 + 4x = x + 6",
                "2.   x² − 10x + 25",
                "3.   (x − 3)(x + 3) and (x + 2)(x + 4)",
                "4.   x(x − 4) = 0, so x = 0 or x = 4",
            ],
            "Question 2 fails when the middle term is missing. Question 4 fails when x = 0 is missing.",
            page, total,
        )

    def sec_graphs(prs, page, total):
        slide_section(prs, "TERMS 2 AND 4", "Patterns, functions and graphs",
                      "Number patterns, input and output, and the straight line.", page, total)

    def patterns(prs, page, total):
        slide_bullets(
            prs, T4, "Number patterns",
            [
                "If the difference is constant, the rule is linear. Pattern: 7; 11; 15; 19; … The difference is 4.",
                "Write Tₙ = 4n + c. The first term says 4(1) + c = 7, so c = 3. Therefore Tₙ = 4n + 3.",
                "Test it. n = 2 gives 11. n = 3 gives 15. Term 20 is 4(20) + 3 = 83.",
                "Which term equals 63? 4n + 3 = 63, so 4n = 60 and n = 15. It is the 15th term.",
                "A constant ratio is geometric. 5; 10; 20; 40; … multiplies by 2. Tₙ = 5 × 2ⁿ⁻¹.",
                "If the first differences change but the second difference is constant, the rule uses n². Example: 2, 6, 12, 20 is Tₙ = n(n + 1).",
            ],
            "They must test a new rule on the first term and the second term before they trust it. "
            "The quadratic example is the stretch version. Use it if the linear rule is already secure.",
            page, total,
            remember="Constant difference d means Tₙ = dn + c. Use term 1 to find c, then test term 2.",
        )

    def functions(prs, page, total):
        slide_bullets(
            prs, T2, "Input, output and equivalent forms",
            [
                "The same rule can be a flow diagram, a table, a formula, an equation or a graph.",
                "Rule: output = 2 × input + 3.",
                "Input −1 gives output 1. Input 0 gives output 3. Input 4 gives output 11.",
                "If the output is 17, solve 2x + 3 = 17. Then x = 7. Finding an input means solving an equation.",
                "On a graph, the input is usually x and the output is usually y.",
                "If a table and a formula disagree on two rows, one of them is wrong. Check two rows, not one.",
            ],
            "Say the link out loud: input is x, output is y. The next slide should feel like the same topic, not a new subject.",
            page, total,
            remember="Output given, input missing: write the equation and solve it.",
        )

    def lines(prs, page, total):
        slide_two(
            prs, T2, "The straight line  y = mx + c",
            "Read the equation",
            [
                "m is the gradient. It is the change in y when x increases by 1.",
                "c is the y-intercept, the point (0; c).",
                "Positive m rises as you read left to right. Negative m falls.",
                "A larger |m| is a steeper line.",
                "For y = −2x + 8, the gradient is −2 and the y-intercept is 8.",
                "x-intercept: put y = 0. Then x = 4, the point (4; 0).",
            ],
            "Build the equation",
            [
                "Two points fix the line. Use (1; 3) and (3; 7).",
                "m = (7 − 3) / (3 − 1) = 2.",
                "y = 2x + c.",
                "Substitute (1; 3): 3 = 2(1) + c, so c = 1.",
                "The equation is y = 2x + 1.",
                "Gradient is change in y over change in x, in that order.",
            ],
            "South African coordinate pairs use a semicolon: (x; y). "
            "The upside-down gradient, change in x over change in y, is the error to catch. Write the fraction in words first: vertical change over horizontal change.",
            page, total,
            remember="y-intercept: x = 0. x-intercept: y = 0.",
        )

    def draw_line(prs, page, total):
        slide_bullets(
            prs, T2, "Drawing a line from its equation",
            [
                "Use y = ½x − 1.",
                "y-intercept: (0; −1).",
                "x-intercept: 0 = ½x − 1, so x = 2. The point is (2; 0).",
                "Plot those two points. Join them with a ruler and extend the line a little past both.",
                "Check a third point. If x = 4, then y = 2 − 1 = 1. The point (4; 1) must sit on the same line.",
                "If the gradient is a fraction, choose x-values that cancel it. For ½, choose even x-values.",
            ],
            "Draw this one on grid paper with them. Two points are enough to draw. The third point is the check, not a decoration.",
            page, total,
            remember="Intercept method: find (0; c) and the x-intercept, then rule the line.",
        )

    def try_graphs(prs, page, total):
        slide_try(
            prs, "PATTERNS AND GRAPHS", "Try this before the next slide",
            [
                "1.   The pattern is 6; 10; 14; …  Write Tₙ and find T₁₀.",
                "2.   For y = 3x − 6, write the gradient, the y-intercept and the x-intercept.",
                "3.   A line passes through (0; 2) and (2; 6). Write its equation.",
            ],
            6,
            "They can do question 3 from the y-intercept without the gradient formula, because x = 0 is already in the list of points. Praise that if you see it. Then show the gradient way as well.",
            page, total,
        )

    def ans_graphs(prs, page, total):
        slide_answers(
            prs, "PATTERNS AND GRAPHS", "Answers to the pattern and graph questions",
            [
                "1.   The difference is 4, so Tₙ = 4n + 2. Check: n = 1 gives 6. T₁₀ = 42.",
                "2.   Gradient 3, y-intercept −6, x-intercept 2.",
                "3.   m = (6 − 2) / (2 − 0) = 2, and c = 2, so y = 2x + 2.",
            ],
            "On question 2, the x-intercept comes from 0 = 3x − 6. If they say −6, they have named the y-intercept twice.",
            page, total,
        )

    def sec_geo(prs, page, total):
        slide_section(prs, "TERM 3", "Geometry and measurement",
                      "Angles, shapes, Pythagoras, area and volume.", page, total)

    def angles(prs, page, total):
        slide_two(
            prs, T3, "Angles on lines, including parallel lines",
            "True for any straight lines",
            [
                "Adjacent angles on a straight line add to 180°.",
                "Angles around a point add to 360°.",
                "Vertically opposite angles are equal. They are the facing angles in the X.",
                "Perpendicular lines meet at 90°.",
                "These reasons do not need the word parallel.",
            ],
            "Only if the lines are parallel",
            [
                "Corresponding angles are equal. Look for the F shape.",
                "Alternate angles are equal. Look for the Z shape.",
                "Co-interior angles add to 180°. Look for the C or U shape.",
                "Example: a transversal makes 65° with one of two parallel lines.",
                "Corresponding and alternate angles are 65°.",
                "The co-interior angle is 180° − 65° = 115°.",
            ],
            "If they cannot point to the F, the Z or the C on the diagram, they should not guess the reason. "
            "The size and the reason are separate marks. A correct 65° with no reason can lose the second mark.",
            page, total,
            remember="Write the size, then the reason, and name the parallel lines in that reason.",
        )

    def shapes(prs, page, total):
        slide_two(
            prs, T3, "Triangles and quadrilaterals",
            "Triangles",
            [
                "Equilateral: 3 equal sides, all angles 60°.",
                "Isosceles: at least two equal sides. The base angles are equal.",
                "Scalene: no equal sides.",
                "Acute: all angles below 90°. Right-angled: one angle 90°. Obtuse: one angle above 90°.",
                "Interior angles add to 180°.",
                "An exterior angle equals the sum of the two interior opposite angles.",
                "Exterior 120° and one remote interior 46°: the other remote interior is 74°.",
            ],
            "Quadrilaterals",
            [
                "Interior angles of a quadrilateral add to 360°.",
                "Parallelogram: opposite sides parallel and equal. Opposite angles equal.",
                "Rectangle: a parallelogram with four right angles. Diagonals are equal.",
                "Rhombus: all sides equal. Diagonals cross at right angles.",
                "Square: a rectangle with all sides equal.",
                "Kite: two pairs of adjacent equal sides.",
                "Trapezium in Platinum: exactly one pair of parallel sides.",
                "An n-sided polygon: interior sum (n − 2) × 180°.",
            ],
            "For the trapezium, match the definition their teacher used if it differs. Calculation questions usually just mark the parallel sides. "
            "The exterior-angle sentence is worth saying twice: it equals the sum of the two interior angles that are not next to it.",
            page, total,
        )

    def similar(prs, page, total):
        slide_two(
            prs, T3, "Congruent and similar triangles",
            "Congruent: same shape, same size",
            [
                "You do not need all six facts. One of these is enough.",
                "SSS: three sides.",
                "SAS: two sides and the included angle, the angle between them.",
                "ASA: two angles and a matching side.",
                "RHS: a right angle, the hypotenuse, and one other side.",
                "SAS is not ‘any two sides and any angle’.",
            ],
            "Similar: same shape, size may change",
            [
                "Matching angles are equal.",
                "Matching sides are in the same ratio.",
                "Sides 4, 5, 6 and sides 8, 10, 12 have scale factor 2.",
                "Those triangles are similar. They are not congruent.",
                "Scale factor = new side ÷ matching original side.",
                "A side of 6 cm matching a side of 15 cm gives scale factor 2,5.",
            ],
            "Draw the included angle for SAS so they can see it sitting between the two sides. "
            "For similar triangles, write the vertices in matching order before you make the fraction.",
            page, total,
            remember="Congruent means equal in every matching part. Similar means the same shape, with sides in proportion.",
        )

    def pythag(prs, page, total):
        slide_bullets(
            prs, T3, "Theorem of Pythagoras",
            [
                "In a right-angled triangle, a² + b² = c². The hypotenuse is the longest side. It sits opposite the right angle.",
                "Legs 6 cm and 8 cm: c² = 36 + 64 = 100, so c = 10 cm. This is the 3-4-5 triangle, doubled.",
                "If the hypotenuse is known, subtract. Hypotenuse 13, one leg 5: b² = 169 − 25 = 144, so b = 12 cm.",
                "The side you are finding must be on its own before you take the square root.",
                "Is 7, 8, 11 a right-angled triangle? 7² + 8² = 113 and 11² = 121. They are not equal, so no.",
                "If the square root is untidy and the question does not ask for a decimal, leave the answer in surd form.",
            ],
            "Act out the subtraction case. If the unknown side is a leg, it is the square of the hypotenuse minus the square of the known leg. "
            "Adding when they should subtract gives a side longer than the hypotenuse, which is impossible. Use that as the check.",
            page, total,
            remember="The hypotenuse is c. It is the longest side, opposite the right angle.",
        )

    def area(prs, page, total):
        slide_two(
            prs, T3, "Perimeter and area",
            "Formulae",
            [
                "Perimeter is the distance around. Area is the surface inside.",
                "Rectangle: P = 2(l + b), A = l × b.",
                "Triangle: A = ½ × base × perpendicular height.",
                "Parallelogram: A = base × perpendicular height.",
                "Trapezium: A = ½ × (sum of the parallel sides) × height.",
                "Circle: C = 2πr = πd, and A = πr².",
                "Use the value of π that the question gives.",
            ],
            "Worked circle, and a warning",
            [
                "Diameter 14 cm, and π = 22/7.",
                "Radius first: r = 7 cm.",
                "C = 2 × 22/7 × 7 = 44 cm.",
                "A = 22/7 × 49 = 154 cm².",
                "A compound shape: add the areas, or subtract a hole.",
                "The outside perimeter follows only the outside edges.",
                "Doubling the side of a square multiplies the area by 4.",
            ],
            "Stop on the radius line. Write r = d/2 before any formula. Using the diameter in πr² is the most common circle error. "
            "Also say the unit: length in cm, area in cm².",
            page, total,
            remember="If the question gives a diameter, halve it before you use r.",
        )

    def volume(prs, page, total):
        slide_bullets(
            prs, T3, "Surface area, volume and capacity",
            [
                "1 cm³ = 1 ml. 1 000 cm³ = 1 litre. 1 000 litres = 1 kl.",
                "Rectangular box: V = l × b × h. Surface area = 2(lb + lh + bh), the three pairs of faces.",
                "A box 6 cm by 4 cm by 2 cm: V = 48 cm³. SA = 2(24 + 12 + 8) = 88 cm².",
                "Triangular prism: volume = area of the triangle × the length of the prism.",
                "Its surface is two triangles plus three rectangles.",
                "Closed cylinder: V = πr²h, and SA = 2πr² + 2πrh. That is two circular lids plus the wrapped label.",
                "r = 7 cm, h = 5 cm, π = 22/7. V = 770 cm³. SA = 308 + 220 = 528 cm².",
            ],
            "Say ‘two lids plus the label’ for the cylinder. If the question says an open tin, there is only one circle. "
            "Read the word closed or open before you start. Volume does not change when the tin is open. Surface area does.",
            page, total,
            remember="Volume is space inside. Surface area is the material on the outside. They use different units.",
        )

    def try_geo(prs, page, total):
        slide_try(
            prs, T3, "Try this before the next slide",
            [
                "1.   The lines are parallel. An angle is 72°. Find the co-interior angle.",
                "2.   A triangle has angles x, 2x and 3x. Find each angle.",
                "3.   A right-angled triangle has legs 9 cm and 12 cm. Find the hypotenuse.",
                "4.   A box is 5 cm by 5 cm by 2 cm. Find the volume and the surface area.",
            ],
            6,
            "Question 2 should end with 30°, 60° and 90°. Ask what kind of triangle that is, once the sizes are known.",
            page, total,
        )

    def ans_geo(prs, page, total):
        slide_answers(
            prs, T3, "Answers to the geometry questions",
            [
                "1.   108°. Co-interior angles add to 180° because the lines are parallel.",
                "2.   6x = 180, so x = 30. The angles are 30°, 60° and 90°. It is a right-angled scalene triangle.",
                "3.   √(81 + 144) = √225 = 15 cm.",
                "4.   Volume = 50 cm³. Surface area = 2(25 + 10 + 10) = 90 cm².",
            ],
            "If the hypotenuse came out smaller than 12, they subtracted. The hypotenuse must be the longest side.",
            page, total,
        )

    def sec_term4(prs, page, total):
        slide_section(prs, "TERM 4", "Transformations, data and probability",
                      "Transformations are in the year plan. Data and probability are in Platinum.", page, total)

    def transform(prs, page, total):
        slide_table(
            prs, T4, "Transformations on the coordinate plane",
            ["Transformation", "Rule", "Image of B(−2; 5)"],
            [
                ["Translate 5 left and 2 up", "(x; y) → (x − 5; y + 2)", "(−7; 7)"],
                ["Reflect in the x-axis", "(x; y) → (x; −y)", "(−2; −5)"],
                ["Reflect in the y-axis", "(x; y) → (−x; y)", "(2; 5)"],
                ["Reflect in the line y = x", "(x; y) → (y; x)", "(5; −2)"],
                ["Rotate 180° about the origin", "(x; y) → (−x; −y)", "(2; −5)"],
                ["Enlarge by 2 from the origin", "(x; y) → (2x; 2y)", "(−4; 10)"],
            ],
            "The 2025 plan focuses on translation, reflection in the axes, and reflection in y = x. "
            "Platinum also teaches rotation and enlargement, and school papers often still ask for them, so they are on this slide. "
            "Memory line: reflect in x, change y. Reflect in y, change x. The line y = x swaps the coordinates. "
            "Left is a negative change in x. Down is a negative change in y.",
            page, total,
        )

    def transform_worked(prs, page, total):
        slide_bullets(
            prs, T4, "A triangle moved three ways",
            [
                "P(1; 2), Q(4; 2), R(1; 5).",
                "Reflect the triangle in the x-axis: P′(1; −2), Q′(4; −2), R′(1; −5).",
                "Translate it 2 units right and 3 units down: P′(3; −1), Q′(6; −1), R′(3; 2).",
                "Enlarge it by scale factor 2 from the origin: P′(2; 4), Q′(8; 4), R′(2; 10).",
                "The enlargement is similar to the original triangle, with scale factor 2.",
                "It is congruent to the original only if the scale factor is 1 or −1.",
            ],
            "Ask which coordinate changes before you reveal each image. Description first, numbers second. "
            "Plot the original and one image on the same set of axes if you have grid paper.",
            page, total,
            remember="Write the image with a prime, P′, so the original point and the image stay distinct.",
        )

    def data(prs, page, total):
        slide_bullets(
            prs, "PLATINUM CHAPTERS 22 TO 24", "Data handling, if the paper includes it",
            [
                "The 2025 national plan spends Term 4 on transformations, patterns and revision. Some schools still set the Platinum data chapters.",
                "Mean: add the values, then divide by how many there are.",
                "Median: the middle value after you sort. If two values share the middle, average them.",
                "Mode: the value that appears most. A list can have more than one mode.",
                "Range: highest minus lowest.",
                "For 3, 8, 5, 8, 6, sorted 3, 5, 6, 8, 8: mean 6, median 6, mode 8, range 5.",
                "A bar graph compares categories. A histogram compares number groups, and its bars touch. A pie chart is parts of 360°.",
            ],
            "They must sort before the median. Picking the middle of the unsorted list is the usual miss. "
            "This page is short on purpose. If the teacher has confirmed it is not on the paper, spend the time on algebra and geometry instead.",
            page, total,
            remember="Sort first. Then the median is the middle value of the sorted list.",
        )

    def probability(prs, page, total):
        slide_bullets(
            prs, "PLATINUM CHAPTER 25", "Probability, if the paper includes it",
            [
                "Probability = number of favourable outcomes ÷ number of possible outcomes.",
                "The answer is a fraction, a decimal or a percentage, from 0 to 1.",
                "0 means impossible. 1 means certain. A probability bigger than 1 is a signal to re-count.",
                "A bag has 4 red, 3 blue and 1 green counter. That is 8 counters.",
                "P(blue) = 3/8. P(not blue) = 5/8. Those two add to 1.",
                "P(yellow) = 0, because there are no yellow counters.",
                "If a counter is not replaced, the next draw has a new total. If it is replaced, the total stays the same.",
            ],
            "Simplify the fraction unless the question says not to. 4/8 should be written as 1/2. "
            "Expected number is probability times the number of trials. P(blue) = 3/8 and 80 trials gives 30 blues expected.",
            page, total,
            remember="A probability sits between 0 and 1, inclusive. P(event) + P(not the event) = 1.",
        )

    def formulas(prs, page, total):
        slide_two(
            prs, "COPY THIS BY HAND", "One formula page, in their own handwriting",
            "Numbers, algebra and graphs",
            [
                "a⁰ = 1 and a⁻ⁿ = 1/aⁿ",
                "A = P(1 + r)ⁿ, once a year",
                "speed = distance ÷ time",
                "Tₙ = dn + c",
                "y = mx + c",
                "m = (y₂ − y₁) / (x₂ − x₁)",
                "angles in a triangle = 180°",
                "exterior angle = sum of the two remote interiors",
            ],
            "Measurement",
            [
                "a² + b² = c²",
                "C = 2πr and A = πr²",
                "rectangle A = lb, triangle A = ½bh",
                "trapezium A = ½(a + b)h",
                "box V = lbh",
                "box SA = 2(lb + lh + bh)",
                "cylinder V = πr²h",
                "cylinder SA = 2πr² + 2πrh",
            ],
            "Most Grade 9 papers do not hand out a formula sheet. Copying this page by hand is the study task. "
            "A printed copy taken into the exam is only allowed if the teacher has said so.",
            page, total,
            remember="Write it tonight from memory, check it against this slide, then correct the lines you missed.",
        )

    def strategy(prs, page, total):
        slide_bullets(
            prs, "ON THE DAY", "A calm order of work",
            [
                "The night before: one formula page, one short mixed exercise, then sleep. A new topic at midnight does not stick.",
                "Read the paper for 3 minutes. Star the questions you can do, and do those first.",
                "Show working on a question you are unsure of. The first steps are often worth marks.",
                "In geometry, write the size and the reason on every line.",
                "A long question’s first part is often independent. Do that part even if the last part looks hard.",
                "Leave 10 minutes to check units, signs, and both answers of a product equation.",
                "On a 100-mark paper in 2 hours, a 4-mark question should take about 4 minutes. Then move on.",
            ],
            "Use the question paper in this pack as the timed practice. Questions 1 to 11 are the 2-hour paper. "
            "Question 12 is extra, for data and probability.",
            page, total,
            remember="Cross out a changed answer neatly. Do not scribble it into a mark the marker cannot read.",
        )

    def mistakes(prs, page, total):
        slide_two(
            prs, "CHECKLIST", "Mistakes that cost marks",
            "Algebra and numbers",
            [
                "Writing −3² when you meant (−3)².",
                "Adding powers when the bases are different.",
                "Treating a negative power as a negative answer.",
                "Cancelling terms in a fraction instead of factors.",
                "Dividing by x and losing the answer x = 0.",
                "Expanding (a + b)² as a² + b².",
            ],
            "Geometry, graphs and data",
            [
                "Using the diameter in πr².",
                "Writing cm on an area.",
                "An angle with no reason.",
                "A probability bigger than 1.",
                "Forgetting to sort before the median.",
                "A gradient calculated upside down.",
            ],
            "Pick the three mistakes you have actually seen them make, and drill those. A list of twelve in one evening is noise.",
            page, total,
        )

    def plan_sessions(prs, page, total):
        slide_table(
            prs, "FIVE SESSIONS", "A practical week",
            ["Session", "Slides and work", "Then do this in the book"],
            [
                ["1", "Numbers, integers, exponents", "Chapters 1, 2 and 5"],
                ["2", "Algebra: expand, factorise, solve", "Chapters 8, 9, 16 and 17"],
                ["3", "Patterns, functions and graphs", "Chapters 6, 7, 15 and 18"],
                ["4", "Geometry, Pythagoras, area, volume", "Chapters 11 to 14 and 19"],
                ["5", "Transformations, then the timed paper", "Chapter 20, then the question paper"],
            ],
            "If you only have two evenings, do Session 2 and Session 4, then the timed paper. "
            "Algebra and geometry carry a lot of the marks. Add Chapters 22 to 25 only if the teacher included data and probability. "
            "Mark the paper the next morning, not the same night. Redo only the questions they missed.",
            page, total,
            caption="If only two evenings remain: algebra, then geometry and measurement, then the timed paper.",
        )

    def sources(prs, page, total):
        slide_bullets(
            prs, "WHERE THIS COMES FROM", "So you can trust the topic list",
            [
                "The topics follow the Department of Basic Education CAPS for Senior Phase Mathematics.",
                "The term order follows the 2025 Grade 9 Mathematics Annual Teaching Plan.",
                "The chapter numbers follow the usual contents of Platinum Mathematics Grade 9.",
                "Every example and every question in this pack was written for these lessons.",
                "Nothing here is a copied Platinum exercise or a copied past paper.",
                "If the teacher’s outline and this pack ever disagree, follow the teacher for that item.",
            ],
            "You do not need to read this slide aloud in full. It is here so you know the pack is original and aligned, "
            "and so the siblings know to trust the teacher’s final instruction about data and probability.",
            page, total,
        )

    def closing(prs, page, total):
        slide_close(prs, page, total)

    return [
        title, how, map_year, marks,
        sec_numbers, number_system, hcf, ratio, money, try_numbers, ans_numbers,
        sec_exp, integers, integer_worked, exponents, exp_worked, try_exp, ans_exp,
        sec_alg, language, simplify, fractions_alg, squares, factor, alg_fractions,
        factor_worked, equations, product_zero, try_alg, ans_alg,
        sec_graphs, patterns, functions, lines, draw_line, try_graphs, ans_graphs,
        sec_geo, angles, shapes, similar, pythag, area, volume, try_geo, ans_geo,
        sec_term4, transform, transform_worked, data, probability,
        formulas, strategy, mistakes, plan_sessions, sources, closing,
    ]


# ---------------------------------------------------------------------------
# Question paper and memorandum
# ---------------------------------------------------------------------------

def verify_answers():
    """Catch arithmetic mistakes before they are printed."""
    assert 210 / 2.5 == 84
    assert abs(7 / 4 * 78 - 136.5) < 1e-9
    assert 6 * 8 / 4 == 12
    assert abs(4000 * (1.05 ** 2) - 4410) < 1e-6
    assert (-3) * (-4) * (-2) == -24
    assert -36 / 4 + (-2) ** 2 == -5
    assert 3 ** (-2) + 7 ** 0 == 1 / 9 + 1
    assert 20 ** 2 + 21 ** 2 == 29 ** 2
    assert abs(2 * 3.14 * 10 - 62.8) < 1e-9
    assert abs(3.14 * 100 - 314) < 1e-9
    assert abs((22 / 7) * 49 * 10 - 1540) < 1e-6
    for x in range(-5, 8):
        assert 5 * (x - 2) - 3 * (2 * x + 1) == -x - 13
        assert (2 * x - 3) ** 2 == 4 * x ** 2 - 12 * x + 9
        assert (x + 7) * (x - 3) == x ** 2 + 4 * x - 21
    assert [5 * n + 3 for n in (1, 2, 3, 4)] == [8, 13, 18, 23]
    assert 2 * 0 + (-2) == -2 and 2 * 3 + (-2) == 4
    ages = [12, 14, 14, 15, 15, 15, 16, 17, 18]
    assert sum(ages) == 136
    assert 136 / 9 == 136 / 9
    # Core paper marks, then the optional question.
    assert sum(q["marks"] for q in PAPER) == 100
    assert EXTRA["marks"] == 10


PAPER = [
    {
        "title": "Whole numbers",
        "marks": 8,
        "parts": [
            {
                "id": "1.1",
                "marks": 4,
                "text": "Choose the <b>most precise</b> description for each number. Write only the letter.",
                "extra": "A &nbsp;&nbsp; natural number<br/>B &nbsp;&nbsp; whole number, but not a natural number<br/>C &nbsp;&nbsp; integer, but not a whole number<br/>D &nbsp;&nbsp; rational, but not an integer<br/>E &nbsp;&nbsp; irrational<br/><br/>(a) &nbsp; 0 &nbsp;&nbsp;&nbsp; (b) &nbsp; −11 &nbsp;&nbsp;&nbsp; (c) &nbsp; 2/9 &nbsp;&nbsp;&nbsp; (d) &nbsp; √7",
                "solution": [
                    "(a) B &nbsp;&nbsp; (b) C &nbsp;&nbsp; (c) D &nbsp;&nbsp; (d) E",
                    "One mark for each letter. In this paper, as in Platinum, the natural numbers start at 1, so 0 is a whole number and not a natural number.",
                ],
            },
            {
                "id": "1.2",
                "marks": 2,
                "text": "Write 90 as a product of its prime factors, in exponential form.",
                "solution": [
                    "90 = 2 × 45 = 2 × 3 × 15 = 2 × 3 × 3 × 5 = <b>2 × 3² × 5</b>",
                    "2 marks for 2 × 3² × 5. Award 1 mark for a correct product that is not yet in exponential form, such as 2 × 3 × 3 × 5.",
                ],
            },
            {
                "id": "1.3",
                "marks": 2,
                "text": "Find the HCF and the LCM of 28 and 42.",
                "solution": [
                    "28 = 2² × 7 and 42 = 2 × 3 × 7.",
                    "HCF = 2 × 7 = <b>14</b> &nbsp;&nbsp; (1)",
                    "LCM = 2² × 3 × 7 = <b>84</b> &nbsp;&nbsp; (1)",
                    "Check: 14 × 84 = 1 176 and 28 × 42 = 1 176.",
                ],
            },
        ],
    },
    {
        "title": "Ratio, rate, proportion and finance",
        "marks": 10,
        "parts": [
            {
                "id": "2.1",
                "marks": 2,
                "text": "A bus travels 210 km in 2 hours 30 minutes. Calculate its average speed in km/h.",
                "solution": [
                    "2 hours 30 minutes = 2,5 hours. &nbsp;&nbsp; (1)",
                    "Speed = 210 ÷ 2,5 = <b>84 km/h</b>. &nbsp;&nbsp; (1)",
                    "Also accept 210 km in 150 minutes, then 1,4 km/min × 60 = 84 km/h. The unit km/h is required for the second mark.",
                ],
            },
            {
                "id": "2.2",
                "marks": 2,
                "text": "The ratio of red beads to blue beads is 5 : 3. There are 48 beads altogether. How many red beads are there?",
                "solution": [
                    "5 + 3 = 8 parts, so one part is 48 ÷ 8 = 6. &nbsp;&nbsp; (1)",
                    "Red beads = 5 × 6 = <b>30</b>. &nbsp;&nbsp; (1)",
                ],
            },
            {
                "id": "2.3",
                "marks": 2,
                "text": "4 m of fabric costs R78. Calculate the cost of 7 m of the same fabric.",
                "solution": [
                    "This is direct proportion. Cost = 7/4 × 78. &nbsp;&nbsp; (1)",
                    "= <b>R136,50</b>. &nbsp;&nbsp; (1)",
                    "Or R78 ÷ 4 = R19,50 per metre, then R19,50 × 7 = R136,50.",
                ],
            },
            {
                "id": "2.4",
                "marks": 2,
                "text": "It takes 6 machines 8 hours to print a batch of books. How long will 4 machines take if they work at the same rate?",
                "solution": [
                    "Indirect proportion. The job is 6 × 8 = 48 machine-hours. &nbsp;&nbsp; (1)",
                    "Time for 4 machines = 48 ÷ 4 = <b>12 hours</b>. &nbsp;&nbsp; (1)",
                    "More machines must take less time. An answer above 8 hours is the one to expect; an answer below 8 hours came from treating it as direct.",
                ],
            },
            {
                "id": "2.5",
                "marks": 2,
                "text": "R4 000 is invested at 5% per annum, compounded yearly, for 2 years. Calculate the value of the investment after 2 years.",
                "solution": [
                    "A = 4 000 × (1,05)² &nbsp;&nbsp; or year-by-year: 4 000 × 1,05 = 4 200. &nbsp;&nbsp; (1)",
                    "A = 4 000 × 1,1025 = <b>R4 410</b>. The second year is 4 200 × 1,05 = R4 410. &nbsp;&nbsp; (1)",
                ],
            },
        ],
    },
    {
        "title": "Integers",
        "marks": 6,
        "parts": [
            {
                "id": "3.1",
                "marks": 6,
                "text": "Calculate.",
                "extra": "3.1.1 &nbsp; −8 + (−6) &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; (1)<br/>3.1.2 &nbsp; 4 − (−7) &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; (1)<br/>3.1.3 &nbsp; (−3) × (−4) × (−2) &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; (2)<br/>3.1.4 &nbsp; −36 ÷ 4 + (−2)² &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; (2)",
                "solution": [
                    "3.1.1 &nbsp; −8 + (−6) = <b>−14</b> &nbsp;&nbsp; (1)",
                    "3.1.2 &nbsp; 4 − (−7) = 4 + 7 = <b>11</b> &nbsp;&nbsp; (1)",
                    "3.1.3 &nbsp; (−3) × (−4) = 12, then 12 × (−2) = <b>−24</b>. One mark for 12, one mark for −24. Three negative factors give a negative answer.",
                    "3.1.4 &nbsp; (−2)² = 4 and −36 ÷ 4 = −9, so −9 + 4 = <b>−5</b>. One mark for either correct piece, one mark for −5.",
                ],
            },
        ],
    },
    {
        "title": "Exponents",
        "marks": 10,
        "parts": [
            {
                "id": "4.1",
                "marks": 9,
                "text": "Simplify. Where a power is negative, write the answer with a positive exponent.",
                "extra": "4.1.1 &nbsp; y⁶ × y² &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; (1)<br/>4.1.2 &nbsp; (5²)² &nbsp;&nbsp; Write the answer as a number. &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; (1)<br/>4.1.3 &nbsp; (2p²q)³ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; (2)<br/>4.1.4 &nbsp; 3⁻² + 7⁰ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; (2)<br/>4.1.5 &nbsp; (8x⁶y²) ÷ (2x²y⁵) &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; (3)",
                "solution": [
                    "4.1.1 &nbsp; y⁶⁺² = <b>y⁸</b> &nbsp;&nbsp; (1)",
                    "4.1.2 &nbsp; 5⁴ = <b>625</b> &nbsp;&nbsp; (1). Also accept 5⁴ for the mark.",
                    "4.1.3 &nbsp; 2³ × p⁶ × q³ = <b>8p⁶q³</b>. One mark for 8, one mark for p⁶q³.",
                    "4.1.4 &nbsp; 3⁻² = 1/9 and 7⁰ = 1, so the sum is <b>10/9</b>. One mark for either correct piece, one mark for 10/9. Also accept 1¹⁄₉.",
                    "4.1.5 &nbsp; 8 ÷ 2 = 4, x⁶⁻² = x⁴, and y²⁻⁵ = y⁻³. &nbsp;&nbsp; (2 for these three pieces, at least the coefficient and one correct power)",
                    "= <b>4x⁴ / y³</b> &nbsp;&nbsp; (1). Also accept 4x⁴y⁻³.",
                ],
            },
            {
                "id": "4.2",
                "marks": 1,
                "text": "Write 0,0064 in scientific notation.",
                "solution": [
                    "<b>6,4 × 10⁻³</b> &nbsp;&nbsp; (1). The first number must be at least 1 and less than 10. Also accept 6.4 × 10⁻³.",
                ],
            },
        ],
    },
    {
        "title": "Algebraic expressions",
        "marks": 12,
        "parts": [
            {
                "id": "5.1",
                "marks": 2,
                "text": "The expression −5x² + x − 9 is given.",
                "extra": "5.1.1 &nbsp; Write down the coefficient of x². &nbsp;&nbsp; (1)<br/>5.1.2 &nbsp; Write down the constant term. &nbsp;&nbsp; (1)",
                "solution": [
                    "5.1.1 &nbsp; <b>−5</b> &nbsp;&nbsp; (1). The minus belongs to the coefficient.",
                    "5.1.2 &nbsp; <b>−9</b> &nbsp;&nbsp; (1).",
                ],
            },
            {
                "id": "5.2",
                "marks": 6,
                "text": "Simplify.",
                "extra": "5.2.1 &nbsp; 6a − 4b − a + 7b &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; (1)<br/>5.2.2 &nbsp; 5(x − 2) − 3(2x + 1) &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; (3)<br/>5.2.3 &nbsp; (18m²n − 12mn²) ÷ 6mn &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; (2)",
                "solution": [
                    "5.2.1 &nbsp; <b>5a + 3b</b> &nbsp;&nbsp; (1)",
                    "5.2.2 &nbsp; 5x − 10 − 6x − 3 &nbsp;&nbsp; (2: one mark for each bracket, including the signs)",
                    "= <b>−x − 13</b> &nbsp;&nbsp; (1)",
                    "5.2.3 &nbsp; 18m²n ÷ 6mn = 3m and −12mn² ÷ 6mn = −2n, so <b>3m − 2n</b>. One mark for 3m, one mark for −2n.",
                ],
            },
            {
                "id": "5.3",
                "marks": 4,
                "text": "Expand and simplify.",
                "extra": "5.3.1 &nbsp; (x + 7)(x − 3) &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; (2)<br/>5.3.2 &nbsp; (2x − 3)² &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; (2)",
                "solution": [
                    "5.3.1 &nbsp; x² − 3x + 7x − 21 = <b>x² + 4x − 21</b>. One mark for the four products or an equivalent expansion, one mark for the simplified form.",
                    "5.3.2 &nbsp; (2x)² − 2(2x)(3) + 3² = <b>4x² − 12x + 9</b>. One mark for the correct middle term −12x, one mark for the two squares.",
                ],
            },
        ],
    },
    {
        "title": "Factorising and algebraic fractions",
        "marks": 10,
        "parts": [
            {
                "id": "6.1",
                "marks": 8,
                "text": "Factorise fully.",
                "extra": "6.1.1 &nbsp; 7x² − 21x &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; (2)<br/>6.1.2 &nbsp; 16 − p² &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; (2)<br/>6.1.3 &nbsp; x² + 2x − 15 &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; (2)<br/>6.1.4 &nbsp; 2x² − 8x − 10 &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; (2)",
                "solution": [
                    "6.1.1 &nbsp; <b>7x(x − 3)</b>. One mark for the common factor 7x, one mark for the bracket.",
                    "6.1.2 &nbsp; <b>(4 − p)(4 + p)</b>. Also accept (4 + p)(4 − p). One mark if only the two square roots are correct.",
                    "6.1.3 &nbsp; <b>(x + 5)(x − 3)</b>. The numbers 5 and −3 multiply to −15 and add to 2.",
                    "6.1.4 &nbsp; 2(x² − 4x − 5) = <b>2(x − 5)(x + 1)</b>. One mark for the common factor 2, one mark for both brackets. (2x + 2)(x − 5) is not yet fully factorised.",
                ],
            },
            {
                "id": "6.2",
                "marks": 2,
                "text": "Simplify &nbsp; (x² − 16) / (x + 4).",
                "solution": [
                    "(x − 4)(x + 4) / (x + 4) = <b>x − 4</b>, with <b>x ≠ −4</b>.",
                    "One mark for x − 4. One mark for the restriction. The original denominator is 0 when x = −4.",
                ],
            },
        ],
    },
    {
        "title": "Equations",
        "marks": 10,
        "parts": [
            {
                "id": "7.1",
                "marks": 8,
                "text": "Solve for x.",
                "extra": "7.1.1 &nbsp; 4x + 3 = −13 &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; (2)<br/>7.1.2 &nbsp; 2(x − 5) = 3x + 1 &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; (3)<br/>7.1.3 &nbsp; x² − 9x = 0 &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; (3)",
                "solution": [
                    "7.1.1 &nbsp; 4x = −16 &nbsp;&nbsp; (1), so <b>x = −4</b> &nbsp;&nbsp; (1).",
                    "7.1.2 &nbsp; 2x − 10 = 3x + 1 &nbsp;&nbsp; (1), then −10 − 1 = 3x − 2x &nbsp;&nbsp; (1), so <b>x = −11</b> &nbsp;&nbsp; (1).",
                    "Check for 7.1.2: 2(−11 − 5) = −32 and 3(−11) + 1 = −32.",
                    "7.1.3 &nbsp; x(x − 9) = 0 &nbsp;&nbsp; (1), so <b>x = 0</b> &nbsp;&nbsp; (1) or <b>x = 9</b> &nbsp;&nbsp; (1). Dividing by x loses the answer 0, so do not award that lost answer.",
                ],
            },
            {
                "id": "7.2",
                "marks": 2,
                "text": "A mother is three times as old as her son. The sum of their ages is 48 years. How old is the son?",
                "solution": [
                    "Let the son’s age be x years. Then the mother is 3x, and x + 3x = 48. &nbsp;&nbsp; (1)",
                    "4x = 48, so <b>x = 12</b>. The son is 12 years old. The mother is 36. &nbsp;&nbsp; (1)",
                ],
            },
        ],
    },
    {
        "title": "Patterns, functions and graphs",
        "marks": 10,
        "parts": [
            {
                "id": "8.1",
                "marks": 4,
                "text": "The pattern is 8 ; 13 ; 18 ; 23 ; …",
                "extra": "8.1.1 &nbsp; Write a formula for the general term, Tₙ. &nbsp;&nbsp; (2)<br/>8.1.2 &nbsp; Which term is equal to 78? &nbsp;&nbsp; (2)",
                "solution": [
                    "8.1.1 &nbsp; The difference is 5, so Tₙ = 5n + c. Using the first term, 5 + c = 8, so c = 3. <b>Tₙ = 5n + 3</b>. One mark for the 5n, one mark for + 3. Test: n = 2 gives 13.",
                    "8.1.2 &nbsp; 5n + 3 = 78 &nbsp;&nbsp; (1), so 5n = 75 and <b>n = 15</b>. It is the 15th term. &nbsp;&nbsp; (1)",
                    "Follow through: if their rule in 8.1.1 was wrong, mark 8.1.2 from that rule and award the method.",
                ],
            },
            {
                "id": "8.2",
                "marks": 3,
                "text": "A relationship has the rule: output = −2 × input + 6.",
                "extra": "8.2.1 &nbsp; Find the output when the input is −3. &nbsp;&nbsp; (1)<br/>8.2.2 &nbsp; Find the input when the output is 0. &nbsp;&nbsp; (2)",
                "solution": [
                    "8.2.1 &nbsp; −2 × (−3) + 6 = 6 + 6 = <b>12</b> &nbsp;&nbsp; (1)",
                    "8.2.2 &nbsp; −2x + 6 = 0 &nbsp;&nbsp; (1), so <b>x = 3</b> &nbsp;&nbsp; (1). This input is also the x-intercept of y = −2x + 6.",
                ],
            },
            {
                "id": "8.3",
                "marks": 3,
                "text": "Determine the equation of the straight line passing through (0 ; −2) and (3 ; 4).",
                "solution": [
                    "m = (4 − (−2)) / (3 − 0) = 6/3 = 2. &nbsp;&nbsp; (1)",
                    "The y-intercept is −2, because the line passes through (0 ; −2). &nbsp;&nbsp; (1)",
                    "<b>y = 2x − 2</b>. &nbsp;&nbsp; (1). Check: when x = 3, y = 6 − 2 = 4.",
                ],
            },
        ],
    },
    {
        "title": "Geometry",
        "marks": 10,
        "diagram": True,
        "parts": [
            {
                "id": "9.1",
                "marks": 6,
                "text": "In the diagram, AB ∥ CD and EF is a transversal. Determine, with reasons:",
                "extra": "9.1.1 &nbsp; the size of a, the angle vertically opposite the given 58° angle &nbsp;&nbsp; (2)<br/>9.1.2 &nbsp; the size of b, the co-interior angle to the given 58° angle &nbsp;&nbsp; (2)<br/>9.1.3 &nbsp; the size of c, the corresponding angle to the given 58° angle &nbsp;&nbsp; (2)",
                "solution": [
                    "9.1.1 &nbsp; a = <b>58°</b>. Vertically opposite angles are equal. One mark for 58°, one mark for the reason. Parallel lines are not needed for this reason.",
                    "9.1.2 &nbsp; b = 180° − 58° = <b>122°</b>. Co-interior angles are supplementary, AB ∥ CD. One mark for 122°, one mark for the reason.",
                    "9.1.3 &nbsp; c = <b>58°</b>. Corresponding angles are equal, AB ∥ CD. One mark for 58°, one mark for the reason.",
                ],
            },
            {
                "id": "9.2",
                "marks": 2,
                "text": "In △KLM, ∠K = 2x, ∠L = 3x and ∠M = 4x. Calculate the size of the largest angle.",
                "solution": [
                    "2x + 3x + 4x = 180°, so 9x = 180° and x = 20°. &nbsp;&nbsp; (1)",
                    "The largest angle is 4x = <b>80°</b>. &nbsp;&nbsp; (1)",
                ],
            },
            {
                "id": "9.3",
                "marks": 2,
                "text": "Triangle DEF is similar to triangle ABC. The vertices are written in matching order, so D matches A, E matches B and F matches C. AB = 6 cm, BC = 8 cm and AC = 10 cm. DE = 9 cm. Calculate EF.",
                "solution": [
                    "Scale factor = DE / AB = 9 / 6 = 3/2. &nbsp;&nbsp; (1)",
                    "EF = 8 × 3/2 = <b>12 cm</b>. &nbsp;&nbsp; (1)",
                    "Follow through: if the scale factor is inverted but then used consistently, award the method mark only.",
                ],
            },
        ],
    },
    {
        "title": "Pythagoras, circles and volume",
        "marks": 10,
        "parts": [
            {
                "id": "10.1",
                "marks": 3,
                "text": "In a right-angled triangle the right angle lies between two sides of length 20 cm and 21 cm. Calculate the length of the hypotenuse.",
                "solution": [
                    "c² = 20² + 21² = 400 + 441 = 841. &nbsp;&nbsp; (1)",
                    "c = √841. &nbsp;&nbsp; (1)",
                    "c = <b>29 cm</b>. &nbsp;&nbsp; (1). The unit is part of the final mark. 29² = 841.",
                ],
            },
            {
                "id": "10.2",
                "marks": 4,
                "text": "A circle has a diameter of 20 cm. Use π = 3,14.",
                "extra": "10.2.1 &nbsp; Calculate the circumference. &nbsp;&nbsp; (2)<br/>10.2.2 &nbsp; Calculate the area. &nbsp;&nbsp; (2)",
                "solution": [
                    "The radius is 20 ÷ 2 = 10 cm. This halving is required in both parts.",
                    "10.2.1 &nbsp; C = 2 × 3,14 × 10 = <b>62,8 cm</b>. One mark for using r = 10 in the circumference formula, one mark for 62,8 cm.",
                    "10.2.2 &nbsp; A = 3,14 × 10² = <b>314 cm²</b>. One mark for πr² with r = 10, one mark for 314 cm².",
                    "If the diameter was used as the radius, award no marks for 10.2.1. For 10.2.2 award 1 method mark only if A = πr² was used with that same incorrect radius.",
                ],
            },
            {
                "id": "10.3",
                "marks": 3,
                "text": "A closed cylinder has a radius of 7 cm and a height of 10 cm. Use π = 22/7. Calculate the volume.",
                "solution": [
                    "V = πr²h. &nbsp;&nbsp; (1)",
                    "V = 22/7 × 7 × 7 × 10. &nbsp;&nbsp; (1)",
                    "V = <b>1 540 cm³</b>. &nbsp;&nbsp; (1)",
                ],
            },
        ],
    },
    {
        "title": "Transformations",
        "marks": 4,
        "parts": [
            {
                "id": "11.1",
                "marks": 4,
                "text": "Point P(−4 ; 3) is given. Write the coordinates of the image of P after each transformation.",
                "extra": "11.1.1 &nbsp; Reflection in the y-axis. &nbsp;&nbsp; (1)<br/>11.1.2 &nbsp; Reflection in the line y = x. &nbsp;&nbsp; (1)<br/>11.1.3 &nbsp; A translation of 2 units right and 5 units down. &nbsp;&nbsp; (2)",
                "solution": [
                    "11.1.1 &nbsp; <b>(4 ; 3)</b>. The x-coordinate changes sign. &nbsp;&nbsp; (1)",
                    "11.1.2 &nbsp; <b>(3 ; −4)</b>. The coordinates swap. &nbsp;&nbsp; (1)",
                    "11.1.3 &nbsp; (−4 + 2 ; 3 − 5) = <b>(−2 ; −2)</b>. One mark for each correct coordinate.",
                ],
            },
        ],
    },
]


EXTRA = {
    "title": "Data and probability",
    "marks": 10,
    "parts": [
        {
            "id": "12.1",
            "marks": 5,
            "text": "The ages, in years, of nine players are 12, 14, 14, 15, 15, 15, 16, 17 and 18.",
            "extra": "12.1.1 &nbsp; Determine the median. &nbsp;&nbsp; (1)<br/>12.1.2 &nbsp; Determine the mode. &nbsp;&nbsp; (1)<br/>12.1.3 &nbsp; Determine the mean. Give the exact answer, or round it to two decimal places. &nbsp;&nbsp; (2)<br/>12.1.4 &nbsp; Determine the range. &nbsp;&nbsp; (1)",
            "solution": [
                "The list is already sorted.",
                "12.1.1 &nbsp; The middle, fifth, value is <b>15</b>. &nbsp;&nbsp; (1)",
                "12.1.2 &nbsp; 15 appears three times, more than any other age, so the mode is <b>15</b>. &nbsp;&nbsp; (1)",
                "12.1.3 &nbsp; The sum is 136. &nbsp;&nbsp; (1) &nbsp; Mean = 136 ÷ 9 = <b>136/9</b>, or 15,11 years to two decimal places. &nbsp;&nbsp; (1)",
                "12.1.4 &nbsp; 18 − 12 = <b>6</b>. &nbsp;&nbsp; (1)",
            ],
        },
        {
            "id": "12.2",
            "marks": 5,
            "text": "A spinner is divided into 8 equal sectors: 3 yellow, 3 red and 2 blue.",
            "extra": "12.2.1 &nbsp; Write P(red) as a simplified fraction. &nbsp;&nbsp; (2)<br/>12.2.2 &nbsp; Write P(not yellow) as a simplified fraction. &nbsp;&nbsp; (2)<br/>12.2.3 &nbsp; The spinner is spun 80 times. How many times do you expect blue? &nbsp;&nbsp; (1)",
            "solution": [
                "12.2.1 &nbsp; P(red) = 3/8. &nbsp;&nbsp; (2). Award 1 mark for 3/8 unsimplified if they wrote an equivalent such as 3 ÷ 8, and the second mark is already included because 3/8 is simplified.",
                "12.2.2 &nbsp; Outcomes that are not yellow: 3 + 2 = 5, so P(not yellow) = <b>5/8</b>. One mark for 5 outcomes, one mark for the fraction.",
                "12.2.3 &nbsp; P(blue) = 2/8 = 1/4, so the expected number is 1/4 × 80 = <b>20</b>. &nbsp;&nbsp; (1)",
            ],
        },
    ],
}


def esc(text):
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def rich(text, style):
    """Allow a small set of tags: <b>, <br/>, and the mark-up already in the paper."""
    return Paragraph(text, style)


class ParallelDiagram(Flowable):
    """Parallel lines cut by a transversal, with the exam labels a, b, c and 58°."""

    def __init__(self):
        super().__init__()
        self._fixed_width = 170 * mm
        self._fixed_height = 68 * mm

    def wrap(self, aw, ah):
        return self._fixed_width, self._fixed_height

    def draw(self):
        import math
        c = self.canv
        w, h = self._fixed_width, self._fixed_height
        c.setFillColor(PDF_SOFT)
        c.roundRect(0, 0, w, h, 6, fill=1, stroke=0)

        y_top = h - 16 * mm
        y_bot = 18 * mm
        x_left = 14 * mm
        x_right = w - 10 * mm
        g = (64 * mm, y_top)
        hpt = (112 * mm, y_bot)
        dx = hpt[0] - g[0]
        dy = hpt[1] - g[1]
        start = (g[0] - 0.32 * dx, g[1] - 0.32 * dy)
        end = (hpt[0] + 0.22 * dx, hpt[1] + 0.22 * dy)

        c.setStrokeColor(PDF_NAVY)
        c.setLineWidth(1.7)
        c.line(x_left, y_top, x_right, y_top)
        c.line(x_left, y_bot, x_right, y_bot)
        c.setStrokeColor(PDF_TEAL)
        c.setLineWidth(1.7)
        c.line(start[0], start[1], end[0], end[1])

        def arrow_head(x, y):
            c.setFillColor(PDF_NAVY)
            path = c.beginPath()
            path.moveTo(x, y + 1.4 * mm)
            path.lineTo(x + 3.4 * mm, y)
            path.lineTo(x, y - 1.4 * mm)
            path.close()
            c.drawPath(path, fill=1, stroke=0)

        for yline in (y_top, y_bot):
            arrow_head(x_left + 14 * mm, yline)
            arrow_head(x_left + 19 * mm, yline)

        # Acute wedge at the upper intersection, between the line and the transversal.
        ang = math.degrees(math.atan2(dy, dx))
        radius = 9 * mm
        c.setStrokeColor(PDF_AMBER)
        c.setLineWidth(1.2)
        c.arc(g[0] - radius, g[1] - radius, g[0] + radius, g[1] + radius, ang, -ang)

        def place(origin, degrees, dist, text, size=11):
            rad = math.radians(degrees)
            c.setFont("Body-Bold", size)
            c.drawCentredString(
                origin[0] + math.cos(rad) * dist,
                origin[1] + math.sin(rad) * dist - 1.1 * mm,
                text,
            )

        # 58 degrees is in the acute wedge. a is vertically opposite that wedge.
        # c is the same wedge at the lower intersection, so it corresponds.
        # b is between the parallels on the same side of the transversal, so it is co-interior.
        c.setFillColor(PDF_AMBER)
        place(g, ang / 2.0, radius + 6 * mm, "58\u00b0", 10)
        c.setFillColor(PDF_NAVY)
        place(g, ang / 2.0 + 180, 16 * mm, "a", 12)
        place(hpt, (ang + 180) / 2.0, 14 * mm, "b", 12)
        # Keep c in the lower corresponding wedge, clear of the letter F.
        c.setFont("Body-Bold", 12)
        c.drawString(hpt[0] + 18 * mm, hpt[1] - 8 * mm, "c")

        c.setFillColor(PDF_NAVY)
        c.setFont("Body-Bold", 11)
        c.drawString(x_left, y_top + 3.2 * mm, "A")
        c.drawRightString(x_right, y_top + 3.2 * mm, "B")
        c.drawString(x_left, y_bot + 3.2 * mm, "C")
        c.drawRightString(x_right, y_bot + 3.2 * mm, "D")
        c.setFillColor(PDF_TEAL)
        c.setFont("Body-Bold", 11)
        c.drawString(start[0] - 5 * mm, start[1] + 1 * mm, "E")
        c.drawString(end[0] - 5 * mm, end[1] - 5 * mm, "F")


def styles():
    s = {}
    s["h1"] = ParagraphStyle(
        "h1", fontName="Body-Bold", fontSize=20, leading=24, textColor=PDF_NAVY, alignment=TA_LEFT, spaceAfter=2,
    )
    s["sub"] = ParagraphStyle(
        "sub", fontName="Body-Italic", fontSize=11, leading=14, textColor=PDF_TEAL, spaceAfter=6,
    )
    s["body"] = ParagraphStyle(
        "body", fontName="Body", fontSize=11, leading=15, textColor=PDF_INK, spaceAfter=3,
    )
    s["bodyj"] = ParagraphStyle(
        "bodyj", fontName="Body", fontSize=11, leading=15, textColor=PDF_INK, alignment=TA_JUSTIFY, spaceAfter=4,
    )
    s["qhead"] = ParagraphStyle(
        "qhead", fontName="Body-Bold", fontSize=13, leading=16, textColor=PDF_NAVY, spaceBefore=8, spaceAfter=3,
    )
    s["part"] = ParagraphStyle(
        "part", fontName="Body", fontSize=11, leading=15, textColor=PDF_INK, spaceBefore=3, spaceAfter=1,
    )
    s["extra"] = ParagraphStyle(
        "extra", fontName="Body", fontSize=11, leading=15, textColor=PDF_INK, leftIndent=8, spaceBefore=1, spaceAfter=2,
    )
    s["small"] = ParagraphStyle(
        "small", fontName="Body-Italic", fontSize=9, leading=12, textColor=PDF_MUTED, spaceAfter=2,
    )
    s["mark"] = ParagraphStyle(
        "mark", fontName="Body-Bold", fontSize=11, leading=14, textColor=PDF_TEAL, alignment=TA_RIGHT,
    )
    s["sol"] = ParagraphStyle(
        "sol", fontName="Body", fontSize=11, leading=15, textColor=PDF_INK, leftIndent=6, spaceAfter=2,
    )
    s["centre"] = ParagraphStyle(
        "centre", fontName="Body-Bold", fontSize=11, leading=14, textColor=white, alignment=TA_CENTER,
    )
    s["footer_note"] = ParagraphStyle(
        "footer_note", fontName="Body-Italic", fontSize=9, leading=12, textColor=PDF_MUTED,
    )
    return s


def _header_footer(canvas, doc, kind):
    canvas.saveState()
    width, height = A4
    canvas.setFillColor(PDF_NAVY)
    canvas.rect(0, height - 14 * mm, width, 14 * mm, fill=1, stroke=0)
    canvas.setFillColor(PDF_AMBER)
    canvas.rect(0, height - 15.2 * mm, width, 1.2 * mm, fill=1, stroke=0)
    canvas.setFillColor(white)
    canvas.setFont("Body-Bold", 9)
    canvas.drawString(16 * mm, height - 8.5 * mm, "GRADE 9 MATHEMATICS")
    canvas.setFont("Body", 9)
    right = "QUESTION PAPER" if kind == "question" else "MARKING MEMORANDUM"
    canvas.drawRightString(width - 16 * mm, height - 8.5 * mm, right)
    canvas.setFillColor(PDF_TEAL)
    canvas.rect(0, 0, width, 10 * mm, fill=1, stroke=0)
    canvas.setFillColor(white)
    canvas.setFont("Body", 8.5)
    foot = "Questions 1 to 11  ·  100 marks  ·  2 hours" if kind == "question" else "Mark from this memorandum only after the paper has been written"
    canvas.drawString(16 * mm, 4 * mm, foot)
    canvas.drawRightString(width - 16 * mm, 4 * mm, f"Page {doc.page}")
    canvas.restoreState()


def question_flow(story, block, st, memo=False):
    head = f"QUESTION {block['number']}  ·  {block['title']}  ·  {block['marks']} marks"
    story.append(Paragraph(head, st["qhead"]))
    story.append(HRFlowable())
    if block.get("blurb"):
        story.append(Paragraph(block["blurb"], st["small"]))
    if block.get("diagram") and not memo:
        story.append(Spacer(1, 2 * mm))
        story.append(ParallelDiagram())
        story.append(Paragraph(
            "AB is parallel to CD. EF is a transversal. The marked 58° angle lies between AB and the transversal, on the side towards B. "
            "Angle a is vertically opposite that 58° angle. Angle b is co-interior with it. Angle c corresponds to it.",
            st["small"],
        ))
        story.append(Spacer(1, 1 * mm))
    if block.get("diagram") and memo:
        story.append(Paragraph(
            "Diagram reminder: a is vertically opposite 58°, b is the co-interior angle, and c is the corresponding angle.",
            st["small"],
        ))
    for part in block["parts"]:
        group = []
        label = f"<b>{part['id']}</b> &nbsp;&nbsp; {part['text']}"
        mark = f"({part['marks']})"
        data = [[rich(label, st["part"]), rich(mark, st["mark"])]]
        table = Table(data, colWidths=[158 * mm, 16 * mm])
        table.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ("TOPPADDING", (0, 0), (-1, -1), 2),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 1),
        ]))
        group.append(table)
        if part.get("extra"):
            group.append(Paragraph(part["extra"], st["extra"]))
        if memo:
            group.append(Spacer(1, 1 * mm))
            for line in part["solution"]:
                group.append(Paragraph(line, st["sol"]))
            group.append(Spacer(1, 1.5 * mm))
        else:
            group.append(Spacer(1, 1 * mm))
        story.append(KeepTogether(group))


class HRFlowable(Flowable):
    def __init__(self):
        super().__init__()
        self._w = 174 * mm
        self._h = 2 * mm

    def wrap(self, aw, ah):
        self._w = aw
        return aw, self._h

    def draw(self):
        self.canv.setStrokeColor(PDF_LINE)
        self.canv.setLineWidth(0.6)
        self.canv.line(0, 1, self._w, 1)


def _doc(path, kind, story):
    doc = BaseDocTemplate(
        path,
        pagesize=A4,
        leftMargin=16 * mm,
        rightMargin=16 * mm,
        topMargin=18 * mm,
        bottomMargin=16 * mm,
        title="Grade 9 Mathematics question paper" if kind == "question" else "Grade 9 Mathematics marking memorandum",
        author="Grade 9 CAPS revision pack",
    )
    frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="main")
    doc.addPageTemplates([
        PageTemplate(id="main", frames=[frame], onPage=lambda c, d: _header_footer(c, d, kind)),
    ])
    doc.build(story)


def build_question_pdf():
    st = styles()
    story = []
    story.append(Paragraph("Final revision paper", st["h1"]))
    story.append(Paragraph("CAPS Grade 9 Mathematics  ·  Terms 1 to 4", st["sub"]))
    story.append(Paragraph(
        "This is an original practice paper. It follows the CAPS topics and the 2025 Grade 9 Annual Teaching Plan, "
        "and it uses the same topic names as Platinum Mathematics Grade 9. It is not a copy of the textbook and it is not a past exam.",
        st["bodyj"],
    ))
    info = [
        [rich("<b>Time</b>", st["body"]), rich("2 hours for Questions 1 to 11", st["body"]),
         rich("<b>Marks</b>", st["body"]), rich("100, plus an optional Question 12", st["body"])],
        [rich("<b>Calculator</b>", st["body"]), rich("Non-programmable calculator allowed", st["body"]),
         rich("<b>Name</b>", st["body"]), rich("________________________", st["body"])],
    ]
    meta = Table(info, colWidths=[28 * mm, 62 * mm, 24 * mm, 60 * mm])
    meta.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), PDF_SOFT),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(Spacer(1, 2 * mm))
    story.append(meta)
    story.append(Spacer(1, 3 * mm))
    story.append(Paragraph("Instructions", st["qhead"]))
    instructions = [
        "Answer <b>Questions 1 to 11</b>. Together they are worth 100 marks.",
        "Question 12 is extra practice from the data and probability chapters in Platinum. Do it if your teacher included those chapters. It is not part of the 100 marks and it is not part of the 2 hours.",
        "Show <b>all</b> working. If a final answer is wrong, method marks can still be earned.",
        "In geometry, give a reason for every statement.",
        "Give answers in the units asked for. Write money in rands and cents.",
        "Diagrams are not drawn to scale.",
        "Round only when the question asks you to round.",
    ]
    for index, line in enumerate(instructions, start=1):
        story.append(Paragraph(f"{index}. &nbsp; {line}", st["body"]))
    numbered = []
    for i, block in enumerate(PAPER, start=1):
        item = dict(block)
        item["number"] = i
        numbered.append(item)
    for block in numbered:
        question_flow(story, block, st, memo=False)
    extra = dict(EXTRA)
    extra["number"] = 12
    extra["blurb"] = (
        "Optional. Answer this question only if your teacher included data handling and probability. "
        "The 2025 national teaching plan uses Term 4 for transformations, patterns and revision. "
        "Platinum still teaches these chapters."
    )
    story.append(Spacer(1, 3 * mm))
    story.append(Paragraph("OPTIONAL QUESTION", st["sub"]))
    question_flow(story, extra, st, memo=False)
    story.append(Spacer(1, 4 * mm))
    story.append(Paragraph("End of the question paper. Total for Questions 1 to 11: 100 marks.", st["footer_note"]))
    _doc(QUESTION_PATH, "question", story)


def build_memo_pdf():
    st = styles()
    story = []
    story.append(Paragraph("Marking memorandum", st["h1"]))
    story.append(Paragraph("For the tutor  ·  keep this file until the paper has been written", st["sub"]))
    story.append(Paragraph(
        "One valid method is shown. An equivalent correct method earns the same marks. "
        "A correct final answer earns the marks for that part. If the final answer is wrong, award the method marks that were actually earned. "
        "Do not take the same mistake off twice: if a later part uses an earlier wrong answer correctly, award the follow-through marks described below.",
        st["bodyj"],
    ))
    rows = [["Question", "Topic", "Marks"]]
    for i, block in enumerate(PAPER, start=1):
        rows.append([str(i), block["title"], str(block["marks"])])
    rows.append(["1 to 11", "Timed paper", "100"])
    rows.append(["12", EXTRA["title"] + " (optional)", "10"])
    table = Table(
        [[rich(f"<b>{cell}</b>" if r == 0 or r >= len(rows) - 2 else cell, st["body"]) for cell in row] for r, row in enumerate(rows)],
        colWidths=[30 * mm, 110 * mm, 30 * mm],
    )
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), PDF_NAVY),
        ("TEXTCOLOR", (0, 0), (-1, 0), white),
        ("BACKGROUND", (0, 1), (-1, -3), PDF_SOFT),
        ("BACKGROUND", (0, -2), (-1, -1), HexColor("#E7F3F2")),
        ("FONTNAME", (0, 0), (-1, 0), "Body-Bold"),
        ("ALIGN", (2, 0), (2, -1), "RIGHT"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LINEBELOW", (0, 0), (-1, -2), 0.2, PDF_LINE),
    ]))
    # The header text colour is set on the paragraph, which overrides TEXTCOLOR.
    # Rebuild the header row in white.
    header = [rich(f"<font color='white'><b>{cell}</b></font>", st["body"]) for cell in rows[0]]
    body_rows = [header]
    for r, row in enumerate(rows[1:], start=1):
        body_rows.append([rich(cell if j < 2 else f"<b>{cell}</b>", st["body"]) for j, cell in enumerate(row)])
    table = Table(body_rows, colWidths=[30 * mm, 110 * mm, 30 * mm])
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), PDF_NAVY),
        ("BACKGROUND", (0, 1), (-1, -3), colors_soft()),
        ("BACKGROUND", (0, -2), (-1, -1), HexColor("#E7F3F2")),
        ("ALIGN", (2, 0), (2, -1), "RIGHT"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    story.append(Spacer(1, 2 * mm))
    story.append(table)
    story.append(Spacer(1, 2 * mm))
    numbered = []
    for i, block in enumerate(PAPER, start=1):
        item = dict(block)
        item["number"] = i
        numbered.append(item)
    for block in numbered:
        question_flow(story, block, st, memo=True)
    extra = dict(EXTRA)
    extra["number"] = 12
    extra["blurb"] = "Optional question. Mark it out of 10, separately from the 100."
    question_flow(story, extra, st, memo=True)
    story.append(Spacer(1, 4 * mm))
    story.append(Paragraph(
        "After marking, redo only the parts that lost marks. A second full paper the same night is less useful than fixing the three weakest questions.",
        st["footer_note"],
    ))
    _doc(MEMO_PATH, "memo", story)


def colors_soft():
    return PDF_SOFT


def main():
    verify_answers()
    # Attach question numbers for the assert on part marks.
    for block in PAPER:
        got = sum(part["marks"] for part in block["parts"])
        if got != block["marks"]:
            raise SystemExit(f"Mark mismatch in {block['title']}: parts {got}, heading {block['marks']}")
    extra_got = sum(part["marks"] for part in EXTRA["parts"])
    if extra_got != EXTRA["marks"]:
        raise SystemExit("Mark mismatch in the optional question")
    total_slides = build_slides()
    build_question_pdf()
    build_memo_pdf()
    print(f"Slides: {total_slides} -> {SLIDES_PATH}")
    print(f"Questions -> {QUESTION_PATH}")
    print(f"Memorandum -> {MEMO_PATH}")


if __name__ == "__main__":
    main()
