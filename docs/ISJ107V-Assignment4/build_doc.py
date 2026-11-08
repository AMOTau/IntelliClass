"""ISJ107V Assignment 4 report: IntelliClass functional prototype."""

from pathlib import Path

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_LINE_SPACING
from docx.oxml import parse_xml
from docx.oxml.ns import qn
from docx.shared import Cm, Inches, Pt, RGBColor

from diagrams import activity, class_diagram, deployment, sequence, usecase

ROOT = Path(__file__).resolve().parent
FIG = ROOT / "figures"
OUT = ROOT / "ISJ107V_Assignment4_StudentNumber.docx"

NAVY = RGBColor(0x1A, 0x5C, 0x4A)
TEAL = RGBColor(0x0F, 0x8A, 0x7A)
TEXT = RGBColor(0x1F, 0x3A, 0x34)
MUTED = RGBColor(0x5C, 0x6E, 0x6A)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)


def shade(cell, hex_color):
    cell._tc.get_or_add_tcPr().append(
        parse_xml(
            f'<w:shd xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" w:val="clear" w:color="auto" w:fill="{hex_color}"/>'
        )
    )


def set_run(run, text, size=12, bold=False, color=TEXT, font="Calibri"):
    run.text = text
    run.bold = bold
    run.font.name = font
    run.font.size = Pt(size)
    run.font.color.rgb = color
    run._element.rPr.rFonts.set(qn("w:eastAsia"), font)


def para(doc, text, size=12, bold=False, color=TEXT, space_before=0, space_after=6, align="left"):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(space_before)
    p.paragraph_format.space_after = Pt(space_after)
    p.paragraph_format.line_spacing = 1.08
    p.alignment = {"left": WD_ALIGN_PARAGRAPH.LEFT, "justify": WD_ALIGN_PARAGRAPH.JUSTIFY, "center": WD_ALIGN_PARAGRAPH.CENTER}[align]
    set_run(p.add_run(), text, size, bold, color)
    return p


def bullet(doc, text):
    p = doc.add_paragraph()
    p.paragraph_format.left_indent = Cm(0.75)
    p.paragraph_format.first_line_indent = Cm(-0.35)
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(2)
    p.paragraph_format.line_spacing = 1.05
    set_run(p.add_run(), "•  " + text, 12, False, TEXT)
    return p


def heading(doc, text, level=1):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(14 if level == 1 else 10)
    p.paragraph_format.space_after = Pt(4)
    p.paragraph_format.keep_with_next = True
    if level == 1 and text.startswith("Question 1"):
        p.paragraph_format.page_break_before = True
    set_run(p.add_run(), text, 16 if level == 1 else 13, True, NAVY, "Cambria")
    return p


def caption(doc, text):
    para(doc, text, 10, True, TEAL, space_before=8, space_after=4)


def figure(doc, name, width=6.4):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(4)
    p.paragraph_format.space_after = Pt(2)
    p.add_run().add_picture(str(FIG / name), width=Inches(width))


def add_table(doc, headers, rows, widths):
    table = doc.add_table(rows=1 + len(rows), cols=len(headers))
    table.autofit = False
    header_row = table.rows[0]._tr
    header_row.get_or_add_trPr().append(
        parse_xml('<w:tblHeader xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"/>')
    )
    for i, header in enumerate(headers):
        cell = table.rows[0].cells[i]
        cell.text = ""
        set_run(cell.paragraphs[0].add_run(), header, 10, True, WHITE)
        shade(cell, "1A5C4A")
        cell.width = Cm(widths[i])
    for r, row in enumerate(rows):
        for i, value in enumerate(row):
            cell = table.rows[r + 1].cells[i]
            cell.text = ""
            set_run(cell.paragraphs[0].add_run(), value, 9, False, TEXT)
            if r % 2:
                shade(cell, "E7F3EF")
            cell.width = Cm(widths[i])
    para(doc, "", size=6, space_after=2)
    return table


def build():
    usecase()
    activity()
    class_diagram()
    sequence()
    deployment()

    doc = Document()
    section = doc.sections[0]
    section.page_width = Cm(21.0)
    section.page_height = Cm(29.7)
    section.left_margin = Cm(1.7)
    section.right_margin = Cm(1.7)
    section.top_margin = Cm(1.6)
    section.bottom_margin = Cm(1.6)
    header = section.header.paragraphs[0]
    set_run(header.add_run(), "ISJ107V  ·  Assignment 4  ·  IntelliClass", 10, False, MUTED)
    footer = section.footer.paragraphs[0]
    footer.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    set_run(footer.add_run(), "Functional prototype", 10, False, MUTED)

    cover(doc)
    question_1(doc)
    question_2(doc)
    question_3(doc)
    question_4(doc)
    question_5(doc)
    references(doc)
    doc.save(OUT)
    print(OUT)


def cover(doc):
    para(doc, "ISJ107V", 14, True, TEAL, space_before=36, align="center")
    para(doc, "Assignment 4", 28, True, NAVY, space_before=6, align="center")
    para(doc, "Functional Prototype and Presentation", 16, False, TEXT, align="center")
    para(doc, "IntelliClass", 26, True, NAVY, space_before=28, align="center")
    para(doc, "AI-Assisted Academic Management Platform", 14, False, TEAL, align="center")
    para(doc, "Name", 12, True, MUTED, space_before=36, align="center")
    para(doc, "Alicia Tau", 12, False, TEXT, align="center")
    para(doc, "Student number", 12, True, MUTED, space_before=10, align="center")
    para(doc, "223230660", 12, False, TEXT, align="center")
    para(doc, "31 October 2026", 12, False, TEXT, space_before=16, align="center")
    para(doc, "Emerging technology: Artificial Intelligence, used only as an assistant.", 11, False, MUTED, space_before=28, align="center")


def question_1(doc):
    heading(doc, "Question 1 — Prototype readiness")
    para(doc, "This section defines what the prototype demonstrates and how an assessor can run it.", size=11, color=MUTED)

    heading(doc, "1.1 Title, problem, users, purpose and technology", 2)
    para(doc, "Project title. IntelliClass — AI-Assisted Academic Management Platform.", align="justify")
    para(doc, "Problem addressed. Schools struggle to see whether academic work is done, teachers spend a long time preparing assessments from study notes, and parents often hear about progress only at report time. There is no single place where the teacher, the learner and the parent can look at the same record.", align="justify")
    para(doc, "Intended users. The prototype supports four roles. An administrator manages users, classes and subjects. A teacher uploads study material, creates quizzes and reviews anything the AI drafts. A learner opens materials, completes a published quiz and can ask why an answer was wrong. A parent views quiz results and notes from the teacher.", align="justify")
    para(doc, "Prototype purpose. The prototype shows one complete path: a teacher turns an uploaded PDF into a reviewed quiz, a learner answers it, the score is stored, and a wrong answer can be explained from the same notes. The aim is to show learner accountability, less preparation time for the teacher, and a clearer view for the parent.", align="justify")
    para(doc, "Emerging technology. Artificial intelligence, through a pre-trained model on Hugging Face. The model is called only from the server. It drafts questions and explains a wrong answer. It does not decide who passes. If the service is unavailable, the server builds a simpler draft from the notes so the demonstration can continue.", align="justify")

    heading(doc, "1.2 Requirements and feature status", 2)
    para(doc, "The five requirements that the live demonstration is built around are FR-01 to FR-05. FR-06 and FR-07 are also available. FR-08 and FR-09 exist in the code but are not part of the demonstration screens.", align="justify")
    caption(doc, "Table 1  Functional requirements demonstrated by the prototype")
    add_table(
        doc,
        ["ID", "Requirement", "Status"],
        [
            ["FR-01", "A user signs in and opens only the dashboard for that role.", "Implemented"],
            ["FR-02", "An administrator manages users, classes and subjects.", "Implemented"],
            ["FR-03", "A teacher uploads a PDF and the system extracts its text.", "Implemented"],
            ["FR-04", "AI drafts a quiz from that text. The teacher reviews it before publish.", "Implemented"],
            ["FR-05", "A learner completes a published quiz and the score is stored.", "Implemented"],
            ["FR-06", "A wrong answer can be explained from the question and the notes.", "Implemented"],
            ["FR-07", "A parent can see results, and a teacher can write to a parent.", "Implemented"],
            ["FR-08", "Homework can be assigned, submitted and marked.", "Partial"],
            ["FR-09", "A term report can be prepared from stored results.", "Partial"],
            ["FR-10", "A phone app, scanned-PDF reading, or an AI pass mark.", "Deferred"],
        ],
        [2.2, 11.2, 3.2],
    )
    para(doc, "Partial means the database and server routes exist, but the demonstration screens hide homework and term reports so the assessed path stays on materials, quizzes and explanations. Deferred means those items are outside this prototype on purpose.", align="justify")

    heading(doc, "1.3 Setup and access", 2)
    para(doc, "Software. Node.js and npm, PostgreSQL, and a current browser (Chrome, Edge or Firefox). No special AI hardware is required.", align="justify")
    para(doc, "Hardware. A laptop with about 8 GB of memory, space for Node modules and PostgreSQL, and an internet connection when the live Hugging Face model is used.", align="justify")
    bullet(doc, "From the project folder, run npm install.")
    bullet(doc, "Copy server/.env.example to server/.env and client/.env.example to client/.env.")
    bullet(doc, "Set DATABASE_URL to the local PostgreSQL database. The server applies server/db/schema.sql on startup.")
    bullet(doc, "Set HUGGINGFACE_TOKEN for the live model. Without it, quiz generation uses the local fallback.")
    bullet(doc, "Start the API with npm run dev:server (http://localhost:4000).")
    bullet(doc, "Start the interface with npm run dev:client (http://localhost:5173).")
    para(doc, "Demonstration sign-in. The first time the server starts with an empty user table it creates an administrator: admin@int.com with password Admin@123. Accounts created later for a teacher, learner or parent receive the temporary password Password@1. These are local demonstration credentials only.", align="justify")
    para(doc, "Sample data. Create one class, one subject, one teacher, one learner in that class, and one parent linked to that learner. Upload a text-based PDF, not a scan. A short set of notes with a glossary gives the AI, and the fallback, enough material for a draft.", align="justify")
    para(doc, "Repository. The working copy is the IntelliClass project used for the earlier assignments in this module. Record the submitted Git or Brightspace location here if a link is required: ________________________________.", align="justify")


def question_2(doc):
    heading(doc, "Question 2 — Working prototype")
    para(doc, "The prototype demonstrates the central value of IntelliClass: study notes become a reviewed quiz, the learner’s result is kept, and a wrong answer can be explained.", size=11, color=MUTED)

    heading(doc, "2.1 End-to-end workflow", 2)
    para(doc, "The demonstrated workflow has navigation, checks, a visible result and a clear error when the input is not usable.", align="justify")
    bullet(doc, "The administrator signs in, creates the class, subject and users, and links the learner and the teacher.")
    bullet(doc, "The teacher signs in, opens Study materials, and uploads a PDF. A file that is not a PDF is rejected. A PDF with no readable text is rejected with a message that asks for a text-based file.")
    bullet(doc, "The teacher opens Quizzes, chooses the material and chapters, sets a difficulty mix, and asks for a draft.")
    bullet(doc, "The draft is shown for editing. It stays unpublished until the teacher approves it. Rejected or unfinished questions are not offered to learners.")
    bullet(doc, "The learner signs in, opens the published quiz, submits answers, and sees the stored score.")
    bullet(doc, "If an answer is wrong, the learner can ask for an explanation. The parent can open the same learner’s quiz results.")
    para(doc, "Validation covers a missing login, a short password on account creation (at least 8 characters), the wrong role on a protected action, a non-PDF upload, and a quiz submitted before it is published.", align="justify")

    heading(doc, "2.2 Emerging technology in the workflow", 2)
    para(doc, "The AI step sits in the middle of the workflow, not beside it. After the PDF text is stored, the server sends the selected chapters and a fixed instruction to Hugging Face: write questions only from those notes, in the requested difficulty mix. The reply is parsed as structured questions. Each question is checked for four distinct options, a correct answer that matches one option, and wording that is not an empty or banned choice. Accepted questions are saved as a draft and shown to the teacher. That draft is the observable result.", align="justify")
    para(doc, "A second AI result appears after the learner submits. For an incorrect answer, the server sends the question, the learner’s choice, the correct answer and the relevant notes. The explanation is returned on the quiz screen. The model never receives the whole learner record, and it never sets a pass or fail.", align="justify")
    para(doc, "If Hugging Face fails or returns too little, the same request continues with a local builder that writes questions from definitions in the notes. The teacher still reviews that draft. On 31 October 2026 a glossary sample of eight terms produced 8 questions, and all 8 passed the same validator, in about 2 milliseconds. A short note with no glossary produced 3 weak questions and the validator accepted none of them, which is why the screen tells the teacher to choose more of the notes.", align="justify")

    heading(doc, "2.3 Persistent data", 2)
    para(doc, "PostgreSQL stores users, classes, subjects, the links between them, the PDF record and its extracted text, the quiz, each question, and the learner’s submission and score. Restarting the server does not remove a published quiz or a stored result. The schema is applied from server/db/schema.sql when the API starts.", align="justify")

    heading(doc, "2.4 Security and reliability", 2)
    bullet(doc, "Passwords are stored as bcrypt hashes. The temporary password is not kept in the database as plain text.")
    bullet(doc, "Sign-in returns a JWT. Protected routes use that token, and requireRole blocks a learner from publishing a quiz or calling the teacher AI route.")
    bullet(doc, "The Hugging Face token stays in server/.env. The browser never receives it.")
    bullet(doc, "Helmet and CORS limit the API to the configured client origin. A bad request returns a short message and an HTTP status, not a stack trace.")
    bullet(doc, "A learner only receives published quizzes for a linked class. A parent only sees a linked child.")

    caption(doc, "Table 2  Prototype evidence for the assessed workflow")
    add_table(
        doc,
        ["ID", "Status", "Feature", "Test", "Evidence"],
        [
            ["FR-01", "Completed", "Role dashboard", "TC-01", "Live sign-in"],
            ["FR-03", "Completed", "PDF text extraction", "TC-02", "Upload error or stored text"],
            ["FR-04", "Completed", "AI draft, then review", "TC-05", "Draft on screen"],
            ["FR-05", "Completed", "Score stored", "TC-04", "Result after submit"],
            ["FR-06", "Completed", "Answer explanation", "TC-06", "Explanation text"],
            ["ETR-01", "Completed", "Hugging Face or fallback", "TC-05", "8 of 8 local questions valid"],
        ],
        [2.0, 2.6, 4.4, 2.2, 5.4],
    )


def question_3(doc):
    heading(doc, "Question 3 — UML of the prototype")
    para(doc, "The diagrams describe the prototype that will be demonstrated, not every screen that was designed earlier.", size=11, color=MUTED)

    heading(doc, "3.1 Use-case diagram", 2)
    para(doc, "Administrator, teacher, learner and parent are the people in the demonstration. The AI service is a supporting system. Sign-in is shared. Only a teacher generates and publishes a quiz. Only a learner asks for an explanation. A parent views progress.", align="justify")
    figure(doc, "01-usecase.png", 6.3)
    caption(doc, "Figure 1  Use cases included in the demonstration")

    heading(doc, "3.2 Activity diagram", 2)
    para(doc, "The activity is the quiz path. A PDF without readable text stops with an error. If the model does not return usable questions, the server builds a draft from the notes and still sends it for review. Edit or reject does not publish the quiz. A wrong answer is the point where the explanation step runs.", align="justify")
    figure(doc, "02-activity.png", 5.6)
    caption(doc, "Figure 2  Activity diagram for AI-assisted quiz generation and assessment")

    heading(doc, "3.3 Class diagram", 2)
    para(doc, "The main records are the user, the class, the subject, the study material, the quiz, its questions and the stored result. Role is an attribute of User. AiService is external. A parent is linked to a learner rather than owning the result directly.", align="justify")
    figure(doc, "03-class.png", 6.3)
    caption(doc, "Figure 3  Main classes in the prototype")

    heading(doc, "3.4 Sequence diagram", 2)
    para(doc, "Time runs from the teacher, through the React screen and the Express API, to PostgreSQL and Hugging Face. The model is called only after the text has been saved, and the draft is validated before it is stored.", align="justify")
    figure(doc, "04-sequence.png", 6.3)
    caption(doc, "Figure 4  Sequence for generating and publishing an AI quiz")

    heading(doc, "3.5 Deployment and differences from the design", 2)
    para(doc, "The browser holds the React interface. The Node server holds the rules, the file upload and the AI call. PostgreSQL holds the records. Hugging Face is outside the school network. The API key never leaves the server.", align="justify")
    figure(doc, "05-deployment.png", 6.3)
    caption(doc, "Figure 5  Deployment of the prototype")
    para(doc, "Three differences matter between the earlier design and this build.", align="justify")
    bullet(doc, "The design drew administrator, teacher, learner and parent as subclasses. The database stores one users table and a role value. The class diagram follows that simpler structure.")
    bullet(doc, "Homework and term reports were in the original scope and are still in the schema and routes. Their menus are switched off for this demonstration so the assessed path is the quiz workflow.")
    bullet(doc, "The sequence shows Hugging Face. When that call fails, the same API step uses a local builder instead of stopping with an empty quiz. The teacher still has to approve the result.")


def question_4(doc):
    heading(doc, "Question 4 — Evidence, measures and limits")
    para(doc, "The tests below cover the main path, a bad input, access control, stored data and the AI component.", size=11, color=MUTED)

    heading(doc, "4.1 Test cases", 2)
    caption(doc, "Table 3  Representative tests")
    add_table(
        doc,
        ["ID", "Case", "Expected", "Actual", "Status"],
        [
            ["TC-01", "Sign in with a wrong password", "Access is refused", "The login route returns 401 and does not open a dashboard", "Pass"],
            ["TC-02", "Upload a file that is not a PDF", "The upload is rejected", "The materials route returns 400 before a record is stored", "Pass"],
            ["TC-03", "A learner calls quiz generation", "The action is refused", "requireRole allows only a teacher or administrator", "Pass"],
            ["TC-04", "Submit a quiz that is still a draft", "No score is stored", "The submit route rejects anything that is not published", "Pass"],
            ["TC-05", "Draft 8 questions from glossary notes", "Usable questions from the notes", "Executed 31 Oct 2026: 8 built and 8 accepted by the validator", "Pass"],
            ["TC-06", "Draft from a short note with no glossary", "A weak draft is not silently accepted", "Executed 31 Oct 2026: 3 built and 0 accepted, because they lacked four options", "Pass"],
        ],
        [1.6, 4.2, 3.6, 5.0, 1.6],
    )
    para(doc, "TC-01 to TC-04 follow the responses coded in the login, upload, role and submit routes, and they are the cases to repeat in the live demonstration. TC-05 and TC-06 were executed against the prototype’s own generator and validator, without calling Hugging Face, so the fallback can be shown even if the external service is down.", align="justify")

    heading(doc, "4.2 Quantitative measures", 2)
    para(doc, "Measure 1 — fallback completeness. On a note with eight defined terms, the local builder produced 8 of the 8 requested questions, and the validator accepted 8 of 8 (100% of that sample). The five timed runs averaged about 2 milliseconds, so the fallback does not delay the demonstration.", align="justify")
    para(doc, "Measure 2 — fallback rejection. On a short paragraph with too few definitions, 0 of 3 built questions were accepted. The check is doing useful work: it refuses a draft that does not meet the four-option rule instead of publishing a broken quiz. The live model is judged the same way. A draft is kept only after that check, and only a teacher can publish it.", align="justify")

    heading(doc, "4.3 Limitations and corrective actions", 2)
    para(doc, "Limitation 1. The model, and the simpler fallback, can still miss the point of the notes or need a glossary before they produce a full set of questions. A scanned PDF has no text, so generation cannot start.", align="justify")
    para(doc, "Corrective action. Keep the teacher review step in the final system. Add a clearer message when a PDF has no text, and add optical character recognition only for those scans. Continue to reject questions that fail the validator.", align="justify")
    para(doc, "Limitation 2. Homework marking and term reports are built but hidden, and the explanation depends on an external service that can be slow or unavailable.", align="justify")
    para(doc, "Corrective action. Turn those screens back on after the demonstration checklist is signed off. Keep the local fallback, cache a successful explanation against the question, and never let the model set the learner’s final mark.", align="justify")


def question_5(doc):
    heading(doc, "Question 5 — Presentation and live demonstration")
    para(doc, "The presentation is 5 minutes. The live demonstration is 10 minutes. The slides are in IntelliClass_Presentation.pptx, in the Assignment 2 folder of this project, and they follow the order required here.", size=11, color=MUTED)

    heading(doc, "5.1 Five-minute structure", 2)
    bullet(doc, "Problem — missed homework, slow quiz preparation, parents who hear late, and no single record.")
    bullet(doc, "Proposed solution — one platform for the administrator, teacher, learner and parent.")
    bullet(doc, "Architecture — React, Node and Express, PostgreSQL, and Hugging Face called only from the server.")
    bullet(doc, "Emerging technology — draft a quiz, summarise stored scores, explain a wrong answer. The teacher approves first.")
    bullet(doc, "Prototype features — sign-in, PDF text, chapter and difficulty choice, publish, stored score, explanation, parent view.")
    bullet(doc, "Results and limitations — the notes check and the teacher gate hold; vague output, scanned PDFs and a failed model call are the limits.")
    para(doc, "Speaker notes with a rough time for each slide are in IntelliClass_Presenter_Notes.docx beside the slides.", align="justify")

    heading(doc, "5.2 Ten-minute demonstration and fallback", 2)
    bullet(doc, "Minutes 1–2. Sign in as the administrator and show the class, subject and linked users. Sign out.")
    bullet(doc, "Minutes 2–5. Sign in as the teacher. Upload the prepared PDF. Show the extracted text, generate a draft, edit one question, and publish.")
    bullet(doc, "Minutes 5–8. Sign in as the learner. Complete the quiz, show the stored score, and request an explanation for one wrong answer.")
    bullet(doc, "Minutes 8–10. Sign in as the parent and open that learner’s result. If time remains, show that a learner cannot open the generate action.")
    para(doc, "Fallback. Prepare the PDF and the user links before the session. If Hugging Face does not respond, generate again: the server fills the draft from the notes and the review step is unchanged. If the network fails entirely, use a quiz that was published earlier and is already stored in PostgreSQL, then demonstrate the learner submission and the explanation request. Do not type a new password on screen; use the demonstration accounts already created.", align="justify")

    heading(doc, "5.3 Slides and timing", 2)
    para(doc, "The deck has nine slides, in the green and paper colours of the running application. Each slide has a heading and a short explanation, not a paragraph. The five-minute talk stays on those slides. The ten-minute demonstration is done in the browser, not by reading the slides again.", align="justify")

    heading(doc, "5.4 Questions an assessor may ask", 2)
    bullet(doc, "Why is the model called from Express rather than from React? So the API key and the learner record stay on the server.")
    bullet(doc, "Why can a learner not see a generated quiz immediately? Because status remains draft until the teacher publishes it.")
    bullet(doc, "What happens when the model is wrong? The validator drops a bad question, and the teacher can edit or reject the rest. The model does not set the mark.")
    bullet(doc, "Where is the score kept? In PostgreSQL, on the quiz submission, after the learner submits a published quiz.")


def references(doc):
    heading(doc, "References")
    para(doc, "Express. (2026). Express routing. https://expressjs.com/", size=11)
    para(doc, "Hugging Face. (2026). Inference providers. https://huggingface.co/docs/inference-providers", size=11)
    para(doc, "PostgreSQL Global Development Group. (2026). PostgreSQL documentation. https://www.postgresql.org/docs/", size=11)
    para(doc, "React. (2026). React reference. https://react.dev/", size=11)
    para(doc, "Jones, M., Bradley, J. and Sakimura, N. (2015). JSON Web Token (JWT). RFC 7519. https://www.rfc-editor.org/rfc/rfc7519", size=11)

    heading(doc, "Declaration")
    para(doc, "I declare that IntelliClass is my project for ISJ107V and that this report describes the prototype I will demonstrate. An AI assistant in Cursor was used to organise this report and to draw the figures from the implemented program. I have checked the description against the system. The source code, the design decisions and the live demonstration are my own work.", align="justify")
    para(doc, "Signature ________________________________    Date ______________", space_before=12)


if __name__ == "__main__":
    build()
