import { useMemo, useState } from 'react';
import { useNavigate, Link } from '@tanstack/react-router';
import { useForm } from '@tanstack/react-form';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { ArrowLeft, Check, Search, Users } from 'lucide-react';
import { toast } from 'sonner';

import { api } from '../../lib/api';
import { activitySchema } from '../../lib/schemas';
import { keys, queryClient } from '../../lib/query';
import { Button, Card, ErrorState, Loading, Spinner } from '../../components/ui';

const helper = createColumnHelper();

// Quick-pick buttons + a dropdown with every 5 minutes (5, 10, ... 120)
const QUICK_DURATIONS = [20, 30, 45];
const DURATION_OPTIONS = Array.from({ length: 24 }, (_, i) => (i + 1) * 5);

function getTodayDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function normalizeStudents(data) {
  const rows = Array.isArray(data)
    ? data
    : Array.isArray(data?.students)
      ? data.students
      : [];

  return rows.map((student) => ({
    ...student,
    id: Number(student.id),
    name: student.fullName ?? student.name ?? student.user?.fullName ?? '',
    rollNumber: String(student.rollNumber ?? ''),
    branch: student.branch ?? '',
    year: student.year ?? '',
    section: student.section ?? '',
  }));
}

function FieldErrors({ errors, fallback }) {
  return errors.slice(0, 1).map((error, index) => {
    const message = String(error?.message ?? error);
    const text =
      fallback && /^(invalid input|required)$/i.test(message.trim())
        ? fallback
        : message;

    return (
      <p key={index} className="mt-1 text-xs text-rose-600">
        {text}
      </p>
    );
  });
}

export function CreateActivity() {
  const navigate = useNavigate();

  const [branch, setBranch] = useState('');
  const [year, setYear] = useState('');
  const [section, setSection] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState([]);

  const students = useQuery({
    queryKey: keys.students(branch, year, section),
    queryFn: () => api.getStudentsByFilter(branch, year, section),
  });

  const studentRows = useMemo(() => normalizeStudents(students.data), [students.data]);

  const shown = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return studentRows;
    return studentRows.filter(
      (s) => s.rollNumber.toLowerCase().includes(term) || s.name.toLowerCase().includes(term),
    );
  }, [studentRows, search]);

  const mutation = useMutation({
    mutationFn: (values) =>
      api.createActivity({
        title: values.name.trim(),
        description: values.description?.trim() || '',
        duration: values.duration,
        scheduledDate: values.scheduledDate,
        studentIds: values.studentIds.map(Number),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.activities });
      void queryClient.invalidateQueries({ queryKey: keys.stats });
      toast.success('Activity created successfully');
      void navigate({ to: '/teacher/activities' });
    },
    onError: (error) => toast.error(error.message || 'Failed to create activity'),
  });

  const form = useForm({
    defaultValues: {
      name: '',
      description: '',
      duration: 30,
    scheduledDate: getTodayDate(),
      studentIds: [],
    },
    validators: { onSubmit: activitySchema },
    onSubmit: async ({ value }) => {
      await mutation.mutateAsync(value);
    },
  });

  function select(ids) {
    const numericIds = [...new Set(ids.map(Number))];
    setSelected(numericIds);
    form.setFieldValue('studentIds', numericIds);
  }

  function toggle(id) {
    const numericId = Number(id);
    select(
      selected.includes(numericId)
        ? selected.filter((v) => v !== numericId)
        : [...selected, numericId],
    );
  }

  const filteredIds = shown.map((s) => s.id);
  const allChecked = filteredIds.length > 0 && filteredIds.every((id) => selected.includes(id));

  const columns = [
    helper.display({
      id: 'check',
      header: () => (
        <input
          aria-label="Select all visible students"
          type="checkbox"
          checked={allChecked}
          onChange={() =>
            select(
              allChecked
                ? selected.filter((id) => !filteredIds.includes(id))
                : [...selected, ...filteredIds],
            )
          }
        />
      ),
      cell: (info) => {
        const student = info.row.original;
        return (
          <input
            type="checkbox"
            aria-label={`Select ${student.rollNumber}`}
            checked={selected.includes(student.id)}
            onClick={(e) => e.stopPropagation()}
            onChange={() => toggle(student.id)}
          />
        );
      },
    }),
    helper.accessor('rollNumber', {
      header: 'Roll number',
      cell: (info) => <span className="font-semibold">{info.getValue()}</span>,
    }),
    helper.accessor('name', { header: 'Student', cell: (info) => info.getValue() || '—' }),
    helper.accessor('branch', { header: 'Branch' }),
    helper.accessor('year', { header: 'Year' }),
    helper.accessor('section', { header: 'Section' }),
  ];

  const table = useReactTable({ data: shown, columns, getCoreRowModel: getCoreRowModel() });

  return (
    // On lg screens the page is exactly the viewport height minus the shell's
    // vertical padding (lg:py-10 = 5rem), so only the student table scrolls.
    <form
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void form.handleSubmit();
      }}
      className="flex flex-col gap-4 lg:h-[calc(100dvh-5rem)] lg:min-h-[640px]"
    >
      {/* Slim header: title on the left, actions on the right */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <Link
            to="/teacher/activities"
            className="muted mb-1 inline-flex items-center gap-1.5 hover:text-blue-600"
          >
            <ArrowLeft size={14} />
            Back to activities
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">Create an activity</h1>
        </div>

        <div className="flex gap-2">
          <Link to="/teacher/activities" className="btn-outline">
            Cancel
          </Link>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? <Spinner /> : <Check size={16} />}
            Create activity
          </Button>
        </div>
      </div>

      {/* ONE card: details on top, students below */}
      <Card className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-5">
        {/* Row 1: title | date | duration */}
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_190px_auto]">
          <form.Field name="name">
            {(field) => (
              <div>
                <label className="field-label" htmlFor="activity-title">
                  Activity Title <span className="text-rose-500">*</span>
                </label>
                <input
                  id="activity-title"
                  className="input"
                  placeholder="e.g. Digital Safety Workshop"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
                <FieldErrors errors={field.state.meta.errors} />
              </div>
            )}
          </form.Field>

          <form.Field name="scheduledDate">
            {(field) => (
              <div>
                <label htmlFor="scheduledDate" className="field-label">
                  Scheduled Date <span className="text-rose-500">*</span>
                </label>
                <input
                  id="scheduledDate"
                  type="date"
                  min={getTodayDate()}
                  className="input"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
                <FieldErrors errors={field.state.meta.errors} />
              </div>
            )}
          </form.Field>

          <form.Field name="duration">
            {(field) => (
              <div>
                <span className="field-label">
                  Session Duration <span className="text-rose-500">*</span>
                </span>
                <div
                  className="flex flex-wrap items-center gap-2"
                  role="group"
                  aria-label="Session duration"
                >
                  {QUICK_DURATIONS.map((minutes) => (
                    <button
                      key={minutes}
                      type="button"
                      aria-pressed={field.state.value === minutes}
                      onClick={() => field.handleChange(minutes)}
                      className={`rounded-xl border px-3.5 py-2.5 text-sm font-bold transition-colors ${
                        field.state.value === minutes
                          ? 'border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                          : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800'
                      }`}
                    >
                      {minutes} min
                    </button>
                  ))}

                  <select
                    aria-label="Choose session duration in minutes"
                    className="input !w-[120px]"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(Number(e.target.value))}
                  >
                    {DURATION_OPTIONS.map((minutes) => (
                      <option key={minutes} value={minutes}>
                        {minutes} min
                      </option>
                    ))}
                  </select>
                </div>
                <FieldErrors
                  errors={field.state.meta.errors}
                  fallback="Select a duration between 5 and 120 min"
                />
              </div>
            )}
          </form.Field>
        </div>

        {/* Row 2: description, full width */}
        <form.Field name="description">
          {(field) => (
            <div className="mt-3">
              <label htmlFor="description" className="field-label">
                Description
              </label>
              <textarea
                id="description"
                rows={2}
                className="input resize-none"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder="Describe the topic, learning objectives, and what students should learn."
              />
              <FieldErrors errors={field.state.meta.errors} />
            </div>
          )}
        </form.Field>

        <hr className="my-4 border-slate-200 dark:border-slate-800" />

        {/* Assign students: fills the remaining height */}
        <div className="flex min-h-0 flex-1 flex-col">
          {/* Heading | Branch | Year | Section | selected: one row */}
          <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2">
            <div className="mr-auto min-w-[190px]">
              <div className="flex flex-wrap items-center gap-x-3">
                <h2 className="text-base font-bold leading-tight">Assign students</h2>

                <form.Field name="studentIds">
                  {(field) =>
                    field.state.meta.errors.length > 0 && selected.length === 0 ? (
                      <span role="alert" className="text-xs font-semibold text-rose-600">
                        {String(
                          field.state.meta.errors[0]?.message ?? field.state.meta.errors[0],
                        )}
                      </span>
                    ) : null
                  }
                </form.Field>
              </div>
              <p className="muted text-xs">Selection persists when you change filters.</p>
            </div>

            <select
  aria-label="Branch"
  className="input !w-36 !py-2 !text-sm"
  value={branch}
  onChange={(e) => setBranch(e.target.value)}
>
  <option value="">All branches</option>
  {['CSE', 'AIML', 'DS'].map((v) => (
    <option key={v} value={v}>
      {v}
    </option>
  ))}
</select>

           <select
  aria-label="Year"
  className="input !w-32 !py-2 !text-sm"
  value={year}
  onChange={(e) => setYear(e.target.value)}
>
  <option value="">All years</option>
  {[1, 2, 3, 4].map((v) => (
    <option key={v} value={v}>
      Year {v}
    </option>
  ))}
</select>

           <select
  aria-label="Section"
  className="input !w-36 !py-2 !text-sm"
  value={section}
  onChange={(e) => setSection(e.target.value)}
>
  <option value="">All sections</option>
  {['A', 'B', 'C', 'D'].map((v) => (
    <option key={v} value={v}>
      Section {v}
    </option>
  ))}
</select>

            <span className="whitespace-nowrap rounded-full bg-blue-100 px-3 py-1.5 text-sm font-bold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
              <Users size={15} className="mr-1 inline" />
              {selected.length} selected
            </span>
          </div>

          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
              <input
                className="input !py-2 !text-sm pl-9"
                aria-label="Search students"
                value={search}
                placeholder="Search roll number or name"
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => select([...new Set([...selected, ...filteredIds])])}
              >
                Select All
              </Button>
              <Button type="button" variant="ghost" onClick={() => select([])}>
                Clear all
              </Button>
            </div>
          </div>

          {students.isPending ? (
            <Loading rows={5} />
          ) : students.isError ? (
            <ErrorState error={students.error} retry={() => void students.refetch()} />
          ) : (
            <div className="max-h-[55vh] min-h-[240px] flex-1 overflow-auto rounded-xl border border-slate-200 dark:border-slate-700 lg:max-h-none">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-800">
                  {table.getHeaderGroups().map((group) => (
                    <tr key={group.id}>
                      {group.headers.map((header) => (
                        <th key={header.id} className="px-4 py-2.5">
                          {flexRender(header.column.columnDef.header, header.getContext())}
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody>
                  {table.getRowModel().rows.map((row) => {
                    const checked = selected.includes(row.original.id);
                    return (
                      <tr
                        key={row.id}
                        onClick={() => toggle(row.original.id)}
                        className={`cursor-pointer border-t border-slate-100 dark:border-slate-800 ${
                          checked
                            ? 'bg-blue-50 dark:bg-blue-950/40'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                        }`}
                      >
                        {row.getVisibleCells().map((cell) => (
                          <td key={cell.id} className="px-4 py-2">
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {shown.length === 0 && (
                <p className="muted py-8 text-center">No matching students.</p>
              )}
            </div>
          )}

          <p className="muted mt-2 text-xs">
            Showing {shown.length} of {studentRows.length} students
          </p>
        </div>
      </Card>
    </form>
  );
}