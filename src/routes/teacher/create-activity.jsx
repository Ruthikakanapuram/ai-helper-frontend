
import { useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useForm } from '@tanstack/react-form';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  createColumnHelper, flexRender, getCoreRowModel, useReactTable,
} from '@tanstack/react-table';
import { ArrowLeft, Check, Search, Users, Filter, Clock3, Upload, FileText, Image as ImageIcon, X } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../lib/api';
import { keys, queryClient } from '../../lib/query';
import { Card, ErrorState, Loading, Spinner } from '../../components/ui';
import {
  BRANCHES,
  YEARS,
  SECTIONS,
  DURATIONS,
  FILTER_ALL,
} from '../../lib/enum';
const helper = createColumnHelper();
// const DURATIONS = [5,10,15,20, 25, 30, 35, 40, 45, 50, 55, 60];
// const BRANCHES = ['CSE', 'AIML', 'DS'];
// const YEARS = [1, 2, 3, 4];
// const SECTIONS = ['A', 'B', 'C', 'D'];
const COLLEGES = ['KMIT', 'NGIT', 'KMEC', 'KMCE'];
const FILE_ACCEPT = '.pdf,.doc,.docx,.png,.jpg,.jpeg,.webp';
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set([
  'pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png', 'webp',
]);

function todayLocal() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function normalizeStudents(data) {
  const rows = Array.isArray(data) ? data : Array.isArray(data?.students) ? data.students : [];
  return rows.map((s) => ({
    ...s,
    id: Number(s.id),
    name: s.fullName ?? s.name ?? s.user?.fullName ?? '',
    username: String(s.username ?? s.user?.username ?? ''),
  })).filter((s) => Number.isSafeInteger(s.id) && s.id > 0);
}

function getValidationMessage(values, selectionCount) {
  if (!values.name?.trim()) return 'Please enter an activity title.';
  if (!values.scheduledDate) return 'Please select a scheduled date.';
  if (values.scheduledDate < todayLocal()) return 'Scheduled date cannot be in the past.';
  if (!DURATIONS.includes(Number(values.duration))) return 'Please choose a valid session duration.';
  if (selectionCount < 1) return 'Please select at least one student.';
  return null;
}
function validateAttachment(file) {
  if (!file) return 'Please select a file.';

  const extension =
    file.name.split('.').pop()?.toLowerCase() || '';

  if (!ALLOWED_EXTENSIONS.has(extension)) {
    return 'Only PDF, DOC, DOCX, JPG, PNG and WebP files are allowed.';
  }

  if (file.size === 0) {
    return 'The selected file is empty.';
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return 'The attachment must not exceed 20 MB.';
  }

  return null;
}
function readableFileSize(bytes) {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.ceil(bytes / 1024))} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
export function CreateActivity() {
  const navigate = useNavigate();
  const [branch, setBranch] = useState('');
  const [year, setYear] = useState('');
  const [section, setSection] = useState('');
  const [college, setCollege] = useState('');
  const [appliedFilters, setAppliedFilters] = useState(null);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState([]);
  const [attachment, setAttachment] = useState(null);
  const [filterRequestId, setFilterRequestId] = useState(0);

  const fileInputRef = useRef(null);

  function chooseAttachment(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const error = validateAttachment(file);
    if (error) {
      toast.error(error);
      event.target.value = '';
      return;
    }
    setAttachment(file);
  }

  function removeAttachment() {
    setAttachment(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }


  const filtersChanged = Boolean(appliedFilters) && (
    appliedFilters.branch !== branch ||
    appliedFilters.year !== year ||
    appliedFilters.section !== section ||
    appliedFilters.college !== college
  );
  const showStudents = Boolean(appliedFilters) && !filtersChanged;


  const students = useQuery({
    queryKey: [
      'create-activity-students',
      appliedFilters?.branch ?? '',
      appliedFilters?.year ?? '',
      appliedFilters?.section ?? '',
      appliedFilters?.college ?? '',
      filterRequestId,
    ],

    queryFn: () => {
      if (!appliedFilters) {
        return Promise.resolve({ students: [] });
      }

      const selectedBranch =
        appliedFilters.branch === 'ALL'
          ? ''
          : appliedFilters.branch;

      const selectedYear =
        appliedFilters.year === 'ALL'
          ? ''
          : appliedFilters.year;

      const selectedSection =
        appliedFilters.section === 'ALL'
          ? ''
          : appliedFilters.section;

      const selectedCollege =
        appliedFilters.college === 'ALL'
          ? ''
          : appliedFilters.college;

      return api.getStudentsByFilter(
        selectedBranch,
        selectedYear,
        selectedSection,
        selectedCollege,
      );
    },

    enabled: showStudents,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });


  const studentRows = useMemo(() => normalizeStudents(students.data), [students.data]);
  const shown = useMemo(() => {
    if (!showStudents) return [];
    const term = search.trim().toLowerCase();
    return term ? studentRows.filter((s) =>
      s.username.toLowerCase().includes(term) || s.name.toLowerCase().includes(term)
    ) : studentRows;
  }, [studentRows, search, showStudents]);

  const mutation = useMutation({
    mutationFn: (values) => {
      const data = new FormData();
      data.append('title', values.name.trim());
      data.append('description', values.description?.trim() || '');
      data.append('duration', String(values.duration));
      data.append('scheduledDate', values.scheduledDate);
      // The NestJS multipart DTO supports a comma-separated ID string.
      data.append('studentIds', values.studentIds.map(Number).join(','));
      if (attachment) data.append('file', attachment, attachment.name);
      return api.createActivity(data);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.activities });
      void queryClient.invalidateQueries({ queryKey: keys.stats });
      toast.success('Activity created successfully');
      void navigate({ to: '/teacher/activities' });
    },
    onError: (error) => toast.error(error?.message || 'Failed to create activity.'),
  });

  const form = useForm({
    defaultValues: {
      name: '', description: '', duration: 20,
      scheduledDate: todayLocal(), studentIds: [], status: 'DRAFT',
    },
    onSubmit: async ({ value }) => {
      const message = getValidationMessage(value, value.studentIds.length);
      if (message) { toast.error(message); return; }
      await mutation.mutateAsync({ ...value, status: value.status || 'DRAFT' });
    },
  });

  function select(ids) {
    const numericIds = [...new Set(ids.map(Number))].filter((id) => Number.isSafeInteger(id) && id > 0);
    setSelected(numericIds);
    form.setFieldValue('studentIds', numericIds);
  }

  function toggle(id) {
    const numericId = Number(id);
    select(selected.includes(numericId)
      ? selected.filter((v) => v !== numericId)
      : [...selected, numericId]);
  }

 function applyFilters() {
  if (!branch || !year || !section || !college) {
    toast.error(
      'Please select Branch, Year, Section, and College before clicking GO.'
    );
    return;
  }

  setSearch('');

  setAppliedFilters({
    branch,
    year,
    section,
    college,
  });

  // Make every GO click trigger a new request,
  // including when the filters haven't changed.
  setFilterRequestId((previous) => previous + 1);
}

  function cancel() {
    // Navigate to the previous browser page; fall back to Activities.
    if (window.history.length > 1) window.history.back();
    else void navigate({ to: '/teacher/activities' });
  }

  // Select All applies to the currently visible (search-filtered) students.
  // Students selected from another class remain selected.
  const visibleIds = useMemo(() => shown.map((student) => student.id), [shown]);
  const visibleSelectedCount = visibleIds.filter((id) => selected.includes(id)).length;
  const allVisibleSelected = visibleIds.length > 0 && visibleSelectedCount === visibleIds.length;
  const someVisibleSelected = visibleSelectedCount > 0 && !allVisibleSelected;

  function toggleSelectAll() {
    if (allVisibleSelected) {
      const visibleSet = new Set(visibleIds);
      select(selected.filter((id) => !visibleSet.has(id)));
    } else {
      select([...selected, ...visibleIds]);
    }
  }

  const columns = useMemo(() => [
    helper.display({
      id: 'check',
      header: () => (
        <label className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap">
          <input
            type="checkbox"
            aria-label="Select all visible students"
            checked={allVisibleSelected}
            disabled={visibleIds.length === 0}
            ref={(element) => {
              if (element) element.indeterminate = someVisibleSelected;
            }}
            onChange={toggleSelectAll}
            className="h-4 w-4 cursor-pointer accent-blue-600"
          />
          <span>Select All</span>
        </label>
      ),
      cell: (info) => (
        <input
          type="checkbox"
          aria-label={`Select ${info.row.original.username || info.row.original.name}`}
          checked={selected.includes(info.row.original.id)}
          onClick={(event) => event.stopPropagation()}
          onChange={() => toggle(info.row.original.id)}
        />
      ),
    }),
    helper.accessor('username', {
      header: 'Username',
      cell: (info) => <span className="font-semibold">{info.getValue() || '—'}</span>,
    }),
    helper.accessor('name', {
      header: 'Name',
      cell: (info) => info.getValue() || '—',
    }),
  ], [selected, visibleIds, allVisibleSelected, someVisibleSelected]);

  const table = useReactTable({ data: shown, columns, getCoreRowModel: getCoreRowModel() });

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        const values = form.state.values;
        const message = getValidationMessage(values, selected.length);
        if (message) { toast.error(message); return; }
        void form.handleSubmit();
      }}
      className="flex min-w-0 flex-col gap-4 pb-4 lg:min-h-[calc(100dvh-7rem)]"
    >
      <div className="flex flex-col gap-1">
        <Link to="/teacher/activities" className="muted inline-flex w-fit items-center gap-1.5 hover:text-blue-600">
          <ArrowLeft size={15} /> Back to activities
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">New Activity</h1>
        <p className="muted text-sm">Enter activity details, filter students, and enroll at least one student.</p>
      </div>

      <Card className="min-w-0 p-4 sm:p-5 lg:p-6">
        {/* Title gets two-thirds of the desktop row. */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(175px,1fr)_minmax(170px,1fr)]">
          <form.Field name="name">
            {(field) => (
              <div className="min-w-0">
                <label htmlFor="activity-title" className="field-label">Activity Title <span className="text-rose-500">*</span></label>
                <input id="activity-title" className="input w-full" placeholder="e.g. Digital Safety and Responsible Internet Use Workshop"
                  value={field.state.value} onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                />
              </div>
            )}
          </form.Field>

          <form.Field name="scheduledDate">
            {(field) => (
              <div className="min-w-0">
                <label htmlFor="activity-date" className="field-label">Scheduled Date <span className="text-rose-500">*</span></label>
                <input id="activity-date" type="date" min={todayLocal()} className="input w-full"
                  value={field.state.value} onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                />
              </div>
            )}
          </form.Field>

          <form.Field name="duration">
            {(field) => (
              <div className="min-w-0">
                <label htmlFor="activity-duration" className="field-label">Session Duration (in minutes) <span className="text-rose-500">*</span></label>
                <div className="relative">
                  <Clock3 size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <select id="activity-duration" className="input w-full !pl-9"
                    value={field.state.value} onChange={(event) => field.handleChange(Number(event.target.value))}>
                    {DURATIONS.map((minutes) => (
                      <option key={minutes} value={minutes}>
                        {minutes} {minutes === 20 ? ' (Default)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </form.Field>
        </div>

        {/* Description and optional single attachment sit side-by-side on desktop. */}
        <div className="mt-4 grid min-w-0 grid-cols-1 items-stretch gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(260px,1fr)]">
          <form.Field name="description">
            {(field) => (
              <div className="flex min-w-0 flex-col">
                <label htmlFor="activity-description" className="field-label">
                  Description <span className="muted text-xs">(optional)</span>
                </label>
                <textarea
                  id="activity-description"
                  rows={4}
                  className="input min-h-[136px] w-full flex-1 resize-y"
                  placeholder="Describe the topic, learning objectives, and what students should learn."
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                />
              </div>
            )}
          </form.Field>

          <div className="flex min-w-0 flex-col">
            <label htmlFor="activity-file" className="field-label">
              Reference File <span className="muted text-xs">(optional · one file)</span>
            </label>
            <input
              ref={fileInputRef}
              id="activity-file"
              type="file"
              accept={FILE_ACCEPT}
              className="sr-only"
              onChange={chooseAttachment}
              disabled={mutation.isPending}
            />
            {attachment ? (
              <div className="flex min-h-[136px] min-w-0 flex-1 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/40">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-white text-blue-600 shadow-sm dark:bg-slate-900">
                  {attachment.type.startsWith('image/') ? <ImageIcon size={21} /> : <FileText size={21} />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold" title={attachment.name}>{attachment.name}</p>
                  <p className="mt-1 text-xs text-slate-500">{readableFileSize(attachment.size)} · Ready to upload</p>
                  <button
                    type="button"
                    className="mt-2 text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={mutation.isPending}
                  >
                    Replace file
                  </button>
                </div>
                <button
                  type="button"
                  aria-label="Remove attached file"
                  title="Remove file"
                  onClick={removeAttachment}
                  disabled={mutation.isPending}
                  className="rounded-lg p-2 text-slate-500 hover:bg-slate-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 disabled:opacity-50 dark:hover:bg-slate-700"
                >
                  <X size={18} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={mutation.isPending}
                className="flex min-h-[136px] w-full flex-1 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/60 p-4 text-center transition hover:border-blue-400 hover:bg-blue-50/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800/30 dark:hover:border-blue-600"
              >
                <Upload size={23} className="text-blue-600 dark:text-blue-400" />
                <span className="text-sm font-semibold">Upload a reference file</span>
                <span className="text-xs text-slate-500">PDF, DOC, DOCX, JPG, PNG or WebP · Max 20 MB</span>
              </button>
            )}
          </div>
        </div>
      </Card>

      <Card className="min-w-0 p-4 sm:p-5 lg:flex-1 lg:p-6">
        <div className="mb-4">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-lg font-bold">Enroll students <span className="text-rose-500">*</span></h2>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-3 py-1.5 text-sm font-semibold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
              <Users size={15} /> {selected.length} selected
            </span>
          </div>
          <p className="muted mt-1 text-xs">Choose Branch, Year, Section, and College, then click GO to load students.</p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_auto] lg:items-end">
          <div>
            <label htmlFor="filter-branch" className="field-label">Branch</label>
            <select id="filter-branch" className="input w-full" value={branch} onChange={(event) => setBranch(event.target.value)}>
              <option value="">Select branch</option>
              <option value="ALL">All branches</option>
              {BRANCHES.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="filter-year" className="field-label">Year</label>
            <select id="filter-year" className="input w-full" value={year} onChange={(event) => setYear(event.target.value)}>
              <option value="">Select year</option>
              <option value="ALL">All years</option>
              {YEARS.map((value) => <option key={value} value={value}>Year {value}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="filter-section" className="field-label">Section</label>
            <select id="filter-section" className="input w-full" value={section} onChange={(event) => setSection(event.target.value)}>
              <option value="">Select section</option>
              <option value="ALL">All sections</option>
              {SECTIONS.map((value) => <option key={value} value={value}>Section {value}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="filter-college" className="field-label">College</label>
            <select id="filter-college" className="input w-full" value={college} onChange={(event) => setCollege(event.target.value)}>
              <option value="">Select college</option>
              {COLLEGES.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </div>
          <button type="button" onClick={applyFilters} disabled={!branch || !year || !section || !college}
            className="btn-primary flex w-full items-center justify-center gap-2 sm:col-span-2 lg:col-span-1 lg:w-24">
            <Filter size={16} /> GO
          </button>
        </div>

        {!showStudents ? (
          <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center dark:border-slate-700 dark:bg-slate-800/40">
            <Users size={28} className="mx-auto mb-2 text-slate-400" />
            <p className="font-medium">{filtersChanged ? 'Filters changed — click GO to load students' : 'Select your class to view students'}</p>
            <p className="muted mt-1 text-sm">Use All to include students across branches, years or sections, then click GO.</p>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <div className="relative w-full sm:max-w-sm">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input aria-label="Search students" className="input w-full !pl-9" placeholder="Search username or name"
                value={search} onChange={(event) => setSearch(event.target.value)} />
            </div>

            {students.isPending ? <Loading rows={5} /> : students.isError ? (
              <ErrorState error={students.error} retry={() => void students.refetch()} />
            ) : (
              <div className="max-h-[45vh] min-h-[180px] overflow-auto rounded-xl border border-slate-200 dark:border-slate-700 lg:max-h-[420px]">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-800">
                    {table.getHeaderGroups().map((group) => (
                      <tr key={group.id}>
                        {group.headers.map((header) => (
                          <th key={header.id} className="px-4 py-3">{flexRender(header.column.columnDef.header, header.getContext())}</th>
                        ))}
                      </tr>
                    ))}
                  </thead>
                  <tbody>
                    {table.getRowModel().rows.map((row) => {
                      const checked = selected.includes(row.original.id);
                      return (
                        <tr key={row.id} onClick={() => toggle(row.original.id)}
                          className={`cursor-pointer border-t border-slate-100 dark:border-slate-800 ${checked ? 'bg-blue-50 dark:bg-blue-950/40' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}>
                          {row.getVisibleCells().map((cell) => (
                            <td key={cell.id} className="px-4 py-2.5">{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {shown.length === 0 && <p className="muted py-8 text-center">No students found for this filter.</p>}
              </div>
            )}
            <p className="muted text-xs">Showing {shown.length} of {studentRows.length} students</p>
          </div>
        )}
      </Card>

      <form.Subscribe selector={(state) => state.values}>
        {(values) => {
          const valid = !getValidationMessage(values, selected.length);
          return (
            <div className="sticky bottom-0 z-20 flex flex-wrap justify-end gap-3 border-t border-slate-200 bg-white/95 px-3 py-4 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95 sm:px-0">
              <button type="button" className="btn-outline min-w-[110px] px-5" onClick={cancel} disabled={mutation.isPending}>
                Cancel
              </button>
              <div className="flex items-center overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
                <button type="submit" disabled={!valid || mutation.isPending}
                  className="btn-primary inline-flex min-w-[150px] items-center justify-center gap-2 rounded-r-none border-r border-blue-500/70 px-5 disabled:cursor-not-allowed disabled:opacity-50"
                  title={!valid ? getValidationMessage(values, selected.length) : 'Save activity'}>
                  {mutation.isPending ? <Spinner /> : <Check size={17} />}
                  {mutation.isPending ? 'Saving...' : 'Save Activity'}
                </button>
                <select
                  aria-label="Save activity action"
                  value={values.status || 'DRAFT'}
                  onChange={(event) => form.setFieldValue('status', event.target.value)}
                  className="h-[42px] min-w-[150px] border-0 bg-transparent px-3 text-sm font-medium text-slate-700 outline-none transition hover:bg-slate-50 focus:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800 dark:focus:bg-slate-800"
                >
                  <option value="DRAFT">Save as Draft</option>
                  <option value="PUBLISHED">Save & Publish</option>
                </select>
              </div>
            </div>
          );
        }}
      </form.Subscribe>
    </form>
  );
}
