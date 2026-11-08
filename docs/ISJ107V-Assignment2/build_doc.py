"""Build the ISJ107V Assignment 2 Word document."""

from __future__ import annotations

from pathlib import Path

from docx import Document
from docx.enum.section import WD_ORIENT, WD_SECTION
from docx.enum.table import WD_CELL_VERTICAL_ALIGNMENT, WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_LINE_SPACING, WD_TAB_ALIGNMENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Inches, Mm, Pt, RGBColor, Twips

ROOT = Path(__file__).resolve().parent
FIG = ROOT / "figures"
OUT = ROOT / "ISJ107V_Assignment2_IntelliClass.docx"

NAVY = RGBColor(0x0E, 0x2A, 0x47)
TEAL = RGBColor(0x0F, 0x6E, 0x6B)
INK = RGBColor(0x1F, 0x2A, 0x33)
SLATE = RGBColor(0x3D, 0x4A, 0x5C)
GOLD = RGBColor(0x8A, 0x68, 0x28)

CONTENT_CM = 17.6


def cm_twips(value: float) -> int:
    return int(round(value / 2.54 * 1440))


def set_run_font(run, name, size, bold=False, italic=False, color=INK):
    run.font.name = name
    run.font.size = Pt(size)
    run.bold = bold
    run.italic = italic
    run.font.color.rgb = color
    rPr = run._r.get_or_add_rPr()
    rFonts = rPr.find(qn("w:rFonts"))
    if rFonts is None:
        rFonts = OxmlElement("w:rFonts")
        rPr.append(rFonts)
    for attr in ("w:ascii", "w:hAnsi", "w:cs", "w:eastAsia"):
        rFonts.set(qn(attr), name)


def style_font(style, name, size, bold, color, before, after, line=1.15, align=None):
    style.font.name = name
    style.font.size = Pt(size)
    style.font.bold = bold
    style.font.italic = False
    style.font.color.rgb = color
    pf = style.paragraph_format
    pf.space_before = Pt(before)
    pf.space_after = Pt(after)
    pf.line_spacing = line
    if align is not None:
        pf.alignment = align
    rPr = style.element.get_or_add_rPr()
    rFonts = rPr.find(qn("w:rFonts"))
    if rFonts is None:
        rFonts = OxmlElement("w:rFonts")
        rPr.append(rFonts)
    for attr in ("w:ascii", "w:hAnsi", "w:cs", "w:eastAsia"):
        rFonts.set(qn(attr), name)


def shade(cell, hex_color):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:fill"), hex_color)
    shd.set(qn("w:val"), "clear")
    tcPr.append(shd)


def set_table_borders(table, color="D5DEE7", size="6"):
    tblPr = table._tbl.tblPr
    borders = OxmlElement("w:tblBorders")
    for edge in ("top", "left", "bottom", "right", "insideH", "insideV"):
        el = OxmlElement(f"w:{edge}")
        el.set(qn("w:val"), "single")
        el.set(qn("w:sz"), size)
        el.set(qn("w:space"), "0")
        el.set(qn("w:color"), color)
        borders.append(el)
    tblPr.append(borders)


def set_cell_margins(table, top=46, bottom=46, left=80, right=80):
    tblPr = table._tbl.tblPr
    mar = OxmlElement("w:tblCellMar")
    for name, val in (("top", top), ("left", left), ("bottom", bottom), ("right", right)):
        node = OxmlElement(f"w:{name}")
        node.set(qn("w:w"), str(val))
        node.set(qn("w:type"), "dxa")
        mar.append(node)
    tblPr.append(mar)


def set_widths(table, widths_cm):
    widths = [cm_twips(w) for w in widths_cm]
    table.autofit = False
    table.allow_autofit = False
    tbl = table._tbl
    tblPr = tbl.tblPr
    tblW = tblPr.find(qn("w:tblW"))
    if tblW is None:
        tblW = OxmlElement("w:tblW")
        tblPr.append(tblW)
    tblW.set(qn("w:w"), str(sum(widths)))
    tblW.set(qn("w:type"), "dxa")
    grid = tbl.find(qn("w:tblGrid"))
    if grid is None:
        grid = OxmlElement("w:tblGrid")
        tblPr.addnext(grid)
    for child in list(grid):
        grid.remove(child)
    for w in widths:
        gc = OxmlElement("w:gridCol")
        gc.set(qn("w:w"), str(w))
        grid.append(gc)
    for row in table.rows:
        for cell, w in zip(row.cells, widths):
            cell.width = Twips(w)
            tcPr = cell._tc.get_or_add_tcPr()
            tcW = tcPr.find(qn("w:tcW"))
            if tcW is None:
                tcW = OxmlElement("w:tcW")
                tcPr.append(tcW)
            tcW.set(qn("w:w"), str(w))
            tcW.set(qn("w:type"), "dxa")


def keep_row(row, header=False):
    trPr = row._tr.get_or_add_trPr()
    trPr.append(OxmlElement("w:cantSplit"))
    if header:
        trPr.append(OxmlElement("w:tblHeader"))


def cell_para(cell, text, size=10, bold=False, color=INK, align="left", fill=None):
    cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER if bold else WD_CELL_VERTICAL_ALIGNMENT.TOP
    if fill:
        shade(cell, fill)
    p = cell.paragraphs[0]
    p.alignment = {
        "left": WD_ALIGN_PARAGRAPH.LEFT,
        "center": WD_ALIGN_PARAGRAPH.CENTER,
    }[align]
    p.paragraph_format.space_before = Pt(1)
    p.paragraph_format.space_after = Pt(1)
    p.paragraph_format.line_spacing = 1.05
    p.text = ""
    run = p.add_run(text)
    set_run_font(run, "Calibri", size, bold=bold, color=color)
    return run


def add_table(doc, headers, rows, widths, col_align=None):
    table = doc.add_table(rows=1 + len(rows), cols=len(headers))
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.style = "Table Grid"
    set_table_borders(table)
    set_cell_margins(table)
    set_widths(table, widths)
    col_align = col_align or ["left"] * len(headers)
    for i, header in enumerate(headers):
        cell_para(table.rows[0].cells[i], header, size=10, bold=True, color=RGBColor(255, 255, 255), align="left", fill="0E2A47")
    keep_row(table.rows[0], header=True)
    for r, row in enumerate(rows):
        fill = "F4F7FB" if r % 2 == 0 else "FFFFFF"
        for c, value in enumerate(row):
            color = INK
            bold = c == 0
            if c == 1 and value in ("Must", "Should"):
                color = NAVY if value == "Must" else TEAL
                bold = True
            cell_para(table.rows[r + 1].cells[c], value, size=10, bold=bold, color=color, align=col_align[c], fill=fill)
        keep_row(table.rows[r + 1])
    spacer = doc.add_paragraph()
    spacer.paragraph_format.space_before = Pt(2)
    spacer.paragraph_format.space_after = Pt(6)
    return table


def body(doc, text, space_after=8):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(space_after)
    p.paragraph_format.line_spacing = 1.15
    run = p.add_run(text)
    set_run_font(run, "Calibri", 12, color=INK)
    return p


def rich(doc, parts, space_after=8, justify=True):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY if justify else WD_ALIGN_PARAGRAPH.LEFT
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(space_after)
    p.paragraph_format.line_spacing = 1.15
    for text, bold, italic in parts:
        run = p.add_run(text)
        set_run_font(run, "Calibri", 12, bold=bold, italic=italic, color=INK)
    return p


def bullet(doc, text, bold_lead=None):
    p = doc.add_paragraph()
    p.paragraph_format.left_indent = Cm(0.75)
    p.paragraph_format.first_line_indent = Cm(-0.4)
    p.paragraph_format.space_before = Pt(1)
    p.paragraph_format.space_after = Pt(2)
    p.paragraph_format.line_spacing = 1.12
    mark = p.add_run("•  ")
    set_run_font(mark, "Calibri", 12, color=TEAL)
    if bold_lead:
        lead = p.add_run(bold_lead)
        set_run_font(lead, "Calibri", 12, bold=True, color=NAVY)
        rest = p.add_run(text)
        set_run_font(rest, "Calibri", 12, color=INK)
    else:
        run = p.add_run(text)
        set_run_font(run, "Calibri", 12, color=INK)
    return p


def numbered(doc, n, text):
    p = doc.add_paragraph()
    p.paragraph_format.left_indent = Cm(0.75)
    p.paragraph_format.first_line_indent = Cm(-0.45)
    p.paragraph_format.space_before = Pt(2)
    p.paragraph_format.space_after = Pt(4)
    p.paragraph_format.line_spacing = 1.15
    p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    lead = p.add_run(f"{n}.  ")
    set_run_font(lead, "Calibri", 12, bold=True, color=NAVY)
    run = p.add_run(text)
    set_run_font(run, "Calibri", 12, color=INK)
    return p


def h1(doc, text, marks=None):
    p = doc.add_paragraph()
    p.style = doc.styles["Heading 1"]
    p.paragraph_format.page_break_before = True
    p.paragraph_format.keep_with_next = True
    p.paragraph_format.tab_stops.add_tab_stop(Cm(CONTENT_CM), WD_TAB_ALIGNMENT.RIGHT)
    run = p.add_run(text)
    set_run_font(run, "Cambria", 18, bold=True, color=NAVY)
    if marks:
        p.add_run("\t")
        mark = p.add_run(marks)
        set_run_font(mark, "Calibri", 11, italic=True, color=TEAL)
    pPr = p._p.get_or_add_pPr()
    pBdr = OxmlElement("w:pBdr")
    bottom = OxmlElement("w:bottom")
    bottom.set(qn("w:val"), "single")
    bottom.set(qn("w:sz"), "12")
    bottom.set(qn("w:space"), "1")
    bottom.set(qn("w:color"), "0F6E6B")
    pBdr.append(bottom)
    pPr.append(pBdr)
    return p


def h2(doc, text):
    p = doc.add_paragraph()
    p.style = doc.styles["Heading 2"]
    p.paragraph_format.keep_with_next = True
    run = p.add_run(text)
    set_run_font(run, "Cambria", 14, bold=True, color=NAVY)
    return p


def h3(doc, text):
    p = doc.add_paragraph()
    p.style = doc.styles["Heading 3"]
    p.paragraph_format.keep_with_next = True
    run = p.add_run(text)
    set_run_font(run, "Calibri", 12, bold=True, color=TEAL)
    return p


def table_caption(doc, text):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(10)
    p.paragraph_format.space_after = Pt(4)
    p.paragraph_format.keep_with_next = True
    label, _, rest = text.partition(" ")
    number, _, title = rest.partition(" ")
    # text is "Table 1  Title"
    r1 = p.add_run(text.split("  ", 1)[0] + "  ")
    set_run_font(r1, "Calibri", 10, bold=True, color=NAVY)
    r2 = p.add_run(text.split("  ", 1)[1])
    set_run_font(r2, "Calibri", 10, italic=True, color=SLATE)
    return p


def figure(doc, path, width, caption):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(6)
    p.paragraph_format.space_after = Pt(2)
    p.paragraph_format.keep_together = True
    run = p.add_run()
    run.add_picture(str(path), width=Inches(width))
    cap = doc.add_paragraph()
    cap.alignment = WD_ALIGN_PARAGRAPH.CENTER
    cap.paragraph_format.space_before = Pt(2)
    cap.paragraph_format.space_after = Pt(10)
    head, _, rest = caption.partition("  ")
    r1 = cap.add_run(head + "  ")
    set_run_font(r1, "Calibri", 10, bold=True, color=NAVY)
    r2 = cap.add_run(rest)
    set_run_font(r2, "Calibri", 10, italic=True, color=SLATE)
    return cap


def code_block(doc, text):
    table = doc.add_table(rows=1, cols=1)
    set_widths(table, [CONTENT_CM])
    set_table_borders(table, "D5DEE7", "4")
    cell = table.cell(0, 0)
    shade(cell, "F4F7FB")
    tcPr = cell._tc.get_or_add_tcPr()
    borders = OxmlElement("w:tcBorders")
    left = OxmlElement("w:left")
    left.set(qn("w:val"), "single")
    left.set(qn("w:sz"), "16")
    left.set(qn("w:space"), "0")
    left.set(qn("w:color"), "0F6E6B")
    borders.append(left)
    tcPr.append(borders)
    lines = text.strip("\n").split("\n")
    for i, line in enumerate(lines):
        p = cell.paragraphs[0] if i == 0 else cell.add_paragraph()
        p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.space_after = Pt(0)
        p.paragraph_format.line_spacing = 1.05
        run = p.add_run(line if line else " ")
        set_run_font(run, "Consolas", 9.5, color=INK)
    spacer = doc.add_paragraph()
    spacer.paragraph_format.space_before = Pt(2)
    spacer.paragraph_format.space_after = Pt(6)


def header_footer(section, width_cm, show_number=True):
    header = section.header
    header.is_linked_to_previous = False
    hp = header.paragraphs[0]
    hp.text = ""
    hp.paragraph_format.space_before = Pt(0)
    hp.paragraph_format.space_after = Pt(2)
    hp.paragraph_format.tab_stops.add_tab_stop(Cm(width_cm), WD_TAB_ALIGNMENT.RIGHT)
    left = hp.add_run("ISJ107V  ·  Assignment 2")
    set_run_font(left, "Calibri", 9, color=NAVY)
    hp.add_run("\t")
    right = hp.add_run("IntelliClass")
    set_run_font(right, "Calibri", 9, bold=True, color=TEAL)
    pPr = hp._p.get_or_add_pPr()
    pBdr = OxmlElement("w:pBdr")
    bottom = OxmlElement("w:bottom")
    bottom.set(qn("w:val"), "single")
    bottom.set(qn("w:sz"), "8")
    bottom.set(qn("w:space"), "1")
    bottom.set(qn("w:color"), "0E2A47")
    pBdr.append(bottom)
    pPr.append(pBdr)

    footer = section.footer
    footer.is_linked_to_previous = False
    fp = footer.paragraphs[0]
    fp.text = ""
    fp.alignment = WD_ALIGN_PARAGRAPH.LEFT
    fp.paragraph_format.tab_stops.add_tab_stop(Cm(width_cm), WD_TAB_ALIGNMENT.RIGHT)
    fl = fp.add_run("Formal System Proposal and Specification")
    set_run_font(fl, "Calibri", 9, color=SLATE)
    if show_number:
        fp.add_run("\t")
        pre = fp.add_run("Page ")
        set_run_font(pre, "Calibri", 9, color=NAVY)
        add_field(fp, " PAGE ")
        of_ = fp.add_run(" of ")
        set_run_font(of_, "Calibri", 9, color=NAVY)
        add_field(fp, " NUMPAGES ")


def add_field(paragraph, instruction):
    run = paragraph.add_run()
    begin = OxmlElement("w:fldChar")
    begin.set(qn("w:fldCharType"), "begin")
    instr = OxmlElement("w:instrText")
    instr.set(qn("xml:space"), "preserve")
    instr.text = instruction
    separate = OxmlElement("w:fldChar")
    separate.set(qn("w:fldCharType"), "separate")
    text = OxmlElement("w:t")
    text.text = " "
    end = OxmlElement("w:fldChar")
    end.set(qn("w:fldCharType"), "end")
    r = run._r
    r.append(begin)
    r.append(instr)
    r.append(separate)
    r.append(text)
    r.append(end)
    set_run_font(run, "Calibri", 9, bold=True, color=NAVY)


def add_toc(paragraph):
    run = paragraph.add_run()
    begin = OxmlElement("w:fldChar")
    begin.set(qn("w:fldCharType"), "begin")
    instr = OxmlElement("w:instrText")
    instr.set(qn("xml:space"), "preserve")
    instr.text = r' TOC \o "1-2" \h \z \u '
    separate = OxmlElement("w:fldChar")
    separate.set(qn("w:fldCharType"), "separate")
    prompt = OxmlElement("w:t")
    prompt.text = "Contents will appear here when the document is opened in Microsoft Word."
    end = OxmlElement("w:fldChar")
    end.set(qn("w:fldCharType"), "end")
    r = run._r
    r.append(begin)
    r.append(instr)
    r.append(separate)
    r.append(prompt)
    r.append(end)


def new_section(doc, landscape=False, start_page=None):
    section = doc.add_section(WD_SECTION.NEW_PAGE)
    section.page_width = Mm(297 if landscape else 210)
    section.page_height = Mm(210 if landscape else 297)
    section.orientation = WD_ORIENT.LANDSCAPE if landscape else WD_ORIENT.PORTRAIT
    if landscape:
        section.left_margin = Cm(1.35)
        section.right_margin = Cm(1.35)
        section.top_margin = Cm(1.45)
        section.bottom_margin = Cm(1.25)
        width = 26.9
    else:
        section.left_margin = Cm(1.7)
        section.right_margin = Cm(1.7)
        section.top_margin = Cm(1.7)
        section.bottom_margin = Cm(1.55)
        width = CONTENT_CM
    section.header_distance = Cm(0.55)
    section.footer_distance = Cm(0.45)
    header_footer(section, width, show_number=True)
    if start_page is not None:
        pg = OxmlElement("w:pgNumType")
        pg.set(qn("w:start"), str(start_page))
        section._sectPr.append(pg)
    return section


def fix_page_numbering(doc):
    """Use one continuous page count, including the cover, across every section."""
    for section in doc.sections:
        sect_pr = section._sectPr
        for child in list(sect_pr):
            if child.tag == qn("w:pgNumType"):
                sect_pr.remove(child)


def configure_styles(doc):
    normal = doc.styles["Normal"]
    style_font(normal, "Calibri", 12, False, INK, 0, 8, 1.15, WD_ALIGN_PARAGRAPH.LEFT)
    for style_name, name, size, before, after in (
        ("Heading 1", "Cambria", 18, 0, 8),
        ("Heading 2", "Cambria", 14, 14, 4),
        ("Heading 3", "Calibri", 12, 10, 2),
    ):
        style = doc.styles[style_name]
        style_font(style, name, size, True, NAVY if style_name != "Heading 3" else TEAL, before, after, 1.08)


def build():
    doc = Document()
    configure_styles(doc)
    core = doc.core_properties
    core.title = "ISJ107V Assignment 2 — IntelliClass Formal System Proposal and Specification"
    core.subject = "Formal System Proposal and Specification"
    core.category = "ISJ107V Assignment 2"
    core.comments = "IntelliClass — AI-Assisted Academic Management Platform"

    cover = doc.sections[0]
    cover.page_width = Mm(210)
    cover.page_height = Mm(297)
    cover.left_margin = Mm(0)
    cover.right_margin = Mm(0)
    cover.top_margin = Mm(0)
    cover.bottom_margin = Mm(0)
    cover.header_distance = Mm(0)
    cover.footer_distance = Mm(0)
    cover.header.is_linked_to_previous = False
    cover.footer.is_linked_to_previous = False
    cover.header.paragraphs[0].text = ""
    cover.footer.paragraphs[0].text = ""

    pic = doc.add_paragraph()
    pic.alignment = WD_ALIGN_PARAGRAPH.CENTER
    pic.paragraph_format.space_before = Pt(0)
    pic.paragraph_format.space_after = Pt(0)
    pic.paragraph_format.line_spacing = 1.0
    pic.add_run().add_picture(str(FIG / "00-cover.png"), height=Mm(294))

    new_section(doc, landscape=False, start_page=1)

    contents = doc.add_paragraph()
    contents.paragraph_format.page_break_before = False
    contents.paragraph_format.space_after = Pt(4)
    contents.paragraph_format.keep_with_next = True
    set_run_font(contents.add_run("Contents"), "Cambria", 18, bold=True, color=NAVY)
    toc_p = doc.add_paragraph()
    toc_p.paragraph_format.space_before = Pt(8)
    add_toc(toc_p)
    body(
        doc,
        "This document is the formal system proposal and specification for IntelliClass. "
        "It defines the problem the system addresses, the functional and non-functional requirements, "
        "the technical environment, the UML models, and the plan for implementation and evaluation. "
        "Artificial intelligence is treated as an assistive technology. Teachers remain responsible for "
        "reviewing and approving AI-generated assessment content before it is published.",
    )

    question_1(doc)
    question_2(doc)
    question_3(doc)
    question_4(doc)
    question_5(doc)

    settings = doc.settings.element
    update = OxmlElement("w:updateFields")
    update.set(qn("w:val"), "true")
    settings.append(update)
    fix_page_numbering(doc)

    doc.save(OUT)
    print(f"wrote {OUT}")


def question_1(doc):
    h1(doc, "Question 1  —  Project introduction", "8 marks")
    body(
        doc,
        "This section introduces IntelliClass, states the problem it is intended to address, "
        "and sets out the aim, objectives, scope and success criteria of the project.",
    )

    h2(doc, "1.1  Project title and system description")
    h3(doc, "Project title")
    rich(doc, [("IntelliClass — AI-Assisted Academic Management Platform", True, False)])

    h3(doc, "System description")
    body(
        doc,
        "IntelliClass is a web-based academic management platform designed to improve learner accountability, "
        "reduce teacher workload, and improve communication between teachers, learners and parents in South African schools.",
    )
    body(
        doc,
        "The system provides different functionality based on the user's role. Teachers can manage classes, "
        "upload study materials, create homework and quizzes, monitor learner performance, and use AI-assisted "
        "tools to support assessment and academic analysis. Learners can access their academic activities, "
        "complete homework and quizzes, view results, and receive explanations for incorrect answers. "
        "Parents can monitor their child's academic progress and homework completion, while administrators "
        "manage users, classes, subjects and school information.",
    )
    body(
        doc,
        "The system will integrate artificial intelligence as its emerging technology. AI will be used for three main purposes:",
    )
    bullet(doc, "Generate draft quiz questions from teacher-uploaded study materials.", "AI quiz generation.  ")
    bullet(doc, "Analyse stored academic performance information and provide summaries of possible weak areas and recommended support.", "AI learner performance insights.  ")
    bullet(doc, "Explain incorrect quiz answers and suggest topics learners should review.", "AI answer explanations and study guidance.  ")
    body(
        doc,
        "AI will be used as an assistive technology. Teachers will remain responsible for reviewing and approving "
        "AI-generated assessment content before it is published. The system will not make automatic pass or fail decisions.",
    )
    h3(doc, "Intended users")
    body(doc, "The system will support four main user roles:")
    bullet(doc, "Manages users, classes, subjects and school information.", "Administrator.  ")
    bullet(doc, "Manages academic activities, study materials, homework, quizzes and performance monitoring.", "Teacher.  ")
    bullet(doc, "Completes homework and quizzes, views results, and requests study guidance.", "Learner.  ")
    bullet(doc, "Monitors a child's progress, homework completion and assessment results.", "Parent.  ")

    h2(doc, "1.2  Problem statement")
    body(
        doc,
        "Many schools experience difficulties in monitoring learner homework completion, tracking academic performance, "
        "and maintaining effective communication between teachers and parents. Teachers may also spend a significant "
        "amount of time manually preparing quizzes and assessments from study materials.",
    )
    body(
        doc,
        "Learners are affected by limited feedback and may not always understand which topics they are struggling with. "
        "Parents may only receive a clear view of their child's academic performance at specific reporting periods "
        "rather than through continuous academic information.",
    )
    body(
        doc,
        "If these problems remain unresolved, learners may continue to miss academic activities, teachers may experience "
        "unnecessary administrative workload, and parents may have limited opportunities to provide timely support. "
        "Schools may also lack a centralized system for monitoring academic activities and identifying performance trends.",
    )
    body(
        doc,
        "IntelliClass aims to address these problems by providing a centralized platform for homework management, "
        "assessment, performance analytics and AI-assisted academic support.",
    )

    h2(doc, "1.3  Aim, objectives, scope and success criteria")
    h3(doc, "Project aim")
    body(
        doc,
        "The aim of IntelliClass is to develop an integrated web-based academic management platform that improves "
        "learner accountability and reduces teacher workload through centralized academic management, performance "
        "analytics and AI-assisted academic support.",
    )
    h3(doc, "Project objectives")
    numbered(
        doc,
        1,
        "To implement an AI-assisted quiz generation feature that generates draft questions from teacher-uploaded "
        "study materials and allows teachers to review and approve them before publication.",
    )
    numbered(
        doc,
        2,
        "To implement academic performance analytics and AI-generated performance insights that identify learner "
        "performance trends and possible areas requiring additional support.",
    )
    numbered(
        doc,
        3,
        "To implement AI-assisted answer explanations that provide learners with explanations and study guidance "
        "when they answer quiz questions incorrectly.",
    )

    h3(doc, "In scope")
    for item in [
        "User authentication and role-based access",
        "Administrator, teacher, learner and parent functionality",
        "School, class and subject management",
        "Study material upload and PDF text extraction",
        "Homework creation and submission tracking",
        "Quiz creation, participation and automatic scoring",
        "Performance analytics",
        "AI quiz generation, performance insights and answer explanations",
        "Teacher review and approval of AI-generated quizzes",
        "Email notifications",
        "PostgreSQL database and web-based deployment",
    ]:
        bullet(doc, item)
    h3(doc, "Out of scope")
    for item in [
        "Native Android or iOS application",
        "Full curriculum automation",
        "Real-time adaptive AI tutoring",
        "Automatic pass or fail decisions by AI",
        "Integration with external school management systems",
        "Training a custom AI model",
    ]:
        bullet(doc, item)

    h3(doc, "Success criteria")
    numbered(doc, 1, "All major system modules operate without critical errors and meet their defined functional requirements.")
    numbered(
        doc,
        2,
        "AI features successfully generate quiz content, performance insights and answer explanations, while allowing "
        "teachers to maintain control over AI-generated assessment content.",
    )


def question_2(doc):
    h1(doc, "Question 2  —  System requirements", "15 marks")
    body(
        doc,
        "The requirements below are uniquely identified, prioritised and written so that each one can be tested. "
        "Functional requirements use FR identifiers, non-functional requirements use NFR identifiers, and the "
        "emerging-technology requirements use AI identifiers. Acceptance criteria are written in a form that a tester "
        "can observe.",
    )

    h2(doc, "2.1  Functional requirements")
    body(
        doc,
        "The ten requirements in Table 1 cover the core functionality of IntelliClass. The AI components are "
        "identified separately as FR-06, FR-07, FR-09 and FR-10 so that the emerging technology can be traced "
        "from the requirements into the design and the test plan.",
    )
    table_caption(doc, "Table 1  Functional requirements")
    add_table(
        doc,
        ["ID", "Priority", "Functional requirement", "Acceptance criterion"],
        [
            ["FR-01", "Must", "The system shall allow users to authenticate using their registered credentials and access functionality according to their assigned role.", "Given a registered user, when valid credentials are entered, then the system shall authenticate the user and display the appropriate dashboard."],
            ["FR-02", "Must", "The system shall allow administrators to manage users, classes, subjects and school information.", "Given an authenticated administrator, when user or school information is created, updated or deleted, then the system shall save the changes and display the updated information."],
            ["FR-03", "Must", "The system shall allow teachers to upload PDF study materials and extract their text for use within the platform.", "Given an authenticated teacher, when a valid PDF is uploaded, then the system shall store the material and successfully extract its readable text."],
            ["FR-04", "Must", "The system shall allow teachers to create and assign homework to learners or classes with specified deadlines.", "Given an authenticated teacher, when homework details and a deadline are submitted, then the system shall create the assignment and make it available to the selected learners."],
            ["FR-05", "Must", "The system shall allow learners to access and submit assigned homework and track their submission status.", "Given an assigned homework activity, when a learner submits it, then the system shall record the submission and update its status."],
            ["FR-06", "Must", "The system shall allow teachers to generate draft quizzes from uploaded study materials using AI.", "Given processed study material, when the teacher requests quiz generation, then the system shall return a draft quiz containing generated questions based on the supplied material."],
            ["FR-07", "Must", "The system shall allow teachers to review, edit, approve or reject AI-generated quiz questions before publication.", "Given an AI-generated quiz, when the teacher reviews it, then the teacher shall be able to edit, approve or reject the generated questions before learners can access the quiz."],
            ["FR-08", "Must", "The system shall allow learners to complete published quizzes and automatically calculate and store their results.", "Given a published quiz, when a learner submits their answers, then the system shall calculate the score and store the result."],
            ["FR-09", "Should", "The system shall generate AI-assisted learner performance insights using stored academic performance data.", "Given sufficient learner performance data, when an authorised user requests performance insights, then the system shall generate a summary of performance trends and possible areas requiring support."],
            ["FR-10", "Should", "The system shall provide AI-assisted explanations for incorrect quiz answers and suggest relevant study guidance to learners.", "Given an incorrectly answered quiz question, when the learner requests an explanation, then the system shall provide an explanation and suggest an area or topic to review."],
        ],
        [1.5, 1.8, 7.15, 7.15],
    )

    h2(doc, "2.2  Non-functional requirements")
    body(
        doc,
        "Table 2 states four measurable non-functional requirements. The categories follow FURPS+: performance, "
        "usability, reliability and security. Each requirement has a numeric or directly observable acceptance criterion.",
    )
    table_caption(doc, "Table 2  Non-functional requirements")
    add_table(
        doc,
        ["ID", "Category", "Requirement", "Acceptance criterion"],
        [
            ["NFR-01", "Performance", "The system shall return standard dashboard and database requests within 3 seconds under normal operating conditions.", "At least 95% of tested standard requests shall complete within 3 seconds."],
            ["NFR-02", "Usability", "The system shall allow a new user to complete the login process and access their role-specific dashboard without assistance.", "At least 4 out of 5 test users shall successfully log in and reach their dashboard without assistance."],
            ["NFR-03", "Reliability", "The system shall maintain submitted quiz results and homework records without loss during normal operation.", "100% of successfully submitted test records shall be retrievable from the database after submission."],
            ["NFR-04", "Security", "The system shall protect authenticated functionality using password hashing, JWT authentication and role-based access control.", "Unauthenticated users shall be denied protected endpoints, and users shall not be able to access functionality outside their assigned role."],
        ],
        [1.6, 2.5, 6.75, 6.75],
    )

    h2(doc, "2.3  Emerging technology requirements")
    body(
        doc,
        "The emerging technology selected for IntelliClass is artificial intelligence, using a pre-trained model "
        "accessed through an external AI service. The metrics in Table 3 evaluate the usefulness of the AI output "
        "for this project. They do not claim that the model itself has a universal accuracy percentage.",
    )
    table_caption(doc, "Table 3  Emerging technology requirements")
    add_table(
        doc,
        ["ID", "Requirement", "Acceptance criterion"],
        [
            ["AI-01", "The AI quiz generation component shall generate quiz questions based on the teacher-provided study material.", "In a test using five approved study documents, at least 80% of generated questions shall be judged by the teacher to be relevant to the uploaded material."],
            ["AI-02", "The AI performance insight component shall generate performance summaries from structured learner performance data.", "For at least 80% of test cases, the generated insight shall correctly identify the main weak topic or performance trend identified by the underlying statistical data."],
            ["AI-03", "The AI answer explanation component shall provide an explanation for an incorrect answer using the relevant question and study material.", "At least 80% of test explanations shall be rated by the evaluator as relevant, understandable and consistent with the supplied study material."],
        ],
        [1.6, 8.0, 8.0],
    )
    body(
        doc,
        "These thresholds are deliberately realistic for a student project. A teacher or evaluator reviews a defined "
        "test set and records whether each output is relevant and consistent with the supplied material. The same "
        "thresholds are reused in the evaluation plan in Section 5.3.",
    )


def question_3(doc):
    h1(doc, "Question 3  —  Technical environment", "10 marks")
    body(
        doc,
        "This section specifies the technology stack, the hardware required to use and develop the system, "
        "and the proposed three-layer architecture and deployment approach.",
    )

    h2(doc, "3.1  Proposed technology stack")
    table_caption(doc, "Table 4  Technology stack")
    add_table(
        doc,
        ["Component", "Technology", "Purpose"],
        [
            ["User interface", "React + Vite", "Development of responsive role-based web interfaces"],
            ["Styling", "Tailwind CSS", "Interface styling and responsive layouts"],
            ["Application layer", "Node.js + Express.js", "Backend APIs, business logic and authentication"],
            ["Database", "PostgreSQL", "Storage of users, classes, subjects, quizzes, homework and performance data"],
            ["Authentication", "JWT + bcrypt", "Secure authentication and password protection"],
            ["File upload", "Multer", "Handling uploaded study materials"],
            ["PDF processing", "PDF text extraction library", "Extracting text from uploaded PDF materials"],
            ["AI service", "Hugging Face Inference API", "Access to a pre-trained AI model"],
            ["HTTP communication", "Axios", "Communication between frontend and backend"],
            ["Analytics", "Chart.js", "Visualising academic performance"],
            ["Email", "Nodemailer / email service", "Automated email notifications"],
            ["API testing", "Postman", "Testing backend endpoints"],
            ["Version control", "Git + GitHub", "Source-code management"],
            ["Development environment", "Visual Studio Code", "Application development"],
            ["Deployment", "Cloud web hosting", "Hosting the frontend and backend"],
        ],
        [4.2, 5.0, 8.4],
    )
    h3(doc, "Justification")
    body(
        doc,
        "React is suitable for creating reusable role-based interfaces, while Node.js and Express provide a lightweight "
        "environment for developing REST APIs. PostgreSQL is appropriate because IntelliClass contains related entities "
        "such as users, classes, subjects, quizzes, questions, homework and results.",
    )
    body(
        doc,
        "AI will be integrated through an external service using a pre-trained model. This avoids the need to develop "
        "and train a custom AI model, which would be beyond the scope and resources of the project. The API key is "
        "stored on the server and is not exposed to the browser.",
    )

    h2(doc, "3.2  Hardware requirements")
    body(
        doc,
        "No specialised AI hardware is required, because the model is accessed through an external service rather than "
        "being trained or hosted on the school device. The figures below apply to a client device used to access the "
        "web application, and also serve as a practical minimum for development.",
    )
    table_caption(doc, "Table 5  Minimum hardware requirements")
    add_table(
        doc,
        ["Component", "Minimum requirement"],
        [
            ["Processor", "Intel Core i3 / AMD Ryzen 3 or equivalent"],
            ["Memory", "8 GB RAM"],
            ["Storage", "256 GB available storage"],
            ["Internet", "Stable broadband connection"],
            ["Client device", "Desktop computer, laptop, or modern smartphone or tablet"],
            ["Browser", "Modern browser such as Chrome, Edge or Firefox"],
            ["Specialised hardware", "None"],
        ],
        [4.6, 13.0],
    )
    table_caption(doc, "Table 6  Recommended hardware requirements")
    add_table(
        doc,
        ["Component", "Recommended requirement"],
        [
            ["Processor", "Intel Core i5 / AMD Ryzen 5 or better"],
            ["Memory", "16 GB RAM"],
            ["Storage", "512 GB SSD"],
            ["Internet", "Stable broadband connection"],
            ["Client device", "Laptop or desktop computer"],
            ["Browser", "Latest version of Chrome, Edge or Firefox"],
            ["Specialised hardware", "None"],
        ],
        [4.6, 13.0],
    )

    h2(doc, "3.3  Architecture and deployment approach")
    body(
        doc,
        "IntelliClass will use a three-layer web architecture consisting of the presentation layer, the application "
        "layer and the data layer. The external AI service sits beside the database: the application calls it when "
        "an authorised user requests an AI function, then validates the response before anything is stored or shown.",
    )
    figure(
        doc,
        FIG / "01-architecture.png",
        6.5,
        "Figure 1  Logical three-layer architecture of IntelliClass",
    )
    h3(doc, "Communication")
    body(doc, "The React frontend communicates with the Node.js backend through REST API endpoints over HTTPS.")
    body(doc, "The backend communicates with PostgreSQL for persistent data storage.")
    body(
        doc,
        "When an AI function is requested, the backend sends the required study material or structured academic "
        "information to the AI service. The resulting response is validated and returned to the application. "
        "The AI API key is stored securely on the backend and is not exposed to users through the frontend.",
    )
    h3(doc, "Scalability")
    body(
        doc,
        "The system will use modular backend services so that features such as AI, notifications and analytics can "
        "be developed or scaled independently. Database indexing and efficient queries will be used as the amount "
        "of academic data increases.",
    )
    h3(doc, "Security")
    body(doc, "Security will be addressed through:")
    for item in [
        "Password hashing using bcrypt",
        "JWT authentication",
        "Role-based access control",
        "Protected API endpoints",
        "Input validation",
        "Environment variables for sensitive credentials",
        "HTTPS during deployment",
        "Restricting AI requests to authorised users",
    ]:
        bullet(doc, item)
    h3(doc, "Backup and recovery")
    body(
        doc,
        "The PostgreSQL database will be backed up regularly. Database backups can be stored separately from the "
        "main deployment environment so that information can be restored if the primary database becomes unavailable "
        "or data is accidentally lost.",
    )
    body(
        doc,
        "Figure 2 shows the same system from a deployment point of view. Users reach a hosted web application. "
        "PostgreSQL, the Hugging Face AI service and the email service are separate dependencies of the API.",
    )
    figure(
        doc,
        FIG / "02-deployment.png",
        6.5,
        "Figure 2  Deployment view of IntelliClass",
    )


def question_4(doc):
    h1(doc, "Question 4  —  UML models", "13 marks")
    body(
        doc,
        "Four UML models describe IntelliClass: a use-case diagram, an activity diagram, a class diagram and a "
        "sequence diagram. The same actors, classes and AI service are used throughout, and each model traces back "
        "to the requirements in Section 2. The class model is drawn in two diagrams so that the attributes and "
        "operations remain readable; together they are one domain model.",
    )

    h2(doc, "4.1  Use-case diagram")
    body(
        doc,
        "The system boundary is IntelliClass. The primary actors are the Administrator, Teacher, Learner and Parent. "
        "The AI Service and the Email Service are supporting actors. Login is one use case, associated with every "
        "human role. Teal use cases are the artificial-intelligence behaviour. A dashed arrow marked by the legend "
        "is an «include» relationship. The gold dashed arrow is an «enable» dependency: a learner can take a quiz "
        "only after a teacher has approved it.",
    )
    new_section(doc, landscape=True)
    figure(
        doc,
        FIG / "03-usecase.png",
        10.15,
        "Figure 3  Use-case diagram for IntelliClass",
    )
    new_section(doc, landscape=False)
    body(doc, "Table 7 lists the use cases by actor. Table 8 records the relationships drawn on the diagram.")
    table_caption(doc, "Table 7  Use cases by actor")
    add_table(
        doc,
        ["Actor", "Use cases"],
        [
            ["Administrator", "Login; Manage Users; Manage Classes; Manage Subjects; Manage School Information"],
            ["Teacher", "Login; Upload Study Material; Create Homework; Manage Quizzes; Generate AI Quiz; Review AI Quiz; Approve Quiz; View Performance Analytics; Request AI Performance Insights"],
            ["Learner", "Login; View Homework; Submit Homework; Take Quiz; Calculate Score; View Results; View Performance; Request AI Answer Explanation"],
            ["Parent", "Login; View Learner Progress; View Homework Completion; View Assessment Results; View Performance Insights"],
            ["AI Service", "Generate Quiz; Generate Performance Insights; Generate Answer Explanation"],
            ["Email Service", "Send Notification"],
        ],
        [3.4, 14.2],
    )
    table_caption(doc, "Table 8  Use-case relationships")
    add_table(
        doc,
        ["From", "Relationship", "To"],
        [
            ["Generate AI Quiz", "«include»", "Upload Study Material"],
            ["Generate AI Quiz", "«include»", "Review AI Quiz"],
            ["Generate AI Quiz", "«include»", "Generate Quiz"],
            ["Take Quiz", "«include»", "Calculate Score"],
            ["Request AI Answer Explanation", "«include»", "Generate Answer Explanation"],
            ["Request AI Performance Insights", "«include»", "Generate Performance Insights"],
            ["Approve Quiz", "«enable»", "Take Quiz"],
        ],
        [6.3, 3.2, 8.1],
    )
    body(
        doc,
        "These relationships keep the emerging technology visible. A teacher cannot generate a quiz without processed "
        "study material, and learners cannot attempt a quiz until it has been approved. The AI service performs the "
        "generation and explanation steps; it does not publish the quiz.",
    )

    h2(doc, "4.2  Activity diagram")
    body(
        doc,
        "The activity diagram follows the main end-to-end workflow: AI-assisted quiz generation and learner assessment. "
        "It includes decisions, an alternative path for an invalid file, a review loop when the draft is not acceptable, "
        "and a branch for an incorrect answer. The two teal activities, Generate quiz and Generate explanation, are the "
        "emerging-technology steps. A rejected or edited quiz returns to review and is not published.",
    )
    figure(
        doc,
        FIG / "04-activity.png",
        6.35,
        "Figure 4  Activity diagram for AI-assisted quiz generation and learner assessment",
    )
    body(
        doc,
        "The Yes path from “Quiz acceptable?” continues through approval, publication, the learner attempt, scoring "
        "and storage. If an answer is incorrect, the learner may request an explanation. The AI service generates that "
        "explanation from the question and the relevant study material, and the system then displays the result. "
        "If the answer is correct, the flow goes directly to the displayed result.",
    )

    h2(doc, "4.3  Class diagram")
    body(
        doc,
        "The domain classes are User, Administrator, Teacher, Learner, Parent, School, Class, Subject, StudyMaterial, "
        "Homework, Submission, Quiz, Question, QuizResult, AIService and Notification. Administrator, Teacher, Learner "
        "and Parent specialise User. Attributes are private and operations are public. AIService is stereotyped "
        "«external» because it is a pre-trained service, not a class whose behaviour is implemented inside IntelliClass.",
    )
    body(
        doc,
        "Figure 5 shows the user hierarchy and the school structure. Figure 6 shows study materials, homework, "
        "assessment and the AI service. Teacher and Learner appear on both diagrams so that the associations remain "
        "traceable. Their generalisation from User is defined in Figure 5.",
    )
    new_section(doc, landscape=True)
    figure(
        doc,
        FIG / "05-class-users.png",
        10.15,
        "Figure 5  Class diagram — users and school structure",
    )
    figure(
        doc,
        FIG / "06-class-academic.png",
        10.15,
        "Figure 6  Class diagram — academic activities and the AI service",
    )
    new_section(doc, landscape=False)
    table_caption(doc, "Table 9  Class associations and multiplicities")
    add_table(
        doc,
        ["From", "Multiplicity", "To", "Meaning"],
        [
            ["School", "1 to 1..*", "Class", "A school owns one or more classes"],
            ["School", "1 to 1..*", "User", "A school registers one or more users"],
            ["Class", "1 to 1..*", "Teacher", "A class is assigned one or more teachers"],
            ["Class", "1 to 1..*", "Learner", "A class contains one or more learners"],
            ["Parent", "1 to 1..*", "Learner", "A parent monitors one or more learners"],
            ["Subject", "1 to 1..*", "StudyMaterial", "A subject has one or more study materials"],
            ["Teacher", "1 to 1..*", "StudyMaterial", "A teacher uploads one or more materials"],
            ["Teacher", "1 to 1..*", "Homework", "A teacher creates one or more homework items"],
            ["Homework", "1 to 1..*", "Submission", "Homework receives one or more submissions"],
            ["Teacher", "1 to 1..*", "Quiz", "A teacher creates one or more quizzes"],
            ["Quiz", "1 to 1..*", "Question", "A quiz contains one or more questions"],
            ["Quiz", "1 to 1..*", "QuizResult", "A quiz produces one or more results"],
            ["Learner", "1 to 1..*", "QuizResult", "A learner has one or more quiz results"],
            ["StudyMaterial", "uses", "AIService", "Quiz generation is grounded in the material"],
            ["Quiz", "uses", "AIService", "A draft quiz is produced by the AI service"],
            ["QuizResult", "uses", "AIService", "Insights and explanations use stored results"],
        ],
        [3.3, 2.6, 3.3, 8.4],
    )
    body(
        doc,
        "Notification stores the message, type, sent date and status of an email or in-platform notice, and exposes "
        "send(). It is created by the application when homework is assigned or a quiz is published. Password values "
        "are stored as hashes, as required by NFR-04, even though the domain attribute is named password.",
    )

    h2(doc, "4.4  Sequence diagram")
    body(
        doc,
        "The sequence diagram realises the AI quiz generation use case. It shows the time-ordered interaction among "
        "the teacher, the React user interface, the Node.js and Express API, PostgreSQL, and the AI service. "
        "Solid arrows are requests. Dashed arrows are replies. The teal messages are the call to the emerging-technology "
        "component and its response. The API validates the model output before the draft is saved.",
    )
    new_section(doc, landscape=True)
    figure(
        doc,
        FIG / "07-sequence.png",
        10.15,
        "Figure 7  Sequence diagram for AI quiz generation",
    )
    new_section(doc, landscape=False)
    body(
        doc,
        "The interaction has two phases. In the first, the teacher uploads a study document. The API validates the file, "
        "extracts the PDF text and stores the material. In the second, the teacher requests quiz generation. The API "
        "loads the extracted text, sends it to the AI service with a prompt, validates the returned questions, and "
        "saves them as a draft. The teacher then reviews, edits and approves the draft, and the API sets the quiz "
        "status to Approved. Until that update, the quiz is not available to learners, which satisfies FR-07.",
    )


def question_5(doc):
    h1(doc, "Question 5  —  Implementation and evaluation", "13 marks")
    body(
        doc,
        "This section specifies the database and API, how the AI service is integrated, a short interface contract "
        "for quiz generation, and the plan for testing and evaluation. It also records the main technical risk and "
        "the mitigation already built into the requirements.",
    )

    h2(doc, "5.1  Database and API")
    h3(doc, "Database")
    body(
        doc,
        "IntelliClass will use PostgreSQL as its relational database. The main entities are School, User, Class, "
        "Subject, StudyMaterial, Homework, Submission, Quiz, Question, QuizResult and Notification. The database "
        "stores user information, academic activities, uploaded material, extracted text, quizzes, learner submissions, "
        "results and performance information. These entities correspond to the classes in Figures 5 and 6.",
    )
    h3(doc, "Data inputs")
    body(doc, "Examples of data accepted by the system include:")
    for item in [
        "User registration information",
        "Login credentials",
        "PDF study materials",
        "Homework information",
        "Quiz questions and answers",
        "Learner submissions",
        "Academic results",
        "AI requests",
    ]:
        bullet(doc, item)
    h3(doc, "Data outputs")
    body(doc, "Examples of data returned by the system include:")
    for item in [
        "Dashboard information",
        "Quiz results",
        "Homework status",
        "Performance analytics",
        "AI-generated quiz questions",
        "AI performance insights",
        "AI answer explanations",
    ]:
        bullet(doc, item)
    h3(doc, "Validation")
    body(doc, "The system will validate:")
    for item in [
        "Required fields",
        "Email format",
        "Password requirements",
        "User roles",
        "File type and file size",
        "Quiz data",
        "Learner submissions",
        "API request permissions",
    ]:
        bullet(doc, item)
    h3(doc, "Privacy")
    body(doc, "The system will:")
    for item in [
        "Protect passwords using hashing",
        "Restrict information according to user roles",
        "Use authenticated API endpoints",
        "Avoid exposing unnecessary learner information to the AI service",
        "Store AI credentials securely on the backend",
        "Allow only authorised users to access learner academic information",
    ]:
        bullet(doc, item)

    h3(doc, "API structure")
    body(
        doc,
        "The application communicates through REST APIs. Table 10 groups the endpoints by resource. All endpoints "
        "except registration and login require a valid JWT, and each endpoint checks the caller's role before it "
        "reads or changes data.",
    )
    table_caption(doc, "Table 10  REST API endpoints")
    add_table(
        doc,
        ["Method", "Endpoint", "Purpose"],
        [
            ["POST", "/api/auth/register", "Register a user"],
            ["POST", "/api/auth/login", "Authenticate the user and issue a token"],
            ["GET", "/api/users/profile", "Retrieve the signed-in profile"],
            ["PUT", "/api/users/profile", "Update the signed-in profile"],
            ["POST", "/api/materials/upload", "Upload a PDF and extract its text"],
            ["GET", "/api/materials", "List study materials"],
            ["GET", "/api/materials/:id", "Retrieve one study material"],
            ["DELETE", "/api/materials/:id", "Remove a study material"],
            ["POST", "/api/homework/create", "Create and assign homework"],
            ["GET", "/api/homework", "List homework"],
            ["POST", "/api/homework/submit", "Submit homework"],
            ["POST", "/api/quizzes/create", "Create a quiz"],
            ["GET", "/api/quizzes", "List quizzes"],
            ["GET", "/api/quizzes/:id", "Retrieve a quiz"],
            ["POST", "/api/quizzes/:id/submit", "Submit answers and store the score"],
            ["POST", "/api/ai/generate-quiz", "Generate a draft quiz from study material"],
            ["POST", "/api/ai/performance-insights", "Generate a performance summary"],
            ["POST", "/api/ai/explain-answer", "Explain an incorrect answer"],
            ["GET", "/api/analytics/class-performance", "Summarise class performance"],
            ["GET", "/api/analytics/learner-performance", "Summarise learner performance"],
            ["GET", "/api/analytics/homework-completion", "Summarise homework completion"],
        ],
        [2.2, 7.2, 8.2],
    )

    h2(doc, "5.2  Emerging technology integration")
    body(
        doc,
        "The AI component is integrated into the backend rather than called directly from the React frontend. "
        "That keeps the API key on the server, lets the API enforce roles, and gives the application a chance to "
        "validate the model output before it is stored. Figure 8 shows the path used by all three AI features.",
    )
    figure(
        doc,
        FIG / "08-ai-flow.png",
        6.5,
        "Figure 8  Path of an AI request through IntelliClass",
    )
    h3(doc, "AI quiz generation")
    body(
        doc,
        "The teacher uploads study material. The backend extracts the text and prepares it for the AI service. "
        "The model receives the relevant material together with instructions to generate structured quiz questions. "
        "The generated questions are returned to the backend, validated, stored as a draft, and displayed to the "
        "teacher for review. The teacher must approve the quiz before it can be published.",
    )
    h3(doc, "AI performance insights")
    body(
        doc,
        "The backend first calculates objective statistics such as average score, completion rate and topic performance. "
        "These statistics are then supplied to the AI service, which generates a human-readable performance summary. "
        "The insight is therefore grounded in stored results rather than in an open-ended prompt.",
    )
    h3(doc, "AI answer explanations")
    body(
        doc,
        "When a learner requests an explanation, the backend provides the question, the learner's answer, the correct "
        "answer and the relevant study material to the AI service. The generated explanation is returned to the learner "
        "together with a suggested topic to review.",
    )
    h3(doc, "Interface contract")
    body(
        doc,
        "The following contract describes quiz generation. The same pattern of authorisation, retrieval, prompt "
        "construction, validation and persistence applies to performance insights and answer explanations.",
    )
    code_block(
        doc,
        """
FUNCTION generateQuiz(materialId, teacherId):

    IF teacher is not authorised:
        RETURN access denied

    material = getStudyMaterial(materialId)

    IF material does not exist:
        RETURN material not found

    text = extractRelevantText(material)

    prompt = createQuizPrompt(text)

    aiResponse = callAIService(prompt)

    IF aiResponse is invalid:
        RETURN generation error

    quiz = createQuizDraft(aiResponse, teacherId)

    saveQuiz(quiz)

    RETURN quiz
""",
    )
    body(doc, "The teacher must subsequently review and approve the generated quiz before it can be published.")

    h2(doc, "5.3  Testing and evaluation plan")
    h3(doc, "Functional testing")
    body(
        doc,
        "Functional testing will verify that the system performs its required functions correctly. The tests trace "
        "to FR-01 through FR-10 and cover:",
    )
    for item in [
        "User registration and login",
        "Role-based access",
        "Study material upload",
        "PDF text extraction",
        "Homework creation and homework submission",
        "Quiz generation and teacher quiz approval",
        "Quiz completion and automatic scoring",
        "Performance analytics",
        "AI explanations",
        "Email notifications",
    ]:
        bullet(doc, item)
    body(
        doc,
        "API endpoints will be tested with Postman. Frontend functionality will be tested through the browser, "
        "using one account for each role. A test passes when the observable result matches the acceptance criterion "
        "of the related requirement.",
    )

    h3(doc, "Emerging technology metric")
    body(
        doc,
        "The main AI evaluation metric is the relevance and correctness of the AI output, using the thresholds "
        "already defined as AI-01, AI-02 and AI-03.",
    )
    bullet(doc, "At least 80% of generated questions should be judged relevant to the teacher-provided study material.", "Quiz questions.  ")
    bullet(doc, "At least 80% of tested explanations should be rated relevant, understandable and consistent with the supplied learning material.", "Answer explanations.  ")
    bullet(doc, "For at least 80% of cases, the narrative should identify the same weak topic or trend as the calculated statistics.", "Performance insights.  ")
    body(
        doc,
        "The evaluation will use a predefined test set of approved study documents and stored results. A teacher "
        "or independent evaluator will score each output against a short checklist: relevant to the source, "
        "understandable to the intended user, and consistent with the supplied material. The percentage of accepted "
        "outputs is the reported result. The test does not treat the model as generally accurate beyond this set.",
    )

    h3(doc, "User acceptance testing")
    body(
        doc,
        "User acceptance testing will involve representative users: teachers, learners and parents. They will perform "
        "common tasks:",
    )
    for item in [
        "Logging in",
        "Uploading study material",
        "Creating homework",
        "Generating a quiz",
        "Reviewing an AI-generated quiz",
        "Completing a quiz",
        "Viewing performance",
        "Requesting an AI explanation",
    ]:
        bullet(doc, item)
    body(doc, "Users will provide feedback on:")
    for item in [
        "Ease of use",
        "Clarity",
        "Navigation",
        "Usefulness of the AI features",
        "Overall system experience",
    ]:
        bullet(doc, item)
    body(
        doc,
        "The system will be considered acceptable if the majority of participants can complete the main tasks "
        "successfully without assistance. This check also supports NFR-02, which requires at least four out of five "
        "new users to reach their dashboard without help. Feedback that does not block acceptance will be recorded "
        "as improvements for a later release.",
    )

    h3(doc, "Major technical risk and mitigation")
    rich(doc, [("Risk: incorrect or irrelevant AI output.  ", True, False), (
        "AI-generated questions or explanations may occasionally contain inaccurate, irrelevant or misleading information. "
        "If that content were published without review, it could mislead learners.",
        False,
        False,
    )])
    body(doc, "The mitigation is built into the design rather than added after the model responds:")
    bullet(doc, "Teacher-provided study material is the primary context for quiz generation.", "Ground the prompt.  ")
    bullet(doc, "A teacher must review an AI-generated quiz before it is published (FR-07).", "Keep a human decision.  ")
    bullet(doc, "The API checks the structure of an AI response before storing it.", "Validate before saving.  ")
    bullet(doc, "The model is limited to the supplied academic context where possible.", "Constrain the context.  ")
    bullet(doc, "Teachers can edit or reject individual generated questions.", "Allow correction.  ")
    bullet(doc, "Output is evaluated against the relevance and correctness metrics in Table 3.", "Measure the result.  ")
    body(
        doc,
        "Together, these controls reduce the risk that AI-generated content will negatively affect learners. "
        "The model assists the teacher. It does not replace the teacher's judgement, and it does not decide whether "
        "a learner has passed.",
    )


if __name__ == "__main__":
    build()
