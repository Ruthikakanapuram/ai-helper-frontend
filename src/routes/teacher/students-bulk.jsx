import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { AddBulk, Result } from './students';

export function TeacherStudentsBulk() {
  const [result, setResult] = useState(null);
  const queryClient = useQueryClient();
  function onCreated(value) {
    setResult(value);
    void queryClient.invalidateQueries({ queryKey: ['teacher', 'students-list'] });
  }
  return (
    <div className="mx-auto w-full max-w-5xl space-y-5">
      <div>
        <Link to="/teacher/students" className="mb-2 inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:underline">
          <ArrowLeft size={16}/> Back to Students
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Bulk Student Add</h1>
        <p className="mt-1 text-sm text-slate-500">Import student accounts from a CSV file.</p>
      </div>
      <Result result={result} onDismiss={() => setResult(null)} />
      <AddBulk onCreated={onCreated}/>
    </div>
  );
}
