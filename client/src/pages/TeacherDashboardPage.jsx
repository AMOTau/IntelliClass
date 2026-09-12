import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthSession } from '../context/AuthSessionContext';
import { api } from '../lib/api';
import { parseApiError } from '../utils/errors';

const fileOrigin = (import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api').replace(/\/api\/?$/, '');

export default function TeacherDashboardPage() {
  const { user, signOut } = useAuthSession();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [notice, setNotice] = useState('');
  const [materials, setMaterials] = useState([]);
  const [selectedMaterial, setSelectedMaterial] = useState(null);
  const [quizDraft, setQuizDraft] = useState(null);
  const [quizWarning, setQuizWarning] = useState('');
  const [generatingQuiz, setGeneratingQuiz] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [dashData, setDashData] = useState({
    classes: [],
    subjects: [],
    totalLearners: 0,
    summary: { totalClasses: 0, totalSubjects: 0, totalLearners: 0 },
    recentQuizzes: [],
    recentHomework: [],
  });
  const [uploadForm, setUploadForm] = useState({
    title: '',
    subjectId: '',
    classId: '',
    file: null,
  });

  useEffect(() => {
    loadTeacherData();
  }, []);

  async function loadTeacherData() {
    setLoading(true);
    setError('');

    try {
      const [dashboardResponse, materialsResponse, quizzesResponse] = await Promise.all([
        api.get('/dashboard/teacher'),
        api.get('/materials'),
        api.get('/quizzes'),
      ]);
      setDashData({
        ...dashboardResponse.data,
        recentQuizzes: quizzesResponse.data.quizzes ?? dashboardResponse.data.recentQuizzes ?? [],
      });
      setMaterials(materialsResponse.data.materials ?? []);
    } catch (requestError) {
      setError(parseApiError(requestError, 'Failed to load dashboard data.'));
    } finally {
      setLoading(false);
    }
  }

  const defaultClassId = dashData.classes[0]?.id ?? '';
  const defaultSubjectId = dashData.subjects[0]?.id ?? '';

  const readyToUpload = useMemo(
    () => Boolean(uploadForm.file && (uploadForm.classId || defaultClassId) && (uploadForm.subjectId || defaultSubjectId)),
    [uploadForm, defaultClassId, defaultSubjectId]
  );

  async function handleMaterialUpload(event) {
    event.preventDefault();
    setUploading(true);
    setUploadError('');
    setNotice('');

    try {
      const formData = new FormData();
      const classId = uploadForm.classId || defaultClassId;
      const subjectId = uploadForm.subjectId || defaultSubjectId;
      formData.append('title', uploadForm.title);
      formData.append('classId', classId);
      formData.append('subjectId', subjectId);
      formData.append('file', uploadForm.file);

      const { data } = await api.post('/materials/upload', formData);
      setUploadForm({ title: '', subjectId, classId, file: null });
      event.target.reset?.();
      setNotice('PDF uploaded and text extracted. You can create a quiz from it now.');
      await loadTeacherData();
      if (data.material) {
        startQuizFromMaterial(data.material);
      }
    } catch (requestError) {
      setUploadError(parseApiError(requestError, 'Failed to upload material.'));
    } finally {
      setUploading(false);
    }
  }

  async function openMaterial(materialId) {
    setError('');
    try {
      const { data } = await api.get(`/materials/${materialId}`);
      setSelectedMaterial(data.material ?? null);
    } catch (requestError) {
      setError(parseApiError(requestError, 'Failed to load material.'));
    }
  }

  async function deleteMaterial(materialId) {
    if (!window.confirm('Delete this material?')) {
      return;
    }

    try {
      await api.delete(`/materials/${materialId}`);
      if (selectedMaterial?.id === materialId) {
        setSelectedMaterial(null);
      }
      setNotice('Material deleted.');
      await loadTeacherData();
    } catch (requestError) {
      setError(parseApiError(requestError, 'Failed to delete material.'));
    }
  }

  function startQuizFromMaterial(material) {
    setQuizWarning('');
    setQuizDraft({
      material,
      title: `${material.title} Quiz`,
      classId: material.classId || defaultClassId,
      subjectId: material.subjectId || defaultSubjectId,
      questionCount: 5,
      quiz: null,
    });
  }

  async function generateQuiz() {
    if (!quizDraft?.material) {
      return;
    }

    setGeneratingQuiz(true);
    setQuizWarning('');
    setError('');

    try {
      const { data } = await api.post('/ai/generate-quiz', {
        materialId: quizDraft.material.id,
        title: quizDraft.title,
        classId: quizDraft.classId || quizDraft.material.classId,
        subjectId: quizDraft.subjectId || quizDraft.material.subjectId,
        questionCount: Number(quizDraft.questionCount) || 5,
      });

      setQuizDraft((current) => ({
        ...current,
        quiz: data.quiz,
      }));
      setQuizWarning(data.warning || '');
      setNotice('Draft quiz ready. Edit anything that looks off, then publish.');
      await loadTeacherData();
    } catch (requestError) {
      setError(parseApiError(requestError, 'Failed to generate quiz.'));
    } finally {
      setGeneratingQuiz(false);
    }
  }

  function updateDraftQuestion(index, field, value) {
    setQuizDraft((current) => {
      if (!current?.quiz) {
        return current;
      }

      const questions = current.quiz.questions.map((question, questionIndex) => {
        if (questionIndex !== index) {
          return question;
        }

        if (field.startsWith('option-')) {
          const optionIndex = Number(field.split('-')[1]);
          const options = [...question.options];
          const previous = options[optionIndex];
          options[optionIndex] = value;
          return {
            ...question,
            options,
            correctAnswer: question.correctAnswer === previous ? value : question.correctAnswer,
          };
        }

        return { ...question, [field]: value };
      });

      return { ...current, quiz: { ...current.quiz, questions } };
    });
  }

  async function saveAndPublish() {
    if (!quizDraft?.quiz) {
      return;
    }

    setPublishing(true);
    setError('');

    try {
      await api.put(`/quizzes/${quizDraft.quiz.id}`, {
        title: quizDraft.title || quizDraft.quiz.title,
        questions: quizDraft.quiz.questions.map((question, index) => ({
          questionText: question.questionText,
          options: question.options,
          correctAnswer: question.correctAnswer,
          explanation: question.explanation,
          difficulty: question.difficulty,
          topic: question.topic,
          questionOrder: index + 1,
        })),
      });

      await api.post(`/quizzes/${quizDraft.quiz.id}/publish`);
      setNotice('Quiz published to the class.');
      setQuizDraft(null);
      await loadTeacherData();
    } catch (requestError) {
      setError(parseApiError(requestError, 'Failed to publish quiz.'));
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-blue-950 to-slate-950">
      <header className="bg-gradient-to-r from-slate-950 to-blue-950 border-b border-teal-500/20 text-white shadow-xl">
        <div className="max-w-7xl mx-auto px-6 py-8 flex justify-between items-center">
          <div>
            <p className="text-teal-400 text-sm font-semibold mb-2">IntelliClass</p>
            <h1 className="text-4xl font-bold">Welcome, {user?.firstName}</h1>
            <p className="text-gray-400 mt-2">Upload notes, generate a quiz, then publish it to your class.</p>
          </div>
          <button onClick={signOut} className="px-6 py-2 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-lg transition">
            Sign Out
          </button>
        </div>
      </header>

      {(error || notice) && (
        <div className="max-w-7xl mx-auto px-6 pt-6 space-y-3">
          {error ? <div className="bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-3 rounded-lg">{error}</div> : null}
          {notice ? <div className="bg-emerald-500/10 border border-emerald-400/30 text-emerald-200 px-4 py-3 rounded-lg">{notice}</div> : null}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center min-h-[50vh] text-white text-2xl">Loading...</div>
      ) : (
        <main className="max-w-7xl mx-auto px-6 py-12 space-y-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              ['Classes', dashData.summary?.totalClasses ?? dashData.classes.length],
              ['Learners', dashData.summary?.totalLearners ?? dashData.totalLearners],
              ['Subjects', dashData.summary?.totalSubjects ?? dashData.subjects.length],
            ].map(([label, value]) => (
              <div key={label} className="bg-slate-900/50 border border-teal-500/30 rounded-lg p-6">
                <p className="text-gray-400 text-sm font-semibold uppercase">{label}</p>
                <p className="text-4xl font-bold text-teal-400 mt-2">{value}</p>
              </div>
            ))}
          </div>

          <section className="rounded-2xl border border-teal-500/20 bg-slate-950/70 p-6 md:p-8">
            <h2 className="text-2xl font-bold text-white">Study materials</h2>
            <p className="text-sm text-slate-400 mt-1">Upload a PDF. IntelliClass extracts the text and can draft a quiz from it.</p>

            {uploadError ? <div className="mt-4 rounded-lg border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{uploadError}</div> : null}

            <form className="mt-6 grid grid-cols-1 lg:grid-cols-4 gap-4" onSubmit={handleMaterialUpload}>
              <input
                type="text"
                value={uploadForm.title}
                onChange={(event) => setUploadForm((current) => ({ ...current, title: event.target.value }))}
                className="rounded-lg border border-teal-500/20 bg-slate-900/70 px-4 py-3 text-white"
                placeholder="Title (optional)"
              />
              <select
                value={uploadForm.classId || defaultClassId}
                onChange={(event) => setUploadForm((current) => ({ ...current, classId: event.target.value }))}
                className="rounded-lg border border-teal-500/20 bg-slate-900/70 px-4 py-3 text-white"
                required
              >
                <option value="">Class</option>
                {dashData.classes.map((classItem) => (
                  <option key={classItem.id} value={classItem.id}>{classItem.name}</option>
                ))}
              </select>
              <select
                value={uploadForm.subjectId || defaultSubjectId}
                onChange={(event) => setUploadForm((current) => ({ ...current, subjectId: event.target.value }))}
                className="rounded-lg border border-teal-500/20 bg-slate-900/70 px-4 py-3 text-white"
                required
              >
                <option value="">Subject</option>
                {dashData.subjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>{subject.name}</option>
                ))}
              </select>
              <input
                type="file"
                accept="application/pdf,.pdf"
                onChange={(event) => setUploadForm((current) => ({ ...current, file: event.target.files?.[0] ?? null }))}
                className="rounded-lg border border-teal-500/20 bg-slate-900/70 px-4 py-3 text-slate-300 file:mr-3 file:rounded-md file:border-0 file:bg-teal-500 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-slate-950"
                required
              />
              <div className="lg:col-span-4">
                <button type="submit" disabled={uploading || !readyToUpload} className="bg-teal-500 hover:bg-teal-400 disabled:opacity-60 text-slate-950 font-semibold px-5 py-3 rounded-lg">
                  {uploading ? 'Uploading…' : 'Upload PDF'}
                </button>
              </div>
            </form>

            <div className="mt-8 space-y-4">
              {materials.length === 0 ? (
                <div className="rounded-lg border border-teal-500/20 p-8 text-center text-gray-400">No study materials yet.</div>
              ) : (
                materials.map((material) => (
                  <div key={material.id} className="rounded-xl border border-teal-500/30 bg-slate-900/50 p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-bold text-white">{material.title}</h3>
                      <p className="text-sm text-slate-400 mt-1">
                        {material.subject || 'Subject not set'} · {material.className || 'Class not set'}
                        {material.hasExtractedText ? ' · Text extracted' : ' · No text extracted'}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => startQuizFromMaterial(material)} className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg">
                        Create quiz
                      </button>
                      <button type="button" onClick={() => openMaterial(material.id)} className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg">
                        Preview
                      </button>
                      <a href={`${fileOrigin}${material.fileUrl}`} target="_blank" rel="noreferrer" className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg">
                        PDF
                      </a>
                      <button type="button" onClick={() => deleteMaterial(material.id)} className="text-rose-200 px-4 py-2 rounded-lg border border-rose-400/20">
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-6">Quizzes</h2>
            {dashData.recentQuizzes.length === 0 ? (
              <div className="rounded-lg border border-teal-500/20 p-8 text-center text-gray-400">No quizzes yet. Upload a PDF and choose Create quiz.</div>
            ) : (
              <div className="space-y-4">
                {dashData.recentQuizzes.map((quiz) => (
                  <button
                    key={quiz.id}
                    type="button"
                    onClick={() => navigate(`/quizzes/${quiz.id}`)}
                    className="w-full text-left rounded-xl border border-teal-500/30 bg-slate-900/50 p-6 hover:border-teal-400/60"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="text-lg font-bold text-white">{quiz.title}</h3>
                        <p className="text-sm text-slate-400 mt-1">
                          {quiz.className || quiz.class_name || 'Class'} · {quiz.subjectName || quiz.subject_name || 'Subject'} · {quiz.questionCount ?? 0} questions
                        </p>
                      </div>
                      <span className={`font-semibold ${quiz.status === 'published' ? 'text-teal-400' : 'text-yellow-400'}`}>{quiz.status}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>
        </main>
      )}

      {selectedMaterial ? (
        <div className="fixed inset-0 z-50 bg-slate-950/80 px-4 py-6 overflow-y-auto">
          <div className="mx-auto max-w-4xl rounded-3xl border border-teal-500/15 bg-slate-950 p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-teal-300">Extracted text</p>
                <h3 className="text-2xl font-bold text-white mt-1">{selectedMaterial.title}</h3>
              </div>
              <button type="button" onClick={() => setSelectedMaterial(null)} className="text-slate-400">Close</button>
            </div>
            <pre className="mt-6 max-h-[60vh] overflow-auto whitespace-pre-wrap text-sm text-slate-200">{selectedMaterial.extractedText || 'No text could be extracted from this PDF.'}</pre>
          </div>
        </div>
      ) : null}

      {quizDraft ? (
        <div className="fixed inset-0 z-50 bg-slate-950/85 px-4 py-6 overflow-y-auto">
          <div className="mx-auto max-w-4xl rounded-3xl border border-teal-500/15 bg-slate-950 p-6 space-y-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-indigo-300">AI quiz draft</p>
                <h3 className="text-2xl font-bold text-white mt-1">{quizDraft.material.title}</h3>
              </div>
              <button type="button" onClick={() => setQuizDraft(null)} className="text-slate-400">Close</button>
            </div>

            {quizWarning ? <div className="rounded-lg border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-amber-100 text-sm">{quizWarning}</div> : null}

            {!quizDraft.quiz ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <input
                  value={quizDraft.title}
                  onChange={(event) => setQuizDraft((current) => ({ ...current, title: event.target.value }))}
                  className="md:col-span-2 rounded-lg border border-teal-500/20 bg-slate-900/70 px-4 py-3 text-white"
                />
                <input
                  type="number"
                  min="3"
                  max="10"
                  value={quizDraft.questionCount}
                  onChange={(event) => setQuizDraft((current) => ({ ...current, questionCount: event.target.value }))}
                  className="rounded-lg border border-teal-500/20 bg-slate-900/70 px-4 py-3 text-white"
                />
                {!quizDraft.material.classId ? (
                  <select
                    value={quizDraft.classId || ''}
                    onChange={(event) => setQuizDraft((current) => ({ ...current, classId: event.target.value }))}
                    className="rounded-lg border border-teal-500/20 bg-slate-900/70 px-4 py-3 text-white"
                  >
                    <option value="">Class</option>
                    {dashData.classes.map((classItem) => (
                      <option key={classItem.id} value={classItem.id}>{classItem.name}</option>
                    ))}
                  </select>
                ) : null}
                {!quizDraft.material.subjectId ? (
                  <select
                    value={quizDraft.subjectId || ''}
                    onChange={(event) => setQuizDraft((current) => ({ ...current, subjectId: event.target.value }))}
                    className="rounded-lg border border-teal-500/20 bg-slate-900/70 px-4 py-3 text-white"
                  >
                    <option value="">Subject</option>
                    {dashData.subjects.map((subject) => (
                      <option key={subject.id} value={subject.id}>{subject.name}</option>
                    ))}
                  </select>
                ) : null}
                <button type="button" onClick={generateQuiz} disabled={generatingQuiz} className="md:col-span-3 rounded-lg bg-teal-500 px-5 py-3 font-semibold text-slate-950 disabled:opacity-60">
                  {generatingQuiz ? 'Generating draft…' : 'Generate draft quiz'}
                </button>
              </div>
            ) : (
              <div className="space-y-5">
                {(quizDraft.quiz.questions ?? []).map((question, index) => (
                  <div key={question.id || index} className="rounded-2xl border border-teal-500/10 p-4 space-y-3">
                    <input
                      value={question.questionText}
                      onChange={(event) => updateDraftQuestion(index, 'questionText', event.target.value)}
                      className="w-full rounded-lg border border-teal-500/20 bg-slate-900/70 px-4 py-3 text-white"
                    />
                    {(question.options || []).map((option, optionIndex) => (
                      <label key={`${question.id}-${optionIndex}`} className="flex items-center gap-3 text-sm text-slate-200">
                        <input
                          type="radio"
                          name={`correct-${index}`}
                          checked={question.correctAnswer === option}
                          onChange={() => updateDraftQuestion(index, 'correctAnswer', option)}
                        />
                        <input
                          value={option}
                          onChange={(event) => updateDraftQuestion(index, `option-${optionIndex}`, event.target.value)}
                          className="flex-1 rounded-lg border border-teal-500/20 bg-slate-900/70 px-3 py-2 text-white"
                        />
                      </label>
                    ))}
                  </div>
                ))}
                <button type="button" onClick={saveAndPublish} disabled={publishing} className="rounded-lg bg-indigo-500 px-5 py-3 font-semibold text-white disabled:opacity-60">
                  {publishing ? 'Publishing…' : 'Save and publish to class'}
                </button>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
