import { useEffect, useState } from 'react';
import { useAuthSession } from '../context/AuthSessionContext';
import { api } from '../lib/api';
import { parseApiError } from '../utils/errors';

export default function TeacherDashboardPage() {
  const { user, signOut } = useAuthSession();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadMessage, setUploadMessage] = useState('');
  const [materials, setMaterials] = useState([]);
  const [selectedMaterial, setSelectedMaterial] = useState(null);
  const [materialViewerOpen, setMaterialViewerOpen] = useState(false);
  const [selectedMaterialLoading, setSelectedMaterialLoading] = useState(false);
  const [selectedMaterialError, setSelectedMaterialError] = useState('');
  const [dashData, setDashData] = useState({
    classes: [],
    subjects: [],
    totalLearners: 0,
    summary: {
      totalClasses: 0,
      totalSubjects: 0,
      totalLearners: 0,
    },
    recentMaterials: [],
    recentQuizzes: [],
    recentHomework: [],
  });
  const [uploadForm, setUploadForm] = useState({
    title: '',
    description: '',
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
      const [dashboardResponse, materialsResponse] = await Promise.all([api.get('/dashboard/teacher'), api.get('/materials')]);
      setDashData(dashboardResponse.data);
      setMaterials(materialsResponse.data.materials ?? []);
    } catch (requestError) {
      setError(parseApiError(requestError, 'Failed to load dashboard data.'));
    } finally {
      setLoading(false);
    }
  }

  function handleUploadFieldChange(field, value) {
    setUploadForm((current) => ({ ...current, [field]: value }));
  }

  function handleUploadFileChange(event) {
    const file = event.target.files?.[0] ?? null;
    setUploadForm((current) => ({ ...current, file }));
  }

  async function handleMaterialUpload(event) {
    event.preventDefault();
    setUploading(true);
    setUploadError('');
    setUploadMessage('');

    try {
      const formData = new FormData();
      formData.append('title', uploadForm.title);
      formData.append('description', uploadForm.description);
      formData.append('subject', dashData.subjects.find((subject) => subject.id === uploadForm.subjectId)?.name ?? '');
      formData.append('className', dashData.classes.find((classItem) => classItem.id === uploadForm.classId)?.name ?? '');

      if (uploadForm.file) {
        formData.append('file', uploadForm.file);
      }

      await api.post('/materials/upload', formData);

      setUploadForm({
        title: '',
        description: '',
        subjectId: '',
        classId: '',
        file: null,
      });

      setUploadMessage('Material uploaded successfully.');
      await loadTeacherData();
    } catch (requestError) {
      setUploadError(parseApiError(requestError, 'Failed to upload material.'));
    } finally {
      setUploading(false);
    }
  }

  async function openMaterial(materialId) {
    setSelectedMaterialLoading(true);
    setSelectedMaterialError('');
    setMaterialViewerOpen(true);
    setSelectedMaterial(null);

    try {
      const { data } = await api.get(`/materials/${materialId}`);
      setSelectedMaterial(data.material ?? null);
    } catch (requestError) {
      setSelectedMaterialError(parseApiError(requestError, 'Failed to load material.'));
    } finally {
      setSelectedMaterialLoading(false);
    }
  }

  async function deleteMaterial(materialId) {
    const confirmed = window.confirm('Delete this material? This will remove the file from the server.');

    if (!confirmed) {
      return;
    }

    setError('');

    try {
      await api.delete(`/materials/${materialId}`);
      if (selectedMaterial?.id === materialId) {
        setSelectedMaterial(null);
      }
      setUploadMessage('Material deleted successfully.');
      await loadTeacherData();
    } catch (requestError) {
      setError(parseApiError(requestError, 'Failed to delete material.'));
    }
  }

  function closeMaterialViewer() {
    setSelectedMaterial(null);
    setSelectedMaterialError('');
    setMaterialViewerOpen(false);
  }

  const fileOrigin = (import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api').replace(/\/api\/?$/, '');

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-blue-950 to-slate-950">
      {/* Header */}
      <header className="bg-gradient-to-r from-slate-950 to-blue-950 border-b border-teal-500/20 text-white shadow-xl">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex justify-between items-center">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <span className="text-2xl">📚</span>
                <p className="text-teal-400 text-sm font-semibold">IntelliClass</p>
              </div>
              <h1 className="text-4xl font-bold">Welcome, {user?.firstName}</h1>
              <p className="text-gray-400 mt-2">Teacher Dashboard</p>
            </div>
            <button
              onClick={signOut}
              className="px-6 py-2 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-lg transition"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {error && (
        <div className="max-w-7xl mx-auto px-6 py-4 mt-4">
          <div className="bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-3 rounded-lg">
            {error}
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-white text-2xl">Loading...</div>
        </div>
      ) : (
        <main className="max-w-7xl mx-auto px-6 py-12">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            <div className="bg-gradient-to-br from-slate-900/50 to-slate-800/50 backdrop-blur border border-teal-500/30 rounded-lg shadow-lg p-6 hover:border-teal-500/60 transition">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm font-semibold uppercase">Classes Taught</p>
                  <p className="text-4xl font-bold text-teal-400 mt-2">
                    {dashData.summary?.totalClasses ?? dashData.classes.length}
                  </p>
                </div>
                <div className="text-5xl opacity-30">📚</div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-slate-900/50 to-slate-800/50 backdrop-blur border border-teal-500/30 rounded-lg shadow-lg p-6 hover:border-teal-500/60 transition">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm font-semibold uppercase">Total Learners</p>
                  <p className="text-4xl font-bold text-teal-400 mt-2">
                    {dashData.summary?.totalLearners ?? dashData.totalLearners}
                  </p>
                </div>
                <div className="text-5xl opacity-30">👥</div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-slate-900/50 to-slate-800/50 backdrop-blur border border-teal-500/30 rounded-lg shadow-lg p-6 hover:border-teal-500/60 transition">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm font-semibold uppercase">Subjects</p>
                  <p className="text-4xl font-bold text-teal-400 mt-2">
                    {dashData.summary?.totalSubjects ?? dashData.subjects.length}
                  </p>
                </div>
                <div className="text-5xl opacity-30">📖</div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-12">
            <button
              type="button"
              onClick={() => document.getElementById('material-upload')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              className="bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 text-white font-semibold py-3 px-4 rounded-lg transition"
            >
              📤 Upload Material
            </button>
            <button className="bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 text-white font-semibold py-3 px-4 rounded-lg transition">
              ✍️ Create Quiz
            </button>
            <button className="bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 text-white font-semibold py-3 px-4 rounded-lg transition">
              📝 Assign Homework
            </button>
            <button
              onClick={loadTeacherData}
              className="bg-gradient-to-r from-gray-700 to-gray-800 hover:from-gray-800 hover:to-gray-900 text-white font-semibold py-3 px-4 rounded-lg transition"
            >
              🔄 Refresh
            </button>
          </div>

          {/* Upload Material */}
          <div id="material-upload" className="mb-12 rounded-2xl border border-teal-500/20 bg-gradient-to-br from-slate-900/70 to-slate-950/80 backdrop-blur shadow-2xl p-6 md:p-8">
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-6">
              <div>
                <h2 className="text-2xl font-bold text-white mb-2">Upload Study Material</h2>
                <p className="text-sm text-slate-400">Upload a PDF and we’ll extract the text automatically for quiz generation.</p>
              </div>
              <button
                type="button"
                onClick={loadTeacherData}
                className="bg-slate-800 hover:bg-slate-700 text-white font-semibold py-3 px-4 rounded-lg transition"
              >
                Refresh Materials
              </button>
            </div>

            {uploadMessage ? (
              <div className="mb-4 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
                {uploadMessage}
              </div>
            ) : null}

            {uploadError ? (
              <div className="mb-4 rounded-lg border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {uploadError}
              </div>
            ) : null}

            <form className="grid grid-cols-1 lg:grid-cols-2 gap-4" onSubmit={handleMaterialUpload}>
              <label className="flex flex-col gap-2 text-sm text-slate-300">
                Title
                <input
                  type="text"
                  value={uploadForm.title}
                  onChange={(event) => handleUploadFieldChange('title', event.target.value)}
                  className="rounded-lg border border-teal-500/20 bg-slate-900/70 px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-400/40"
                  placeholder="Lesson 4: Fractions"
                />
              </label>

              <label className="flex flex-col gap-2 text-sm text-slate-300">
                Subject
                <select
                  value={uploadForm.subjectId}
                  onChange={(event) => handleUploadFieldChange('subjectId', event.target.value)}
                  className="rounded-lg border border-teal-500/20 bg-slate-900/70 px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-teal-400/40"
                  required
                >
                  <option value="">Select subject</option>
                  {dashData.subjects.map((subject) => (
                    <option key={subject.id} value={subject.id}>
                      {subject.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-2 text-sm text-slate-300">
                Class
                <select
                  value={uploadForm.classId}
                  onChange={(event) => handleUploadFieldChange('classId', event.target.value)}
                  className="rounded-lg border border-teal-500/20 bg-slate-900/70 px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-teal-400/40"
                  required
                >
                  <option value="">Select class</option>
                  {dashData.classes.map((classItem) => (
                    <option key={classItem.id} value={classItem.id}>
                      {classItem.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-2 text-sm text-slate-300 lg:col-span-2">
                Description
                <textarea
                  rows="3"
                  value={uploadForm.description}
                  onChange={(event) => handleUploadFieldChange('description', event.target.value)}
                  className="rounded-lg border border-teal-500/20 bg-slate-900/70 px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-400/40"
                  placeholder="Short summary of what this resource covers"
                />
              </label>

              <label className="flex flex-col gap-2 text-sm text-slate-300 lg:col-span-2">
                PDF file
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={handleUploadFileChange}
                  className="rounded-lg border border-teal-500/20 bg-slate-900/70 px-4 py-3 text-slate-300 file:mr-4 file:rounded-md file:border-0 file:bg-teal-500 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-slate-950 hover:file:bg-teal-400"
                  required
                />
              </label>

              <div className="lg:col-span-2 flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  disabled={uploading}
                  className="bg-teal-500 hover:bg-teal-400 disabled:opacity-60 text-slate-950 font-semibold px-5 py-3 rounded-lg transition"
                >
                  {uploading ? 'Uploading…' : 'Upload PDF'}
                </button>
                <span className="text-xs text-slate-400">PDF files are stored on the server and text is extracted automatically.</span>
              </div>
            </form>
          </div>

          {/* Classes Section */}
          <div className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-6">Your Classes</h2>
            {dashData.classes.length === 0 ? (
              <div className="bg-gradient-to-br from-slate-900/50 to-slate-800/50 backdrop-blur border border-teal-500/20 rounded-lg p-8 text-center text-gray-400">
                No classes assigned yet
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {dashData.classes.map((cls) => (
                  <div key={cls.id} className="bg-gradient-to-br from-slate-900/50 to-slate-800/50 backdrop-blur border border-teal-500/30 rounded-lg shadow-lg p-6 hover:border-teal-500/60 transition">
                    <h3 className="text-xl font-bold text-white">{cls.name}</h3>
                    <div className="mt-4 space-y-2 text-sm text-gray-400">
                      {cls.grade_level && <p><strong>Grade:</strong> {cls.grade_level}</p>}
                      {cls.academic_year && <p><strong>Year:</strong> {cls.academic_year}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Subjects Section */}
          <div className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-6">Your Subjects</h2>
            {dashData.subjects.length === 0 ? (
              <div className="bg-gradient-to-br from-slate-900/50 to-slate-800/50 backdrop-blur border border-teal-500/20 rounded-lg p-8 text-center text-gray-400">
                No subjects assigned yet
              </div>
            ) : (
              <div className="flex flex-wrap gap-3">
                {dashData.subjects.map((subject) => (
                  <div key={subject.id} className="bg-gradient-to-r from-teal-600 to-teal-700 text-white px-4 py-2 rounded-full font-semibold">
                    {subject.name}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Materials Section */}
          <div className="mb-12">
            <div className="flex items-end justify-between gap-4 mb-6">
              <div>
                <h2 className="text-2xl font-bold text-white">Your Study Materials</h2>
                <p className="text-sm text-slate-400 mt-1">Open a file to inspect the extracted text or delete it from storage.</p>
              </div>
              <span className="text-sm text-teal-300 bg-teal-500/10 border border-teal-400/20 rounded-full px-3 py-1">
                {materials.length} uploaded
              </span>
            </div>

            {materials.length === 0 ? (
              <div className="bg-gradient-to-br from-slate-900/50 to-slate-800/50 backdrop-blur border border-teal-500/20 rounded-lg p-8 text-center text-gray-400">
                No study materials uploaded yet. Use the form above to add your first PDF.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {materials.map((material) => (
                  <div
                    key={material.id}
                    className="bg-gradient-to-br from-slate-900/50 to-slate-800/50 backdrop-blur border border-teal-500/30 rounded-lg shadow-lg p-6 flex flex-col md:flex-row md:justify-between md:items-start gap-4 hover:border-teal-500/60 transition"
                  >
                    <div className="min-w-0">
                      <h3 className="text-lg font-bold text-white">{material.title}</h3>
                      <div className="mt-2 space-y-1 text-sm text-gray-400">
                        {material.subject && <p><strong>Subject:</strong> {material.subject}</p>}
                        {material.className && <p><strong>Class:</strong> {material.className}</p>}
                        {material.description && <p><strong>Description:</strong> {material.description}</p>}
                        <p><strong>Uploaded:</strong> {new Date(material.createdAt).toLocaleDateString()}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => openMaterial(material.id)}
                        className="bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 text-white px-4 py-2 rounded-lg transition"
                      >
                        View
                      </button>
                      <a
                        href={`${fileOrigin}${material.fileUrl}`}
                        target="_blank"
                        rel="noreferrer"
                        className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg transition"
                      >
                        Download
                      </a>
                      <button
                        type="button"
                        onClick={() => deleteMaterial(material.id)}
                        className="bg-rose-500/15 hover:bg-rose-500/25 border border-rose-400/20 text-rose-200 px-4 py-2 rounded-lg transition"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Quizzes */}
          <div className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-6">Recent Quizzes</h2>
            {dashData.recentQuizzes.length === 0 ? (
              <div className="bg-gradient-to-br from-slate-900/50 to-slate-800/50 backdrop-blur border border-teal-500/20 rounded-lg p-8 text-center text-gray-400">
                No quizzes created yet
              </div>
            ) : (
              <div className="space-y-4">
                {dashData.recentQuizzes.map((quiz) => (
                  <div key={quiz.id} className="bg-gradient-to-br from-slate-900/50 to-slate-800/50 backdrop-blur border border-teal-500/30 rounded-lg shadow-lg p-6 flex justify-between items-start hover:border-teal-500/60 transition">
                    <div>
                      <h3 className="text-lg font-bold text-white">{quiz.title}</h3>
                      <div className="mt-2 space-y-1 text-sm text-gray-400">
                        <p><strong>Status:</strong> <span className={`font-semibold ${quiz.status === 'published' ? 'text-teal-400' : 'text-yellow-400'}`}>{quiz.status}</span></p>
                        {quiz.material_title && <p><strong>From Material:</strong> {quiz.material_title}</p>}
                        <p><strong>Created:</strong> {new Date(quiz.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <button className="bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 text-white px-4 py-2 rounded-lg transition whitespace-nowrap ml-4">
                      Manage
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Homework */}
          <div className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-6">Recent Homework Assignments</h2>
            {dashData.recentHomework.length === 0 ? (
              <div className="bg-gradient-to-br from-slate-900/50 to-slate-800/50 backdrop-blur border border-teal-500/20 rounded-lg p-8 text-center text-gray-400">
                No homework assignments created yet
              </div>
            ) : (
              <div className="space-y-4">
                {dashData.recentHomework.map((hw) => (
                  <div key={hw.id} className="bg-gradient-to-br from-slate-900/50 to-slate-800/50 backdrop-blur border border-teal-500/30 rounded-lg shadow-lg p-6 flex justify-between items-start hover:border-teal-500/60 transition">
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-white">{hw.title}</h3>
                      <div className="mt-2 space-y-1 text-sm text-gray-400">
                        {hw.subject && <p><strong>Subject:</strong> {hw.subject}</p>}
                        {hw.class_name && <p><strong>Class:</strong> {hw.class_name}</p>}
                        {hw.due_date && <p><strong>Due Date:</strong> {new Date(hw.due_date).toLocaleDateString()}</p>}
                      </div>
                    </div>
                    <button className="bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 text-white px-4 py-2 rounded-lg transition whitespace-nowrap ml-4">
                      View
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      )}

      {materialViewerOpen ? (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm px-4 py-6 overflow-y-auto">
          <div className="mx-auto w-full max-w-4xl rounded-3xl border border-teal-500/15 bg-slate-950 shadow-2xl overflow-hidden">
            <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-teal-500/10 bg-white/[0.02]">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-teal-300">Study material</p>
                <h3 className="text-2xl font-bold text-white mt-1">{selectedMaterial?.title ?? 'Loading material…'}</h3>
              </div>
              <button type="button" onClick={closeMaterialViewer} className="text-sm font-medium text-slate-400 hover:text-white transition">
                Close
              </button>
            </div>

            <div className="p-6 space-y-6">
              {selectedMaterialLoading ? (
                <div className="text-slate-300">Loading material…</div>
              ) : selectedMaterialError ? (
                <div className="rounded-lg border border-red-400/30 bg-red-500/10 px-4 py-3 text-red-200">{selectedMaterialError}</div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div className="rounded-2xl border border-teal-500/10 bg-white/[0.02] p-4">
                      <p className="text-slate-500">Subject</p>
                      <p className="text-white mt-1">{selectedMaterial.subject || 'Not set'}</p>
                    </div>
                    <div className="rounded-2xl border border-teal-500/10 bg-white/[0.02] p-4">
                      <p className="text-slate-500">Class</p>
                      <p className="text-white mt-1">{selectedMaterial.className || 'Not set'}</p>
                    </div>
                    <div className="rounded-2xl border border-teal-500/10 bg-white/[0.02] p-4 md:col-span-2">
                      <p className="text-slate-500">File</p>
                      <a className="text-teal-300 mt-1 inline-block break-all" href={`${fileOrigin}${selectedMaterial.fileUrl}`} target="_blank" rel="noreferrer">
                        {selectedMaterial.fileName}
                      </a>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold text-white mb-3">Extracted Text</h4>
                    <div className="rounded-2xl border border-teal-500/10 bg-slate-950/60 p-4 max-h-[50vh] overflow-auto whitespace-pre-wrap text-sm text-slate-200 leading-6">
                      {selectedMaterial.extractedText || 'No text could be extracted from this PDF.'}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
