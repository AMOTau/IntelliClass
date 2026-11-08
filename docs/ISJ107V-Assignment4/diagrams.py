"""Compact UML figures for the IntelliClass prototype report."""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).resolve().parent / "figures"
DPI = 180
SCALE = 2

BOARD = (26, 92, 74)
BRAND = (15, 138, 122)
INK = (31, 58, 52)
MUTED = (90, 108, 104)
LINE = (47, 92, 82)
WHITE = (255, 255, 255)
PALE = (244, 247, 244)
SOFT = (231, 243, 239)
GOLD = (176, 122, 58)
CREAM = (255, 250, 242)

FONTS = {
    "regular": r"C:\Windows\Fonts\segoeui.ttf",
    "semibold": r"C:\Windows\Fonts\seguisb.ttf",
    "bold": r"C:\Windows\Fonts\segoeuib.ttf",
}


class Canvas:
    def __init__(self, w, h):
        self.w, self.h = w, h
        self.im = Image.new("RGB", (w * SCALE, h * SCALE), PALE)
        self.d = ImageDraw.Draw(self.im)

    def font(self, size, weight="regular"):
        return ImageFont.truetype(FONTS[weight], size * SCALE)

    def text(self, xy, value, font, fill=INK, anchor="mm"):
        self.d.text((xy[0] * SCALE, xy[1] * SCALE), value, font=font, fill=fill, anchor=anchor)

    def rect(self, box, fill, outline=LINE, width=2, radius=16):
        self.d.rounded_rectangle([c * SCALE for c in box], radius * SCALE, fill=fill, outline=outline, width=width * SCALE)

    def ellipse(self, box, fill, outline=LINE, width=2):
        self.d.ellipse([c * SCALE for c in box], fill=fill, outline=outline, width=width * SCALE)

    def line(self, pts, fill=LINE, width=2):
        self.d.line([(x * SCALE, y * SCALE) for x, y in pts], fill=fill, width=width * SCALE)

    def save(self, name):
        OUT.mkdir(exist_ok=True)
        path = OUT / name
        self.im.save(path)
        return path


def actor(c, x, y, name):
    f = c.font(22, "semibold")
    c.ellipse((x - 16, y, x + 16, y + 32), WHITE)
    c.line([(x, y + 32), (x, y + 78)], width=3)
    c.line([(x - 28, y + 48), (x + 28, y + 48)], width=3)
    c.line([(x, y + 78), (x - 24, y + 112)], width=3)
    c.line([(x, y + 78), (x + 24, y + 112)], width=3)
    c.text((x, y + 136), name, f)


def usecase():
    c = Canvas(1180, 820)
    c.rect((250, 40, 930, 760), WHITE, radius=22)
    c.text((590, 72), "IntelliClass prototype", c.font(26, "bold"), BOARD)
    cases = [
        (590, 140, "Sign in"),
        (430, 250, "Manage school setup"),
        (750, 250, "View progress"),
        (430, 370, "Upload study material"),
        (750, 370, "Take published quiz"),
        (430, 490, "Generate AI quiz"),
        (750, 490, "Request explanation"),
        (590, 620, "Review and publish"),
    ]
    for x, y, label in cases:
        fill = SOFT if "AI" in label or "explanation" in label else WHITE
        c.ellipse((x - 145, y - 36, x + 145, y + 36), fill)
        c.text((x, y), label, c.font(20, "semibold"))
    actor(c, 110, 180, "Administrator")
    actor(c, 110, 430, "Teacher")
    actor(c, 1070, 180, "Learner")
    actor(c, 1070, 430, "Parent")
    c.rect((960, 640, 1160, 760), CREAM, GOLD, radius=14)
    c.text((1060, 678), "AI Service", c.font(20, "bold"), GOLD)
    c.text((1060, 714), "Hugging Face", c.font(18), MUTED)
    # associations, kept outside the labels
    links = [
        ((150, 250), (445, 250)),
        ((150, 500), (285, 370)),
        ((150, 520), (285, 490)),
        ((150, 540), (445, 620)),
        ((930, 250), (1030, 250)),
        ((930, 370), (1030, 370)),
        ((1030, 500), (820, 286)),
        ((930, 490), (960, 680)),
        ((735, 490), (960, 700)),
        ((575, 526), (575, 584)),
    ]
    for a, b in links:
        c.line([a, b], width=2)
    c.text((590, 790), "Generate quiz includes review before a learner can take it", c.font(18), MUTED)
    c.save("01-usecase.png")


def activity():
    c = Canvas(1180, 980)
    f = c.font(20, "semibold")
    small = c.font(18)

    def step(x, y, w, h, label, fill=WHITE):
        c.rect((x, y, x + w, y + h), fill, radius=14)
        c.text((x + w / 2, y + h / 2), label, f)

    def diamond(x, y, label):
        pts = [(x, y - 38), (x + 150, y), (x, y + 38), (x - 150, y)]
        c.d.polygon([(p[0] * SCALE, p[1] * SCALE) for p in pts], fill=CREAM, outline=GOLD)
        c.text((x, y), label, small)

    c.ellipse((540, 16, 640, 52), BOARD, BOARD)
    c.text((590, 34), "Start", c.font(18, "bold"), WHITE)
    step(390, 80, 400, 52, "Teacher uploads a PDF")
    diamond(590, 190, "Readable text?")
    step(860, 164, 250, 52, "Show an error", CREAM)
    step(390, 250, 400, 52, "Send the notes to the AI", SOFT)
    diamond(590, 370, "Usable questions?")
    step(860, 344, 270, 52, "Build from the notes", SOFT)
    step(390, 430, 400, 52, "Teacher reviews the draft")
    diamond(590, 550, "Approve?")
    step(80, 524, 250, 52, "Edit or reject", CREAM)
    step(390, 620, 400, 52, "Publish the quiz")
    step(390, 700, 400, 52, "Learner submits answers")
    step(390, 780, 400, 52, "Store the score")
    diamond(590, 890, "Wrong answer?")
    c.ellipse((560, 940, 620, 972), BOARD, BOARD)
    # connectors
    for y1, y2 in ((52, 80), (132, 152), (302, 344), (482, 512), (672, 700), (752, 780), (832, 852)):
        c.line([(590, y1), (590, y2)], width=2)
    c.line([(740, 190), (860, 190)], width=2)
    c.line([(740, 370), (860, 370)], width=2)
    c.line([(440, 550), (330, 550)], width=2)
    c.line([(995, 396), (995, 456), (790, 456)], width=2)
    c.line([(205, 524), (205, 456), (390, 456)], width=2)
    c.text((800, 168), "No", small, GOLD)
    c.text((590, 230), "Yes", small, BRAND, anchor="mt")
    c.text((800, 348), "No", small, GOLD)
    c.text((200, 500), "No", small, GOLD)
    c.text((620, 600), "Yes", small, BRAND, anchor="lt")
    c.text((760, 890), "Yes: explain", small, BRAND, anchor="lm")
    c.text((430, 890), "No: show result", small, MUTED, anchor="rm")
    c.save("02-activity.png")


def class_diagram():
    c = Canvas(1180, 860)
    header = c.font(22, "bold")
    body = c.font(18)

    def cls(x, y, w, h, title, lines, fill=WHITE):
        c.rect((x, y, x + w, y + h), fill, radius=12)
        c.line([(x, y + 40), (x + w, y + 40)])
        c.text((x + w / 2, y + 20), title, header, BOARD)
        for i, line in enumerate(lines):
            c.text((x + 16, y + 64 + i * 26), line, body, anchor="lm")

    cls(40, 30, 250, 150, "User", ["id", "email", "password hash", "role"])
    cls(330, 30, 250, 150, "ClassGroup", ["id", "name", "grade level"])
    cls(620, 30, 250, 150, "Subject", ["id", "name", "code"])
    cls(910, 30, 230, 120, "AiService", ["generateQuiz()", "explainAnswer()"], SOFT)
    cls(40, 280, 280, 200, "StudyMaterial", ["id", "title", "file path", "extracted text", "upload()"])
    cls(360, 280, 280, 200, "Quiz", ["id", "title", "status", "publish()", "saveDraft()"])
    cls(680, 280, 280, 200, "Question", ["questionText", "options", "correctAnswer", "difficulty", "topic"])
    cls(360, 560, 300, 180, "QuizResult", ["id", "score", "submitted at", "calculateScore()"])
    cls(720, 560, 300, 150, "ParentLink", ["parent id", "learner id"])
    notes = [
        "User.role is admin, teacher, learner or parent",
        "Quiz.status is draft until a teacher publishes it",
        "AiService is external. The API key stays on the server",
    ]
    y = 760
    for note in notes:
        c.text((40, y), note, c.font(18), MUTED, anchor="lm")
        y += 28
    # relationships
    c.line([(165, 180), (165, 280)], width=2)
    c.text((175, 230), "1 uploads *", c.font(16), MUTED, anchor="lm")
    c.line([(320, 380), (360, 380)], width=2)
    c.text((340, 360), "1..*", c.font(16), MUTED)
    c.line([(640, 380), (680, 380)], width=2)
    c.text((660, 360), "1..*", c.font(16), MUTED)
    c.line([(500, 480), (500, 560)], width=2)
    c.text((510, 520), "1 .. *", c.font(16), MUTED, anchor="lm")
    c.line([(960, 150), (800, 280)], width=2)
    c.text((900, 200), "uses", c.font(16), BRAND)
    c.save("03-class.png")


def sequence():
    c = Canvas(1180, 900)
    names = ["Teacher", "React UI", "Express API", "PostgreSQL", "Hugging Face"]
    xs = [110, 340, 590, 840, 1060]
    f = c.font(18, "bold")
    for x, name in zip(xs, names):
        fill = SOFT if name == "Hugging Face" else WHITE
        c.rect((x - 90, 24, x + 90, 78), fill, radius=12)
        c.text((x, 51), name, f, BOARD)
        c.line([(x, 78), (x, 860)], LINE, 2)
    steps = [
        (0, 1, "Upload PDF"),
        (1, 2, "POST /api/materials"),
        (2, 2, "Extract text and save"),
        (3, 2, "Saved"),
        (0, 1, "Generate quiz"),
        (1, 2, "POST /api/ai/generate-quiz"),
        (2, 3, "Load extracted text"),
        (2, 4, "Notes and instructions"),
        (4, 2, "Draft questions"),
        (2, 2, "Validate and save draft"),
        (2, 1, "Show the draft"),
        (0, 1, "Approve"),
        (1, 2, "POST /quizzes/:id/publish"),
    ]
    y = 120
    msg = c.font(17, "semibold")
    for src, dst, label in steps:
        if src == dst:
            c.line([(xs[src], y), (xs[src] + 46, y), (xs[src] + 46, y + 28), (xs[src], y + 28)], BRAND, 2)
            c.text((xs[src] + 54, y + 14), label, msg, anchor="lm")
            y += 70
        else:
            colour = BRAND if 4 in (src, dst) else LINE
            c.line([(xs[src], y), (xs[dst], y)], colour, 2)
            mid = (xs[src] + xs[dst]) / 2
            c.text((mid, y - 14), label, msg, colour if colour == BRAND else INK)
            y += 48
    c.save("04-sequence.png")


def deployment():
    c = Canvas(1180, 520)
    f = c.font(22, "bold")
    small = c.font(18)
    boxes = [
        (40, 150, 250, 180, "Browser", "React + Vite", WHITE),
        (390, 150, 280, 180, "Application server", "Node.js + Express", WHITE),
        (820, 40, 310, 150, "PostgreSQL", "Users, materials, quizzes, scores", WHITE),
        (820, 250, 310, 150, "Hugging Face", "Pre-trained model", SOFT),
    ]
    for x, y, w, h, title, subtitle, fill in boxes:
        c.rect((x, y, x + w, y + h), fill, radius=16)
        c.text((x + w / 2, y + 58), title, f, BOARD)
        c.text((x + w / 2, y + 104), subtitle, small, MUTED)
    c.line([(290, 240), (390, 240)], width=3)
    c.text((340, 218), "HTTPS", small, MUTED)
    c.line([(670, 210), (820, 115)], width=3)
    c.line([(670, 270), (820, 325)], BRAND, 3)
    c.text((760, 150), "SQL", small, MUTED)
    c.text((700, 310), "API key on server", small, BRAND)
    c.save("05-deployment.png")


if __name__ == "__main__":
    usecase()
    activity()
    class_diagram()
    sequence()
    deployment()
    print(OUT)
