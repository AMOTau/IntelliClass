import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { parseApiError } from '../utils/errors';

export function defaultChapterIds(chapters) {
  const teaching = chapters.filter((chapter) => !chapter.isAssessment).map((chapter) => chapter.id);
  return teaching.length ? teaching : chapters.map((chapter) => chapter.id);
}

export function scopeIsValid(value) {
  return value.materialIds.length > 0
    && value.materialIds.every((id) => !Array.isArray(value.chapterSelection[id]) || value.chapterSelection[id].length > 0);
}

/**
 * value: { materialIds: string[], chapterSelection: { [materialId]: string[] } }
 * A material with no entry in chapterSelection yet uses its teaching chapters.
 */
export default function QuizScopePicker({ materials, value, onChange, disabled = false }) {
  const [chapterData, setChapterData] = useState({});
  const valueRef = useRef(value);
  valueRef.current = value;

  useEffect(() => {
    value.materialIds.forEach((materialId) => {
      if (chapterData[materialId]) {
        return;
      }
      setChapterData((current) => ({ ...current, [materialId]: { loading: true, chapters: [] } }));
      api.get(`/materials/${materialId}/chapters`)
        .then(({ data }) => {
          const chapters = data.chapters ?? [];
          setChapterData((current) => ({ ...current, [materialId]: { loading: false, chapters } }));
          const latest = valueRef.current;
          if (latest.materialIds.includes(materialId) && !Array.isArray(latest.chapterSelection[materialId])) {
            onChange({ ...latest, chapterSelection: { ...latest.chapterSelection, [materialId]: defaultChapterIds(chapters) } });
          }
        })
        .catch((requestError) => {
          setChapterData((current) => ({
            ...current,
            [materialId]: { loading: false, chapters: [], error: parseApiError(requestError, 'Could not read chapters.') },
          }));
        });
    });
  }, [value.materialIds]); // eslint-disable-line react-hooks/exhaustive-deps

  function toggleMaterial(materialId) {
    const selected = value.materialIds.includes(materialId);
    if (selected) {
      const { [materialId]: _removed, ...rest } = value.chapterSelection;
      onChange({ materialIds: value.materialIds.filter((id) => id !== materialId), chapterSelection: rest });
      return;
    }
    const chapters = chapterData[materialId]?.chapters;
    onChange({
      materialIds: [...value.materialIds, materialId],
      chapterSelection: chapters?.length
        ? { ...value.chapterSelection, [materialId]: defaultChapterIds(chapters) }
        : value.chapterSelection,
    });
  }

  function setChapters(materialId, chapterIds) {
    onChange({ ...value, chapterSelection: { ...value.chapterSelection, [materialId]: chapterIds } });
  }

  function toggleChapter(materialId, chapterId) {
    const current = value.chapterSelection[materialId] ?? [];
    setChapters(materialId, current.includes(chapterId) ? current.filter((id) => id !== chapterId) : [...current, chapterId]);
  }

  return (
    <div className="rounded-2xl border border-teal-200 bg-white p-4 space-y-4">
      <div>
        <p className="text-sm font-semibold text-slate-800">Knowledge base — what should the AI use?</p>
        <p className="text-xs text-slate-500">
          Questions come only from the materials and chapters you tick. Combine several uploads or focus on one chapter.
        </p>
      </div>

      <div className="space-y-3">
        {materials.map((material) => {
          const selected = value.materialIds.includes(material.id);
          const data = chapterData[material.id];
          const chosen = value.chapterSelection[material.id] ?? [];

          return (
            <div key={material.id} className={`rounded-xl border px-4 py-3 ${selected ? 'border-teal-400 bg-teal-50/50' : 'border-slate-200 bg-slate-50/60'}`}>
              <label className="flex items-center gap-3 text-sm font-semibold text-slate-800 cursor-pointer">
                <input type="checkbox" checked={selected} disabled={disabled} onChange={() => toggleMaterial(material.id)} />
                <span>{material.title}</span>
                <span className="text-xs font-normal text-slate-500">{material.className} · {material.subject}</span>
              </label>

              {selected ? (
                <div className="mt-3 pl-7 space-y-2">
                  {data?.loading ? <p className="text-xs text-slate-500">Reading chapters…</p> : null}
                  {data?.error ? <p className="text-xs text-rose-600">{data.error}</p> : null}
                  {data && !data.loading && data.chapters.length > 0 ? (
                    <>
                      <div className="flex flex-wrap gap-3 text-xs">
                        <button type="button" disabled={disabled} className="font-semibold text-teal-700" onClick={() => setChapters(material.id, data.chapters.map((chapter) => chapter.id))}>
                          Tick all
                        </button>
                        <button type="button" disabled={disabled} className="font-semibold text-teal-700" onClick={() => setChapters(material.id, defaultChapterIds(data.chapters))}>
                          Teaching chapters only
                        </button>
                        <button type="button" disabled={disabled} className="font-semibold text-slate-500" onClick={() => setChapters(material.id, [])}>
                          Clear
                        </button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {data.chapters.map((chapter) => (
                          <label key={chapter.id} className="flex items-start gap-2 text-sm text-slate-700 cursor-pointer">
                            <input
                              type="checkbox"
                              className="mt-1"
                              disabled={disabled}
                              checked={chosen.includes(chapter.id)}
                              onChange={() => toggleChapter(material.id, chapter.id)}
                            />
                            <span>
                              {chapter.title}
                              {chapter.isAssessment ? <span className="ml-1 text-xs text-amber-700">(self-check / exam bank)</span> : null}
                              {chapter.sections?.length ? <span className="block text-xs text-slate-400">{chapter.sections.length} sections</span> : null}
                            </span>
                          </label>
                        ))}
                      </div>
                      {chosen.length === 0 ? <p className="text-xs text-rose-600">Tick at least one chapter, or untick this material.</p> : null}
                    </>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
        {materials.length === 0 ? <p className="text-sm text-slate-500">Upload a PDF first.</p> : null}
      </div>
    </div>
  );
}
