"""Presenter cue sheet aligned with IntelliClass_Presentation.pptx."""

from pathlib import Path

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import parse_xml
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor
from pptx import Presentation

ROOT = Path(__file__).resolve().parent
DOCX = ROOT / "IntelliClass_Presenter_Notes.docx"
PPTX = ROOT / "IntelliClass_Presentation.pptx"

INK = RGBColor(0x0F, 0x76, 0x6E)
TEXT = RGBColor(0x1E, 0x29, 0x3B)
MUTED = RGBColor(0x64, 0x74, 0x8B)
TEAL = "0D9488"

SLIDES = [
    {
        "n": "1",
        "title": "IntelliClass",
        "on": "One place for homework, quizzes and progress. Accountability, less admin, a clearer parent view.",
        "say": [
            "About 20 seconds.",
            "IntelliClass is a web platform for schools.",
            "It keeps homework, quizzes, study material and performance in one place.",
            "AI assists. Teachers still decide what learners see.",
        ],
        "ppt": (
            "About 20 seconds. IntelliClass is a web platform for schools. It keeps homework, quizzes, study material and performance in one place. "
            "AI assists. Teachers still decide what learners see."
        ),
    },
    {
        "n": "2",
        "title": "The problem",
        "on": "Missed work, slow preparation, late news for parents, no single record — and why each one matters.",
        "say": [
            "About 40 seconds.",
            "Homework is easy to miss.",
            "Teachers still spend a long time preparing assessments by hand.",
            "Parents often only hear how a child is doing at report time.",
            "There is no single record they can all use.",
        ],
        "ppt": (
            "About 40 seconds. Homework is easy to miss. Teachers still spend a long time preparing assessments by hand. "
            "Parents often only hear at report time. There is no single record they can all use."
        ),
    },
    {
        "n": "3",
        "title": "The proposed solution",
        "on": "What each role actually does, including teacher review of AI drafts.",
        "say": [
            "About 30 seconds.",
            "The proposal is one platform and four roles.",
            "The next slide shows the exact work each person can do.",
            "The aim is more accountability, less admin, and earlier support.",
        ],
        "ppt": (
            "About 30 seconds. The proposal is one platform and four roles. "
            "The next slide shows the exact work each person can do. "
            "The aim is more accountability, less admin, and earlier support."
        ),
    },
    {
        "n": "4",
        "title": "Who does what",
        "on": "Use cases: setup, upload, AI draft, review and publish, quiz, explanation, parent progress.",
        "say": [
            "About 35 seconds. Point at the people. Do not read every oval.",
            "The administrator sets up users, classes and subjects.",
            "The teacher uploads the notes, asks for a draft, then reviews and publishes.",
            "The learner takes only a published quiz, and can ask why an answer was wrong.",
            "The parent views progress.",
            "The tinted cases call Hugging Face.",
            "A quiz stays hidden until the teacher publishes it.",
        ],
        "ppt": (
            "About 35 seconds. Point to the four people rather than reading every oval. "
            "The administrator sets up users, classes and subjects. "
            "The teacher uploads the notes, asks for a draft, then reviews and publishes. "
            "The learner takes only a published quiz and can ask why an answer was wrong. "
            "The parent views progress. The tinted cases call Hugging Face. "
            "A quiz stays hidden until the teacher includes that review and publishes it."
        ),
    },
    {
        "n": "5",
        "title": "Architecture",
        "on": "React dashboards, Node sign-in and AI call, PostgreSQL records, Hugging Face.",
        "say": [
            "About 40 seconds.",
            "React is what people see.",
            "Node and Express hold the rules and call the AI.",
            "PostgreSQL stores users, materials, homework, quizzes and results.",
            "The model is an external pre-trained service, so the key stays on the server.",
            "A browser is enough. Each role only opens its own functions.",
        ],
        "ppt": (
            "About 40 seconds. React is what people see. Node and Express hold the rules and call the AI. "
            "PostgreSQL stores the records. The model is an external pre-trained service, Hugging Face, so the key stays on the server. "
            "A browser is enough. Sign-in and roles decide what each person can open."
        ),
    },
    {
        "n": "6",
        "title": "Emerging technology",
        "on": "Draft from the PDF, summarise stored scores, explain a wrong answer. Not published yet.",
        "say": [
            "About 40 seconds.",
            "AI is used in three places only.",
            "It drafts quiz questions from the teacher’s own study material.",
            "It summarises stored results and points to topics that may need attention.",
            "When a learner misses a question, it explains why and suggests what to revise.",
            "Nothing is published until a teacher approves it. AI does not decide a pass or fail.",
        ],
        "ppt": (
            "About 40 seconds. AI drafts quiz questions from the teacher’s own material. "
            "It summarises stored results and points to topics that may need attention. "
            "When a learner misses a question, it explains why and suggests what to revise. "
            "Nothing is published until a teacher approves it. AI does not decide a pass or fail."
        ),
    },
    {
        "n": "7",
        "title": "Prototype",
        "on": "Role sign-in, chapter PDFs, difficulty and publish, stored score, explanation, parent note.",
        "say": [
            "About 40 seconds.",
            "A person signs in to their own dashboard.",
            "A teacher uploads a PDF. The text is extracted, including by chapter.",
            "They can ask for a draft, choose a difficulty mix, edit it, and only then publish.",
            "A learner takes the quiz, the score is stored, and a wrong answer can ask for an explanation.",
            "Parents can see results, and a teacher can write to them.",
            "Homework tracking and term reports are also in the system.",
        ],
        "ppt": (
            "About 40 seconds. A person signs in to their own dashboard. A teacher uploads a PDF and the text is extracted, including by chapter. "
            "They can ask for a draft, choose a difficulty mix, edit it, and only then publish. "
            "A learner takes the quiz, the score is stored, and a wrong answer can ask for an explanation. "
            "Parents can see results, and a teacher can write to them. Homework tracking and term reports are also in the system."
        ),
    },
    {
        "n": "8",
        "title": "Results and limitations",
        "on": "Review before publish, notes check, stored scores. Vague output, scanned PDFs, fallback, no pass mark.",
        "say": [
            "About 40 seconds.",
            "The path from a PDF to a stored score works.",
            "Questions are checked against the notes, and the teacher can edit or reject a draft.",
            "The model can still be vague or wrong.",
            "A scanned PDF cannot be read.",
            "If the AI service fails, a simpler draft is built straight from the notes.",
            "It is a website, not a phone app.",
        ],
        "ppt": (
            "About 40 seconds. The path from a PDF to a stored score works. Questions are checked against the notes, and the teacher can edit or reject a draft. "
            "The model can still be vague or wrong. A scanned PDF cannot be read. "
            "If the AI service fails, a simpler draft is built from the notes. AI does not decide a pass or fail. It is a website, not a phone app."
        ),
    },
    {
        "n": "9",
        "title": "Questions",
        "on": "Clearer work. Lighter admin. Earlier support.",
        "say": [
            "About 15 seconds.",
            "Close on those three lines.",
            "Then take questions.",
            "If a question is about AI, go back to the three uses or the quiz path.",
        ],
        "ppt": (
            "About 15 seconds. Close on those three lines, then take questions. "
            "If a question is about AI, go back to the three uses or the quiz path."
        ),
    },
]


def banner(doc, number, title, space_before):
    gap = doc.add_paragraph()
    gap.paragraph_format.space_before = Pt(0)
    gap.paragraph_format.space_after = Pt(0)
    gap.paragraph_format.line_spacing = 1
    set_run(gap.add_run(), "", 6, False, TEXT)
    if space_before:
        gap.paragraph_format.space_before = Pt(space_before)
    table = doc.add_table(rows=1, cols=1)
    table.autofit = False
    cell = table.cell(0, 0)
    cell.width = Cm(17.6)
    tc = cell._tc
    tc_pr = tc.get_or_add_tcPr()
    tc_pr.append(
        parse_xml(
            f'<w:shd xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" w:val="clear" w:color="auto" w:fill="{TEAL}"/>'
        )
    )
    tc_pr.append(
        parse_xml(
            '<w:tcMar xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
            '<w:top w:w="80" w:type="dxa"/><w:left w:w="140" w:type="dxa"/>'
            '<w:bottom w:w="80" w:type="dxa"/><w:right w:w="140" w:type="dxa"/>'
            "</w:tcMar>"
        )
    )
    borders = (
        '<w:tcBorders xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
        '<w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/>'
        "</w:tcBorders>"
    )
    tc_pr.append(parse_xml(borders))
    p = cell.paragraphs[0]
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(0)
    set_run(p.add_run(), f"{number}     {title}", 16, True, RGBColor(0xFF, 0xFF, 0xFF))
    return table


def set_run(run, text, size, bold, color, font="Calibri"):
    run.text = text
    run.bold = bold
    run.font.name = font
    run.font.size = Pt(size)
    run.font.color.rgb = color
    run._element.rPr.rFonts.set(qn("w:eastAsia"), font)


def add_line(doc, text, size, bold, color, space_before=0, space_after=2, indent=0):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(space_before)
    p.paragraph_format.space_after = Pt(space_after)
    p.paragraph_format.line_spacing = 1.08
    if indent:
        p.paragraph_format.left_indent = Cm(indent)
    set_run(p.add_run(), text, size, bold, color)
    return p


def build_docx():
    doc = Document()
    section = doc.sections[0]
    section.page_width = Cm(21.0)
    section.page_height = Cm(29.7)
    section.left_margin = Cm(1.7)
    section.right_margin = Cm(1.7)
    section.top_margin = Cm(1.5)
    section.bottom_margin = Cm(1.5)

    header = section.header.paragraphs[0]
    header.alignment = WD_ALIGN_PARAGRAPH.LEFT
    set_run(header.add_run(), "IntelliClass  ·  presenter notes", 10, False, MUTED)
    footer = section.footer.paragraphs[0]
    footer.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    set_run(footer.add_run(), "Follow the slides in order", 10, False, MUTED)

    add_line(doc, "Presenter notes", 26, True, TEXT, space_after=0)
    add_line(doc, "Five minutes. Each block matches one slide, in order.", 12, False, MUTED, space_before=2, space_after=10)

    for i, slide in enumerate(SLIDES):
        banner(doc, slide["n"], slide["title"], 10 if i else 2)
        add_line(doc, "On the slide", 10, True, INK, space_before=8, space_after=0)
        add_line(doc, slide["on"], 12, False, MUTED, space_after=4)
        add_line(doc, "Say", 10, True, INK, space_before=2, space_after=1)
        for line in slide["say"]:
            add_line(doc, line, 13, False, TEXT, space_after=1, indent=0.3)
        if i % 2 == 1 and i != len(SLIDES) - 1:
            doc.add_page_break()

    doc.save(DOCX)


def update_pptx():
    prs = Presentation(PPTX)
    slides = list(prs.slides)
    if len(slides) != len(SLIDES):
        raise SystemExit(f"Expected {len(SLIDES)} slides, found {len(slides)}")
    for slide, item in zip(slides, SLIDES):
        frame = slide.notes_slide.notes_text_frame
        frame.text = item["ppt"]
    prs.save(PPTX)


if __name__ == "__main__":
    build_docx()
    update_pptx()
    print(DOCX)
