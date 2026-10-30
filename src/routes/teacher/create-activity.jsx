
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
import { ArrowLeft, Check, Search, Users, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

import { api } from '../../lib/api';
import { activitySchema } from '../../lib/schemas';
import { keys, queryClient } from '../../lib/query';
import { Button, Card, Spinner } from '../../components/ui';

const helper = createColumnHelper();

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

function FieldErrors({ errors = [] }) {
  return errors.map((error, index) => (
    <p key={index} className="mt-1 text-xs text-rose-600">
      {String(error?.message ?? error)}
    </p>
  ));
}

/* Friendly student-list states */
function StudentListState({ type, onRetry }) {
  if (type === 'loading') {
    return (
      <div className="flex min-h-[250px] flex-col items-center justify-center gap-3">
        <Spinner />
        <p className="text-sm text-slate-500">Loading students...</p>
      </div>
    );
  }

  if (type === 'error') {
    return (
      <div className="flex min-h-[250px] flex-col items-center justify-center gap-3 px-4 text-center">
        <AlertCircle size={32} className="text-rose-500" />

        <div>
          <p className="font-semibold text-slate-800 dark:text-slate-100">
            Unable to load students
          </p>
          <p className="mt-1 max-w-md text-sm text-slate-500">
            We couldn't retrieve the student list. Please check your connection
            and try again.
          </p>
        </div>

        <Button type="button" variant="outline" onClick={onRetry}>
          Try again
        </Button>
      </div>
    );
  }

  return (
    <div className="flex min-h-[250px] flex-col items-center justify-center gap-3 px-4 text-center">
      <Users size={32} className="text-slate-400" />

      <div>
        <p className="font-semibold text-slate-800 dark:text-slate-100">
          No students found
        </p>
        <p className="mt-1 text-sm text-slate-500">
          No students match the selected filters or search.
        </p>
      </div>
    </div>
  );
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

  const studentRows = useMemo(
    () => normalizeStudents(students.data),
    [students.data],
  );

  const shown = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) return studentRows;

    return studentRows.filter(
      (student) =>
        student.rollNumber.toLowerCase().includes(term) ||
        student.name.toLowerCase().includes(term),
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

    onError: (error) => {
      toast.error(error.message || 'Failed to create activity');
    },
  });

  const form = useForm({
    defaultValues: {
      name: '',
      description: '',
      duration: 30,
      scheduledDate: '',
      studentIds: [],
    },

    validators: {
      onSubmit: activitySchema,
    },

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
        ? selected.filter((value) => value !== numericId)
        : [...selected, numericId],
    );
  }

  const filteredIds = shown.map((student) => student.id);

  const allChecked =
    filteredIds.length > 0 &&
    filteredIds.every((id) => selected.includes(id));

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
            onClick={(event) => event.stopPropagation()}
            onChange={() => toggle(student.id)}
          />
        );
      },
    }),

    helper.accessor('rollNumber', {
      header: 'Roll number',
      cell: (info) => (
        <span className="font-semibold">{info.getValue()}</span>
      ),
    }),

    helper.accessor('name', {
      header: 'Student',
      cell: (info) => info.getValue() || '—',
    }),

    helper.accessor('branch', { header: 'Branch' }),
    helper.accessor('year', { header: 'Year' }),
    helper.accessor('section', { header: 'Section' }),
  ];

  const table = useReactTable({
    data: shown,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void form.handleSubmit();
      }}
      className="flex flex-col gap-4 lg:h-[calc(100vh-5rem)]"
    >
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <Link
            to="/teacher/activities"
            className="muted mb-1 inline-flex items-center gap-1.5 hover:text-blue-600"
          >
            <ArrowLeft size={14} />
            Back to activities
          </Link>

          <h1 className="text-2xl font-bold tracking-tight">
            Create an activity
          </h1>
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

      {/* Main card */}
      <Card className="flex min-h-0 flex-1 flex-col p-5">
        {/* Activity details */}
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_200px_auto]">
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
                  onChange={(event) =>
                    field.handleChange(event.target.value)
                  }
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
                  onChange={(event) =>
                    field.handleChange(event.target.value)
                  }
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
                  className="flex gap-2"
                  role="group"
                  aria-label="Session duration"
                >
                  {[20, 30, 45].map((minutes) => (
                    <button
                      key={minutes}
                      type="button"
                      aria-pressed={field.state.value === minutes}
                      onClick={() => field.handleChange(minutes)}
                      className={`rounded-xl border px-4 py-2.5 text-sm font-bold transition-colors ${
                        field.state.value === minutes
                          ? 'border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                          : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800'
                      }`}
                    >
                      {minutes} min
                    </button>
                  ))}
                </div>

                <FieldErrors errors={field.state.meta.errors} />
              </div>
            )}
          </form.Field>
        </div>

        {/* Description */}
        <form.Field name="description">
          {(field) => (
            <div className="mt-4">
              <label htmlFor="description" className="field-label">
                Description
              </label>

              <textarea
                id="description"
                rows={2}
                className="input resize-none"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(event) =>
                  field.handleChange(event.target.value)
                }
                placeholder="Describe the topic, learning objectives, and what students should learn."
              />

              <FieldErrors errors={field.state.meta.errors} />
            </div>
          )}
        </form.Field>

        <hr className="my-5 border-slate-200 dark:border-slate-800" />

        {/* Student assignment */}
        <div className="flex min-h-[300px] flex-1 flex-col">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold">Assign students</h2>
              <p className="muted">
                Selection persists when you change filters.
              </p>
            </div>

            <span className="rounded-full bg-blue-100 px-3 py-1.5 text-sm font-bold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
              <Users size={15} className="mr-1 inline" />
              {selected.length} selected
            </span>
          </div>

          {/* Filters */}
          <div className="mb-3 grid gap-3 sm:grid-cols-3">
            <div>
              <label htmlFor="branch" className="field-label">
                Branch
              </label>

              <select
                id="branch"
                className="input"
                value={branch}
                onChange={(event) => {
                  setBranch(event.target.value);
                  setYear('');
                  setSection('');
                }}
              >
                <option value="">All branches</option>
                {['CSE', 'AIML', 'DS'].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="year" className="field-label">
                Year
              </label>

              <select
                id="year"
                className="input"
                value={year}
                onChange={(event) => {
                  setYear(event.target.value);
                  setSection('');
                }}
                disabled={!branch}
              >
                <option value="">All years</option>
                {[1, 2, 3, 4].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="section" className="field-label">
                Section
              </label>

              <select
                id="section"
                className="input"
                value={section}
                onChange={(event) => setSection(event.target.value)}
                disabled={!year}
              >
                <option value="">All sections</option>
                {['A', 'B', 'C', 'D'].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Search and selection controls */}
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="relative w-full sm:w-72">
              <Search
                className="absolute left-3 top-3 text-slate-400"
                size={16}
              />

              <input
                className="input pl-9"
                aria-label="Search students"
                value={search}
                placeholder="Search roll number or name"
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  select([...new Set([...selected, ...filteredIds])])
                }
              >
                Select visible
              </Button>

              <Button
                type="button"
                variant="ghost"
                onClick={() => select([])}
              >
                Clear all
              </Button>
            </div>
          </div>

          {/* Student list */}
          <div className="min-h-[250px] flex-1">
            {students.isPending ? (
              <StudentListState type="loading" />
            ) : students.isError ? (
              <StudentListState
                type="error"
                onRetry={() => void students.refetch()}
              />
            ) : shown.length === 0 ? (
              <StudentListState type="empty" />
            ) : (
              <div className="h-[350px] min-h-[250px] overflow-auto rounded-xl border border-slate-200 dark:border-slate-700 lg:h-full">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-800">
                    {table.getHeaderGroups().map((group) => (
                      <tr key={group.id}>
                        {group.headers.map((header) => (
                          <th key={header.id} className="px-4 py-3">
                            {flexRender(
                              header.column.columnDef.header,
                              header.getContext(),
                            )}
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
                            <td key={cell.id} className="px-4 py-2.5">
                              {flexRender(
                                cell.column.columnDef.cell,
                                cell.getContext(),
                              )}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="muted text-xs">
              Showing {shown.length} of {studentRows.length} students
            </p>

            <form.Field name="studentIds">
              {(field) =>
                field.state.meta.errors.length > 0 ? (
                  <p className="text-sm text-rose-600">
                    {field.state.meta.errors
                      .map((error) => String(error?.message ?? error))
                      .join(', ')}
                  </p>
                ) : null
              }
            </form.Field>
          </div>
        </div>
      </Card>
    </form>
  );
}
