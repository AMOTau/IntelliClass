"""Five-minute IntelliClass talk, in the app's paper and forest-green palette."""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter
from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_CONNECTOR, MSO_SHAPE
from pptx.enum.text import MSO_ANCHOR, PP_ALIGN
from pptx.oxml import parse_xml
from pptx.util import Emu, Inches, Pt

ROOT = Path(__file__).resolve().parent
PUBLIC = Path(r"D:\Tonkana\Projects\IntelliClass\IntelliClass\client\public")
ART = ROOT / "pptx-art"
OUT = ROOT / "IntelliClass_Presentation.pptx"

BOARD = RGBColor(0x1A, 0x5C, 0x4A)
BRAND = RGBColor(0x0F, 0x8A, 0x7A)
BRAND_DEEP = RGBColor(0x0B, 0x6F, 0x63)
TEXT = RGBColor(0x1F, 0x3A, 0x34)
MUTED = RGBColor(0x66, 0x75, 0x7A)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
SOFT = RGBColor(0xE7, 0xF3, 0xEF)
LINE = RGBColor(0xC5, 0xDD, 0xD4)
BLUE_SOFT = RGBColor(0xE8, 0xEE, 0xF8)

W, H = 13.333, 7.5
FONT = "Segoe UI"
TOTAL = 9
CREAM = RGBColor(0xFF, 0xFA, 0xF2)
GOLD = RGBColor(0xB0, 0x7A, 0x3A)


def rounded(src, dest, size, radius, focus=(0.5, 0.45)):
    im = Image.open(src).convert("RGBA")
    sw, sh = im.size
    tw, th = size
    scale = max(tw / sw, th / sh)
    nw, nh = int(sw * scale), int(sh * scale)
    im = im.resize((nw, nh), Image.Resampling.LANCZOS)
    left = max(0, min(int((nw - tw) * focus[0]), nw - tw))
    top = max(0, min(int((nh - th) * focus[1]), nh - th))
    im = im.crop((left, top, left + tw, top + th))
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, tw - 1, th - 1), radius=radius, fill=255)
    im.putalpha(mask)
    pad = 36
    canvas = Image.new("RGBA", (tw + pad * 2, th + pad * 2), (0, 0, 0, 0))
    shadow = Image.new("RGBA", size, (15, 58, 48, 255))
    shadow.putalpha(mask.point(lambda p: int(p * 0.22)))
    shadow = shadow.filter(ImageFilter.GaussianBlur(18))
    canvas.paste(shadow, (pad, pad + 12), shadow)
    canvas.paste(im, (pad, pad), im)
    canvas.save(dest)
    return pad, canvas.size


def make_background(path):
    w, h = 2400, 1350
    base = Image.new("RGB", (w, h), (244, 247, 244))
    draw = ImageDraw.Draw(base)
    for y in range(0, h, 46):
        draw.line([(0, y), (w, y)], fill=(232, 239, 233), width=2)
    overlay = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    od.ellipse((-260, -200, 780, 640), fill=(15, 138, 122, 28))
    od.ellipse((1600, -80, 2700, 720), fill=(26, 92, 74, 24))
    od.ellipse((700, 900, 1800, 1600), fill=(47, 158, 138, 22))
    overlay = overlay.filter(ImageFilter.GaussianBlur(80))
    Image.alpha_composite(base.convert("RGBA"), overlay).convert("RGB").save(path, quality=95)


def shadow(shape):
    shape._element.spPr.append(
        parse_xml(
            """<a:effectLst xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
              <a:outerShdw blurRad="25400" dist="6350" dir="2700000" algn="tl" rotWithShape="0">
                <a:srgbClr val="1A5C4A"><a:alpha val="14000"/></a:srgbClr>
              </a:outerShdw>
            </a:effectLst>"""
        )
    )


def box(slide, x, y, w, h, fill, line=None, radius=0.14, shade=True):
    shape = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(x), Inches(y), Inches(w), Inches(h))
    shape.adjustments[0] = radius
    shape.fill.solid()
    shape.fill.fore_color.rgb = fill
    if line is None:
        shape.line.fill.background()
    else:
        shape.line.color.rgb = line
        shape.line.width = Pt(1.25)
    if shade:
        shadow(shape)
    return shape


def oval(slide, x, y, w, h, fill):
    shape = slide.shapes.add_shape(MSO_SHAPE.OVAL, Inches(x), Inches(y), Inches(w), Inches(h))
    shape.fill.solid()
    shape.fill.fore_color.rgb = fill
    shape.line.fill.background()
    return shape


def _anchor(tf, anchor):
    tf.word_wrap = True
    tf.auto_size = None
    tf.margin_left = Emu(0)
    tf.margin_right = Emu(0)
    tf.margin_top = Emu(0)
    tf.margin_bottom = Emu(0)
    tf._txBody.bodyPr.set("anchor", {MSO_ANCHOR.TOP: "t", MSO_ANCHOR.MIDDLE: "ctr", MSO_ANCHOR.BOTTOM: "b"}[anchor])


def text(slide, x, y, w, h, content, size=18, bold=False, color=TEXT, align=PP_ALIGN.LEFT, anchor=MSO_ANCHOR.TOP):
    shape = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    tf = shape.text_frame
    _anchor(tf, anchor)
    lines = content if isinstance(content, list) else [content]
    for i, line in enumerate(lines):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = align
        p.space_before = Pt(0)
        p.space_after = Pt(0)
        run = p.add_run()
        run.text = line
        run.font.name = FONT
        run.font.size = Pt(size)
        run.font.bold = bold
        run.font.color.rgb = color
    return shape


def notes(slide, content):
    slide.notes_slide.notes_text_frame.text = content


def footer(slide, number):
    text(slide, 0.62, 7.08, 6, 0.28, "IntelliClass", 12, False, MUTED, anchor=MSO_ANCHOR.MIDDLE)
    text(slide, 10.2, 7.08, 2.5, 0.28, f"{number}  /  {TOTAL}", 12, False, MUTED, PP_ALIGN.RIGHT, MSO_ANCHOR.MIDDLE)


def eyebrow(slide, label):
    width = 0.42 + len(label) * 0.078
    box(slide, 0.62, 0.36, width, 0.34, SOFT, radius=0.5, shade=False)
    text(slide, 0.62, 0.36, width, 0.34, label, 12, True, BRAND_DEEP, PP_ALIGN.CENTER, MSO_ANCHOR.MIDDLE)


def new(prs, bg):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    slide.shapes.add_picture(str(bg), 0, 0, Inches(W), Inches(H))
    return slide


def prepare_art():
    ART.mkdir(exist_ok=True)
    bg = ART / "bg.png"
    make_background(bg)
    hero = rounded(PUBLIC / "Login-image.png", ART / "hero.png", (1080, 1280), 54, focus=(0.32, 0.36))
    close = rounded(PUBLIC / "Login-image.png", ART / "close.png", (1100, 1200), 54, focus=(1.0, 0.42))
    return {"bg": bg, "hero": hero, "close": close}


def photo(slide, meta, path, x, y, photo_w):
    pad, (pw, ph) = meta
    full_w = photo_w * (pw / (pw - pad * 2))
    full_h = full_w * ph / pw
    ox = x - photo_w * (pad / (pw - pad * 2))
    oy = y - full_h * (pad / ph)
    slide.shapes.add_picture(str(path), Inches(ox), Inches(oy), Inches(full_w))


def build():
    art = prepare_art()
    prs = Presentation()
    prs.slide_width = Inches(W)
    prs.slide_height = Inches(H)
    prs.core_properties.title = "IntelliClass"
    prs.core_properties.subject = "AI-Assisted Academic Management Platform"
    prs.core_properties.author = "IntelliClass"
    bg = str(art["bg"])

    title_slide(prs, bg, art)
    problem_slide(prs, bg)
    solution_slide(prs, bg)
    usecase_slide(prs, bg)
    architecture_slide(prs, bg)
    ai_slide(prs, bg)
    prototype_slide(prs, bg)
    results_slide(prs, bg)
    close_slide(prs, bg, art)

    prs.save(OUT)
    print(OUT)


def title_slide(prs, bg, art):
    s = new(prs, bg)
    box(s, 0.48, 0.42, 6.7, 6.66, WHITE, LINE, 0.08)
    text(s, 0.92, 1.35, 5.7, 0.32, "AI-assisted academic management", 14, True, BRAND_DEEP)
    text(s, 0.9, 1.82, 5.8, 1.15, "IntelliClass", 46, True, TEXT)
    text(s, 0.92, 3.15, 5.6, 1.2, "One place for homework,\nquizzes and progress.", 24, False, BOARD)
    text(s, 0.92, 4.45, 5.5, 0.7, "For administrators, teachers,\nlearners and parents.", 16, False, MUTED)
    aims = ["More accountability", "Less teacher admin", "Clearer parent view"]
    y = 5.45
    for aim in aims:
        oval(s, 0.98, y + 0.06, 0.14, 0.14, BRAND)
        text(s, 1.28, y - 0.04, 5.2, 0.32, aim, 14, False, TEXT)
        y += 0.38
    photo(s, art["hero"], ART / "hero.png", 7.45, 0.85, 5.15)
    notes(
        s,
        "About 20 seconds. IntelliClass is a web platform for schools. It keeps homework, quizzes, study material and performance in one place. "
        "AI assists. Teachers still decide what learners see.",
    )


def problem_slide(prs, bg):
    s = new(prs, bg)
    eyebrow(s, "The problem")
    text(s, 0.62, 0.86, 12, 0.7, "The academic work is hard to see", 32, True, TEXT)
    points = [
        ("Missed work", "Homework completion is hard to see.", "Support often comes after the deadline."),
        ("Slow preparation", "Quizzes are written by hand from the notes.", "That time is taken away from teaching."),
        ("Late news", "Parents mostly hear at report time.", "They cannot step in during the term."),
        ("No single record", "Marks, files and messages sit apart.", "Weak topics are easy to miss."),
    ]
    for i, (title, line, extra) in enumerate(points):
        col, row = i % 2, i // 2
        x = 0.62 + col * 6.35
        y = 1.95 + row * 2.35
        box(s, x, y, 6.05, 2.15, WHITE, LINE, 0.1)
        oval(s, x + 0.32, y + 0.36, 0.48, 0.48, SOFT)
        text(s, x + 0.32, y + 0.36, 0.48, 0.48, str(i + 1), 16, True, BRAND_DEEP, PP_ALIGN.CENTER, MSO_ANCHOR.MIDDLE)
        text(s, x + 1.02, y + 0.32, 4.7, 0.42, title, 20, True, TEXT, anchor=MSO_ANCHOR.MIDDLE)
        text(s, x + 1.02, y + 0.9, 4.7, 0.4, line, 15, False, TEXT)
        text(s, x + 1.02, y + 1.35, 4.7, 0.45, extra, 14, False, MUTED)
    footer(s, 2)
    notes(
        s,
        "About 40 seconds. Three pressures sit behind the system. Homework is easy to miss. "
        "Teachers spend a long time preparing assessments by hand. Parents often only see how a child is doing at report time. "
        "There is no single record they can all use.",
    )


def solution_slide(prs, bg):
    s = new(prs, bg)
    eyebrow(s, "The proposed solution")
    text(s, 0.62, 0.84, 12, 0.55, "One system. Four roles.", 32, True, TEXT)
    text(s, 0.62, 1.48, 12, 0.35, "Academic work in one place, with AI only as an assistant.", 16, False, MUTED)
    cards = [
        ("Administrator", "Creates users, classes and subjects.", "Decides who belongs where."),
        ("Teacher", "Uploads notes, sets work and quizzes.", "Reviews every AI draft first."),
        ("Learner", "Opens materials and completes quizzes.", "Sees the score and why it was wrong."),
        ("Parent", "Sees homework, results and weak topics.", "Can receive a note from the teacher."),
    ]
    for i, (title, line, extra) in enumerate(cards):
        x = 0.62 + i * 3.15
        box(s, x, 2.1, 2.98, 4.15, WHITE, LINE, 0.1)
        oval(s, x + 0.28, 2.38, 0.52, 0.52, SOFT if i % 2 == 0 else BLUE_SOFT)
        text(s, x + 0.28, 2.38, 0.52, 0.52, str(i + 1), 15, True, BRAND_DEEP, PP_ALIGN.CENTER, MSO_ANCHOR.MIDDLE)
        text(s, x + 0.22, 3.1, 2.55, 0.7, title, 18, True, TEXT)
        text(s, x + 0.22, 3.9, 2.55, 0.9, line, 14, False, TEXT)
        text(s, x + 0.22, 4.85, 2.55, 0.95, extra, 14, False, MUTED)
    footer(s, 3)
    notes(
        s,
        "About 30 seconds. The proposal is one platform and four roles. "
        "The next slide shows the exact work each person can do. "
        "The aim is more accountability, less admin, and earlier support.",
    )


def usecase_slide(prs, bg):
    s = new(prs, bg)
    eyebrow(s, "Use cases")
    text(s, 0.62, 0.72, 12, 0.42, "Who does what", 32, True, TEXT)
    text(s, 0.62, 1.16, 12, 0.3, "Everyone signs in. Each line is the work that belongs to that person.", 15, False, MUTED)

    boundary = box(s, 3.15, 1.58, 7.05, 5.15, WHITE, BRAND_DEEP, 0.05, shade=False)
    boundary.line.width = Pt(1.75)
    text(s, 3.15, 1.66, 7.05, 0.28, "IntelliClass", 13, True, BRAND_DEEP, PP_ALIGN.CENTER)

    def case(x, y, label, fill=WHITE):
        shape = s.shapes.add_shape(MSO_SHAPE.OVAL, Inches(x), Inches(y), Inches(2.95), Inches(0.62))
        shape.fill.solid()
        shape.fill.fore_color.rgb = fill
        shape.line.color.rgb = BRAND_DEEP
        shape.line.width = Pt(1.5)
        text(s, x + 0.08, y, 2.79, 0.62, label, 13, True, TEXT, PP_ALIGN.CENTER, MSO_ANCHOR.MIDDLE)

    case(5.2, 2.02, "Sign in")
    case(3.38, 2.82, "Manage school setup")
    case(3.38, 3.62, "Upload study material")
    case(3.38, 4.42, "Generate AI quiz", SOFT)
    case(3.38, 5.32, "Review and publish")
    case(7.02, 2.82, "View progress")
    case(7.02, 3.62, "Take published quiz")
    case(7.02, 4.42, "Request explanation", SOFT)

    ai = box(s, 7.02, 5.28, 2.95, 1.22, CREAM, GOLD, 0.14, shade=False)
    ai.line.width = Pt(1.5)
    text(s, 7.12, 5.42, 2.75, 0.36, "AI Service", 14, True, GOLD, PP_ALIGN.CENTER)
    text(s, 7.12, 5.76, 2.75, 0.58, ["Hugging Face", "Draft and explanation"], 12, False, MUTED, PP_ALIGN.CENTER)

    def stick(cx, top, name):
        head = s.shapes.add_shape(MSO_SHAPE.OVAL, Inches(cx - 0.16), Inches(top), Inches(0.32), Inches(0.32))
        head.fill.solid()
        head.fill.fore_color.rgb = WHITE
        head.line.color.rgb = BOARD
        head.line.width = Pt(1.5)

        def limb(x, y, w, h):
            shape = s.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(x), Inches(y), Inches(w), Inches(h))
            shape.fill.solid()
            shape.fill.fore_color.rgb = BOARD
            shape.line.fill.background()
            return shape

        limb(cx - 0.016, top + 0.32, 0.032, 0.44)
        limb(cx - 0.26, top + 0.46, 0.52, 0.028)
        left = limb(cx - 0.12, top + 0.74, 0.028, 0.36)
        right = limb(cx + 0.09, top + 0.74, 0.028, 0.36)
        left.rotation = 22
        right.rotation = 338
        text(s, cx - 0.85, top + 1.16, 1.7, 0.32, name, 12, True, TEXT, PP_ALIGN.CENTER)

    stick(1.35, 2.67, "Administrator")
    stick(1.35, 4.27, "Teacher")
    stick(11.95, 2.67, "Parent")
    stick(11.95, 4.2, "Learner")

    def link(x1, y1, x2, y2):
        shape = s.shapes.add_connector(MSO_CONNECTOR.STRAIGHT, Inches(x1), Inches(y1), Inches(x2), Inches(y2))
        shape.line.color.rgb = BRAND
        shape.line.width = Pt(1.5)

    link(1.61, 3.13, 3.38, 3.13)
    link(1.61, 4.73, 3.38, 3.93)
    link(1.61, 4.73, 3.38, 4.73)
    link(1.61, 4.73, 3.38, 5.63)
    link(9.97, 3.13, 11.69, 3.13)
    link(9.97, 3.93, 11.69, 4.66)
    link(9.97, 4.73, 11.69, 4.66)
    link(4.85, 5.04, 4.85, 5.32)
    link(6.33, 4.73, 6.64, 4.73)
    link(6.64, 4.73, 6.64, 5.89)
    link(6.64, 5.89, 7.02, 5.89)
    link(8.5, 5.04, 8.5, 5.28)
    text(s, 4.95, 5.0, 0.85, 0.26, "include", 10, False, MUTED, anchor=MSO_ANCHOR.MIDDLE)
    footer(s, 4)
    notes(
        s,
        "About 35 seconds. Point to the four people rather than reading every oval. "
        "The administrator sets up users, classes and subjects. "
        "The teacher uploads the notes, asks for a draft, then reviews and publishes. "
        "The learner takes only a published quiz and can ask why an answer was wrong. "
        "The parent views progress. The tinted cases call Hugging Face. "
        "A quiz stays hidden until the teacher includes that review and publishes it.",
    )


def architecture_slide(prs, bg):
    s = new(prs, bg)
    eyebrow(s, "Architecture")
    text(s, 0.62, 0.82, 12, 0.5, "A normal web application", 32, True, TEXT)

    def rule(x, y, w, h):
        shape = s.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(x), Inches(y), Inches(w), Inches(h))
        shape.fill.solid()
        shape.fill.fore_color.rgb = BRAND
        shape.line.fill.background()

    layers = [
        (3.15, 1.5, 6.95, "Four role dashboards", "React"),
        (3.15, 2.55, 6.95, "Sign-in, quizzes, AI call", "Node.js  ·  Express"),
    ]
    for x, y, w, caption, label in layers:
        box(s, x, y, w, 0.88, WHITE, LINE, 0.16, shade=False)
        text(s, x + 0.35, y + 0.08, 3.3, 0.72, caption, 14, False, MUTED, anchor=MSO_ANCHOR.MIDDLE)
        text(s, x + 3.2, y + 0.08, 3.4, 0.72, label, 20, True, BRAND_DEEP, PP_ALIGN.RIGHT, MSO_ANCHOR.MIDDLE)
    box(s, 1.55, 4.05, 4.7, 1.15, WHITE, LINE, 0.14, shade=False)
    text(s, 1.78, 4.16, 4.3, 0.28, "Users, PDFs, questions, scores", 12, False, MUTED)
    text(s, 1.78, 4.44, 4.3, 0.4, "PostgreSQL", 20, True, TEXT)
    box(s, 7.05, 4.05, 4.7, 1.15, SOFT, radius=0.14, shade=False)
    text(s, 7.28, 4.16, 4.3, 0.28, "Pre-trained. Key stays on the server.", 12, False, BRAND_DEEP)
    text(s, 7.28, 4.44, 4.3, 0.4, "Hugging Face", 20, True, BRAND_DEEP)
    rule(6.60, 2.34, 0.045, 0.24)
    rule(6.60, 3.38, 0.045, 0.42)
    rule(3.88, 3.76, 5.54, 0.045)
    rule(3.88, 3.76, 0.045, 0.32)
    rule(9.37, 3.76, 0.045, 0.32)
    facts = ["A modern browser", "No special AI hardware", "Sign-in and role checks"]
    widths = [0.48 + len(fact) * 0.108 for fact in facts]
    x = (W - (sum(widths) + 0.16 * (len(facts) - 1))) / 2
    for fact, width in zip(facts, widths):
        box(s, x, 5.6, width, 0.46, WHITE, LINE, 0.5, shade=False)
        text(s, x, 5.6, width, 0.46, fact, 13, True, TEXT, PP_ALIGN.CENTER, MSO_ANCHOR.MIDDLE)
        x += width + 0.16
    footer(s, 5)
    notes(
        s,
        "About 40 seconds. React is what people see. Node and Express hold the rules and call the AI. "
        "PostgreSQL stores users, materials, homework, quizzes and results. "
        "The model is an external pre-trained service, Hugging Face, so the key stays on the server. "
        "A browser is enough. Sign-in and roles decide what each person can open.",
    )


def ai_slide(prs, bg):
    s = new(prs, bg)
    eyebrow(s, "Emerging technology")
    text(s, 0.62, 0.84, 12, 0.55, "AI assists. Teachers decide.", 32, True, TEXT)
    items = [
        ("1", "Draft a quiz", "Questions are written from the uploaded PDF, by chapter.", "The teacher edits the draft. Learners cannot see it yet."),
        ("2", "Read the pattern", "Summaries use stored scores and topic results.", "They point to work that may need another look."),
        ("3", "Explain a miss", "A wrong answer is explained from the question and the notes.", "The learner is told what to revise."),
    ]
    for i, (num, title, line, extra) in enumerate(items):
        y = 1.62 + i * 1.55
        box(s, 0.62, y, 12.1, 1.42, WHITE, LINE, 0.12)
        oval(s, 0.88, y + 0.42, 0.56, 0.56, BRAND if i != 1 else BOARD)
        text(s, 0.88, y + 0.42, 0.56, 0.56, num, 16, True, WHITE, PP_ALIGN.CENTER, MSO_ANCHOR.MIDDLE)
        text(s, 1.66, y + 0.16, 10.6, 0.38, title, 20, True, TEXT)
        text(s, 1.66, y + 0.56, 10.6, 0.32, line, 14, False, TEXT)
        text(s, 1.66, y + 0.9, 10.6, 0.32, extra, 14, False, MUTED)
    footer(s, 6)
    notes(
        s,
        "About 40 seconds. AI is used in three places only. It drafts quiz questions from the teacher’s own material. "
        "It summarises stored results and points to topics that may need attention. "
        "When a learner misses a question, it explains why and suggests what to revise. "
        "Nothing is published until a teacher approves it. AI does not decide a pass or fail.",
    )


def prototype_slide(prs, bg):
    s = new(prs, bg)
    eyebrow(s, "Prototype")
    text(s, 0.62, 0.84, 12, 0.55, "What the prototype does", 32, True, TEXT)
    items = [
        ("Sign in", "Admin, teacher, learner or parent.", "Each one opens only their own screens."),
        ("Study material", "The teacher uploads a class PDF.", "The text is extracted and split into chapters."),
        ("Draft quiz", "Choose the chapters and the difficulty.", "Edit the questions, then publish."),
        ("Take a quiz", "The learner answers multiple choice.", "The score is calculated and stored at once."),
        ("Ask why", "Only after a wrong answer.", "The explanation uses that question and the notes."),
        ("Stay in view", "Dashboards show scores and weak topics.", "A teacher can also write to a parent."),
    ]
    for i, (title, line, extra) in enumerate(items):
        col, row = i % 3, i // 3
        x = 0.62 + col * 4.15
        y = 1.62 + row * 2.55
        box(s, x, y, 3.95, 2.38, WHITE, LINE, 0.1)
        text(s, x + 0.26, y + 0.2, 3.4, 0.32, f"{i + 1:02d}", 13, True, BRAND)
        text(s, x + 0.26, y + 0.52, 3.4, 0.4, title, 18, True, TEXT)
        text(s, x + 0.26, y + 1.05, 3.45, 0.5, line, 14, False, TEXT)
        text(s, x + 0.26, y + 1.55, 3.45, 0.55, extra, 13, False, MUTED)
    footer(s, 7)
    notes(
        s,
        "About 40 seconds. A person signs in to their own dashboard. A teacher uploads a PDF and the text is extracted, including by chapter. "
        "They can ask for a draft, choose a difficulty mix, edit it, and only then publish. "
        "A learner takes the quiz, the score is stored, and a wrong answer can ask for an explanation. "
        "Parents can see results, and a teacher can write to them. Homework tracking and term reports are also in the system.",
    )


def results_slide(prs, bg):
    s = new(prs, bg)
    eyebrow(s, "Results and limitations")
    text(s, 0.62, 0.84, 12, 0.55, "What holds, and what does not", 32, True, TEXT)
    holds = [
        "A PDF becomes a quiz only after teacher review",
        "Kept questions are checked against the notes",
        "Score and topic are stored on the dashboards",
        "The teacher can edit, regenerate or reject",
    ]
    limits = [
        "Output can still be vague or off the notes",
        "A scanned PDF has no text to read",
        "If the model fails, a simpler draft is used",
        "A website only. AI does not set the mark",
    ]
    box(s, 0.62, 1.7, 6.0, 4.95, WHITE, LINE, 0.08)
    text(s, 0.92, 1.95, 5.4, 0.4, "What holds", 18, True, BRAND_DEEP)
    for i, line in enumerate(holds):
        y = 2.6 + i * 0.9
        oval(s, 0.98, y + 0.08, 0.16, 0.16, BRAND)
        text(s, 1.35, y - 0.12, 4.95, 0.75, line, 15, False, TEXT)
    box(s, 6.85, 1.7, 6.0, 4.95, WHITE, LINE, 0.08)
    text(s, 7.15, 1.95, 5.4, 0.4, "The limits", 18, True, BOARD)
    for i, line in enumerate(limits):
        y = 2.6 + i * 0.9
        oval(s, 7.2, y + 0.08, 0.16, 0.16, MUTED)
        text(s, 7.55, y - 0.12, 4.95, 0.75, line, 15, False, TEXT)
    footer(s, 8)
    notes(
        s,
        "About 40 seconds. What holds: the path from a PDF to a stored score works, questions are checked against the notes, and the teacher can edit or reject a draft. "
        "The limits: the model can still be vague or wrong, a scanned PDF cannot be read, and if the AI service fails the system builds a simpler draft from the notes. "
        "AI does not decide a pass or fail. It is a website, not a phone app.",
    )


def close_slide(prs, bg, art):
    s = new(prs, bg)
    box(s, 0.55, 1.05, 7.35, 5.35, WHITE, LINE, 0.08)
    text(s, 0.98, 1.55, 6.5, 0.35, "IntelliClass", 16, True, BRAND_DEEP)
    text(s, 0.95, 2.1, 6.5, 1.05, "Questions", 52, True, TEXT)
    text(s, 0.98, 3.35, 6.4, 1.35, "Clearer work.\nLighter admin.\nEarlier support.", 22, False, BOARD)
    text(s, 0.98, 4.9, 6.3, 0.9, "Ask about the quiz path,\nor how the teacher stays in control.", 15, False, MUTED)
    photo(s, art["close"], ART / "close.png", 8.15, 1.35, 4.45)
    notes(
        s,
        "About 15 seconds. Close on those three lines, then take questions. "
        "If a question is about AI, go back to the three uses or the quiz path.",
    )


if __name__ == "__main__":
    build()
