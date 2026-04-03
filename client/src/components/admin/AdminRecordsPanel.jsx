export default function AdminRecordsPanel({ teachers, learners, parents }) {
  return (
    <div className="record-columns">
      <div>
        <h3>Teachers</h3>
        <ul className="record-list">
          {teachers.map((teacher) => (
            <li key={teacher.id}>
              <strong>{teacher.firstName} {teacher.lastName}</strong>
              <span>{teacher.email}</span>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h3>Learners</h3>
        <ul className="record-list">
          {learners.map((learner) => (
            <li key={learner.id}>
              <strong>{learner.firstName} {learner.lastName}</strong>
              <span>{learner.email}</span>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h3>Parents</h3>
        <ul className="record-list">
          {parents.map((parent) => (
            <li key={parent.id}>
              <strong>{parent.firstName} {parent.lastName}</strong>
              <span>{parent.email}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
