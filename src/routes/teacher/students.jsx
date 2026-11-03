
import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { createColumnHelper, flexRender, getCoreRowModel, getPaginationRowModel, getSortedRowModel, useReactTable } from '@tanstack/react-table';
import { toast } from 'sonner';
import { Upload, Download, Search, ArrowUpDown, ArrowUp, ArrowDown, Plus, X, ArrowLeft } from 'lucide-react';
import { api } from '../../lib/api';
import { Card, Button, Loading, Empty, ErrorState, SectionHeading } from '../../components/ui';
import { BRANCHES, YEARS, SECTIONS, emptyStudent, validateStudent, cleanStudent, parseCsv, csvTemplate } from '../../features/students/config';
const studentCols = createColumnHelper();
const cacheKey = ['teacher', 'students-list'];
const fieldClass = 'input w-full';
const labels = {username:'Username',fullName:'Full name',rollNumber:'Roll number (optional)',year:'Year',branch:'Branch',section:'Section'};
function StudentFields({ value, onChange, errors={} }) {
  return <div className="grid gap-4 sm:grid-cols-2">
    {Object.keys(labels).map(key=><label className="block" key={key}><span className="field-label">{labels[key]}</span>
      {['year','branch','section'].includes(key)?<select className={fieldClass} value={value[key]} onChange={e=>onChange({...value,[key]:e.target.value})}>
        <option value="">Select {key}</option>{(key==='year'?YEARS:key==='branch'?BRANCHES:SECTIONS).map(v=><option key={v} value={v}>{v}</option>)}
      </select>:<input className={fieldClass} maxLength={key==='fullName'?150:key==='rollNumber'?50:100} value={value[key]} onChange={e=>onChange({...value,[key]:e.target.value})} autoComplete="off"/>}
      {errors[key]&&<span className="mt-1 block text-xs text-red-600">{errors[key]}</span>}
    </label>)}
  </div>;
}
function exportCredentials(students) {
  const fields=['username','fullName','rollNumber','year','branch','section','temporaryPassword'];
  const escaped = v=>'"'+String(v??'').replaceAll('"','""')+'"';
  const text=[fields.join(','),...students.map(s=>fields.map(k=>escaped(s[k])).join(','))].join('\r\n');
  const url=URL.createObjectURL(new Blob([text],{type:'text/csv;charset=utf-8'}));
  const a=document.createElement('a');a.href=url;a.download='new-student-credentials.csv';a.click();URL.revokeObjectURL(url);
}
export function Result({result,onDismiss}) {
  if(!result)return null;
  return <Card className="my-5 border border-amber-400 p-5"><div className="flex items-start justify-between gap-3"><div><h3 className="font-bold">{result.count} students created</h3><p className="text-sm text-amber-700 dark:text-amber-300">Temporary passwords are returned once. Download now and store securely. Do not share this CSV publicly.</p></div><Button variant="ghost" onClick={onDismiss}>Dismiss</Button></div>
    <Button className="mt-3" onClick={()=>exportCredentials(result.students)}><Download size={16}/> Download credentials CSV</Button>
  </Card>;
}
function AddOne({onCreated, onCancel}) {
 const [value,setValue]=useState(emptyStudent);const [errors,setErrors]=useState({});
 const mutation=useMutation({mutationFn:students=>api.createStudentsBulk(students),onSuccess:r=>{toast.success(`${r.count} student created`);setValue(emptyStudent());setErrors({});onCreated(r);},onError:e=>toast.error(e.message)});
 const submit=e=>{e.preventDefault();const next=validateStudent(value);setErrors(next);if(Object.keys(next).length)return;mutation.mutate([cleanStudent(value)]);};
 return <form onSubmit={submit} className="space-y-5"><StudentFields value={value} onChange={setValue} errors={errors}/><div className="flex flex-wrap justify-end gap-3 border-t border-slate-200 pt-4 dark:border-slate-700"><Button type="button" variant="outline" disabled={mutation.isPending} onClick={onCancel}>Cancel</Button><Button type="submit" disabled={mutation.isPending}>{mutation.isPending?'Creating...':'Create Student'}</Button></div></form>;
}
export function AddBulk({onCreated}) {
 const [rows,setRows]=useState([]);const [error,setError]=useState('');
 const mutation=useMutation({mutationFn:students=>api.createStudentsBulk(students),onSuccess:r=>{toast.success(`${r.count} students created`);setRows([]);setError('');onCreated(r);},onError:e=>setError(e.message)});
 async function readFile(e){const file=e.target.files?.[0];if(!file)return;try{if(file.size>2_000_000)throw new Error('CSV must be under 2MB');const parsed=parseCsv(await file.text());setRows(parsed);setError('');}catch(err){setRows([]);setError(err.message);}e.target.value='';}
 const duplicateNames=useMemo(()=>{const seen=new Set();return rows.filter(r=>{const key=r.username.trim().toLowerCase();if(seen.has(key))return true;seen.add(key);return false;}).map(r=>r.username)},[rows]);
 const invalid=rows.map((r,index)=>({index:index+2,errors:validateStudent(r)})).filter(x=>Object.keys(x.errors).length);
 function submit(){if(invalid.length||duplicateNames.length||!rows.length)return;mutation.mutate(rows.map(cleanStudent));}
 function downloadTemplate(){const url=URL.createObjectURL(new Blob([csvTemplate()],{type:'text/csv'}));const a=document.createElement('a');a.href=url;a.download='student-import-template.csv';a.click();URL.revokeObjectURL(url);}
 return <Card className="p-6"><h2 className="mb-2 text-lg font-bold">Bulk Student Add</h2><p className="muted mb-4 text-sm">CSV headers: username, fullName, rollNumber, year, branch, section. Maximum 500 per upload. Creation is transactional.</p>
 <div className="flex flex-wrap gap-3"><Button type="button" variant="outline" onClick={downloadTemplate}><Download size={16}/> CSV template</Button><label className="btn-outline inline-flex cursor-pointer items-center gap-2"><Upload size={16}/> Select CSV<input type="file" accept=".csv,text/csv" onChange={readFile} className="sr-only"/></label></div>
 {rows.length>0&&<div className="mt-4"><p className="font-semibold">{rows.length} students ready for validation</p><div className="mt-2 max-h-60 overflow-auto rounded-lg border"><table className="w-full text-left text-xs"><thead><tr>{['Username','Full name','Roll','Year','Branch','Section'].map(x=><th className="p-2" key={x}>{x}</th>)}</tr></thead><tbody>{rows.slice(0,100).map((r,i)=><tr className="border-t" key={i}>{['username','fullName','rollNumber','year','branch','section'].map(k=><td className="p-2" key={k}>{r[k]}</td>)}</tr>)}</tbody></table></div>{rows.length>100&&<p className="muted text-xs">Showing first 100 rows</p>}</div>}
 {duplicateNames.length>0&&<p role="alert" className="mt-3 text-sm text-red-600">Duplicate usernames: {duplicateNames.join(', ')}</p>}
 {invalid.length>0&&<p role="alert" className="mt-3 text-sm text-red-600">Invalid rows: {invalid.slice(0,10).map(x=>`${x.index} (${Object.keys(x.errors).join(', ')})`).join('; ')}{invalid.length>10?' ...':''}</p>}
 {error&&<p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
 <Button type="button" className="mt-4" disabled={!rows.length||invalid.length>0||duplicateNames.length>0||mutation.isPending} onClick={submit}>{mutation.isPending?'Importing...':`Import ${rows.length} students`}</Button>
 </Card>;
}


function StudentsList() {
  const [branch, setBranch] = useState('');
  const [year, setYear] = useState('');
  const [section, setSection] = useState('');

  // Applied only after clicking GO.
  const [applied, setApplied] = useState(null);

  // Live search after students are loaded.
  const [searchText, setSearchText] = useState('');

  const [sorting, setSorting] = useState([
    { id: 'username', desc: false },
  ]);

  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 10,
  });

  const q = useQuery({
    queryKey: cacheKey,
    queryFn: api.getStudentsList,
  });

  const students = useMemo(() => {
    const data = Array.isArray(q.data)
      ? q.data
      : Array.isArray(q.data?.students)
        ? q.data.students
        : [];

    return data.map((student) => ({
      ...student,
      username:
        student.username ??
        student.user?.username ??
        '',
      fullName:
        student.fullName ??
        student.name ??
        student.user?.fullName ??
        student.user?.name ??
        '',
    }));
  }, [q.data]);

  // All three dropdowns are mandatory before GO.
  const filtersComplete = Boolean(
    branch && year && section
  );

  // Hide the old student list when dropdowns change.
  const filtersChanged = Boolean(applied) && (
    applied.branch !== branch ||
    applied.year !== year ||
    applied.section !== section
  );

  const showStudents = Boolean(applied) && !filtersChanged;

  function handleGo() {
    if (!filtersComplete) {
      toast.error(
        'Please select Branch, Year, and Section.'
      );
      return;
    }

    setApplied({ branch, year, section });
    setSearchText('');

    setPagination((previous) => ({
      ...previous,
      pageIndex: 0,
    }));
  }

  // Class filtering followed by instant text search.
  const filtered = useMemo(() => {
    if (!showStudents) {
      return [];
    }

    const term = searchText.trim().toLowerCase();

    return students.filter((student) => {
      const matchesClass =
        String(student.branch ?? '').toLowerCase() ===
          String(applied.branch).toLowerCase() &&
        String(student.year ?? '') ===
          String(applied.year) &&
        String(student.section ?? '').toLowerCase() ===
          String(applied.section).toLowerCase();

      if (!matchesClass) {
        return false;
      }

      if (!term) {
        return true;
      }

      return [
        student.username,
        student.fullName,
      ].some((value) =>
        String(value ?? '')
          .toLowerCase()
          .includes(term)
      );
    });
  }, [students, applied, searchText, showStudents]);

  const columns = useMemo(() => [
    studentCols.accessor('username', {
      header: 'Username',
      sortingFn: 'alphanumeric',

      cell: (info) => (
        <span className="font-semibold text-slate-900 dark:text-slate-100">
          {info.getValue() || '—'}
        </span>
      ),
    }),

    studentCols.accessor('fullName', {
      header: 'Name',
      sortingFn: 'alphanumeric',

      cell: (info) => (
        <span className="text-slate-700 dark:text-slate-300">
          {info.getValue() || '—'}
        </span>
      ),
    }),
  ], []);

  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting, pagination },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  function handleLiveSearch(value) {
    setSearchText(value);

    // A new search always begins from page 1.
    setPagination((previous) => ({
      ...previous,
      pageIndex: 0,
    }));
  }

  return (
    <Card className="min-w-0 overflow-hidden p-4 sm:p-5">

      {/* Section heading */}
      <div className="mb-5">
        <h2 className="text-lg font-bold">
          Student Directory
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          Select Branch, Year, and Section,
          then click GO to view students.
        </p>
      </div>

      {/* Dropdown filters and GO button */}
      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto] lg:items-end">

        <label className="block min-w-0">
          <span className="field-label">
            Branch
          </span>

          <select
            className="input w-full"
            value={branch}
            onChange={(event) =>
              setBranch(event.target.value)
            }
          >
            <option value="">
              Select Branch
            </option>

            {BRANCHES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>

        <label className="block min-w-0">
          <span className="field-label">
            Year
          </span>

          <select
            className="input w-full"
            value={year}
            onChange={(event) =>
              setYear(event.target.value)
            }
          >
            <option value="">
              Select Year
            </option>

            {YEARS.map((value) => (
              <option key={value} value={value}>
                Year {value}
              </option>
            ))}
          </select>
        </label>

        <label className="block min-w-0">
          <span className="field-label">
            Section
          </span>

          <select
            className="input w-full"
            value={section}
            onChange={(event) =>
              setSection(event.target.value)
            }
          >
            <option value="">
              Select Section
            </option>

            {SECTIONS.map((value) => (
              <option key={value} value={value}>
                Section {value}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          disabled={!filtersComplete || q.isPending}
          onClick={handleGo}
          className="btn-primary inline-flex min-h-10 w-full items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-50 sm:col-span-2 lg:col-span-1 lg:w-24"
        >
          GO
        </button>
      </div>

      {/* Initial state: no class selected */}
      {!showStudents ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center dark:border-slate-700 dark:bg-slate-800/40">
          <Search
            size={28}
            className="mx-auto mb-3 text-slate-400"
          />

          <p className="font-semibold">
            {filtersChanged
              ? 'Class selection changed'
              : 'Select a class to view students'}
          </p>

          <p className="mt-2 text-sm text-slate-500">
            {filtersChanged
              ? 'Click GO to load students for the selected class.'
              : 'Choose Branch, Year, and Section, then click GO.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">

          {/* Search placed inside the student table section */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                Students
              </h3>

              <p className="mt-1 text-xs text-slate-500">
                {applied.branch} / Year {applied.year} /
                Section {applied.section}
              </p>
            </div>

            <div className="relative w-full sm:max-w-xs">
              <Search
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                type="search"
                aria-label="Search students by username or name"
                value={searchText}
                onChange={(event) =>
                  handleLiveSearch(event.target.value)
                }
                placeholder="Search username or name..."
                className="input w-full !pl-10"
              />
            </div>
          </div>

          {q.isPending ? (
            <Loading />
          ) : q.isError ? (
            <ErrorState
              error={q.error}
              retry={() => void q.refetch()}
            />
          ) : filtered.length === 0 ? (
            <div className="rounded-xl border border-slate-200 py-8 dark:border-slate-700">
              <Empty
                title="No matching students"
                description={
                  searchText.trim()
                    ? 'No students match your search.'
                    : 'No students found for the selected class.'
                }
              />
            </div>
          ) : (
            <>
              {/* Sortable student table */}
              <div className="w-full overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                <table className="w-full table-fixed text-left text-sm">
                  <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    {table.getHeaderGroups().map(
                      (group) => (
                        <tr key={group.id}>
                          {group.headers.map((header) => {
                            const sorted =
                              header.column.getIsSorted();

                            const SortIcon =
                              sorted === 'asc'
                                ? ArrowUp
                                : sorted === 'desc'
                                  ? ArrowDown
                                  : ArrowUpDown;

                            return (
                              <th
                                key={header.id}
                                scope="col"
                                aria-sort={
                                  sorted === 'asc'
                                    ? 'ascending'
                                    : sorted === 'desc'
                                      ? 'descending'
                                      : 'none'
                                }
                                className="px-3 py-3 sm:px-5"
                              >
                                <button
                                  type="button"
                                  onClick={
                                    header.column.getToggleSortingHandler()
                                  }
                                  className="inline-flex items-center gap-2 rounded text-left font-semibold hover:text-blue-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
                                >
                                  {flexRender(
                                    header.column.columnDef.header,
                                    header.getContext()
                                  )}

                                  <SortIcon
                                    size={14}
                                    className={
                                      sorted
                                        ? 'text-blue-600'
                                        : 'text-slate-400'
                                    }
                                  />
                                </button>
                              </th>
                            );
                          })}
                        </tr>
                      )
                    )}
                  </thead>

                  <tbody>
                    {table.getRowModel().rows.map(
                      (row, index) => (
                        <tr
                          key={row.id}
                          className={`border-t border-slate-200 transition-colors hover:bg-blue-50/70 dark:border-slate-800 dark:hover:bg-slate-800 ${
                            index % 2
                              ? 'bg-slate-50/70 dark:bg-slate-800/40'
                              : 'bg-white dark:bg-slate-900'
                          }`}
                        >
                          {row.getVisibleCells().map(
                            (cell) => (
                              <td
                                key={cell.id}
                                className="break-words px-3 py-3 sm:px-5"
                              >
                                {flexRender(
                                  cell.column.columnDef.cell,
                                  cell.getContext()
                                )}
                              </td>
                            )
                          )}
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination stays inside Student Directory */}
              <div className="flex flex-col gap-3 border-t border-slate-200 pt-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-slate-500">
                  Showing{' '}
                  {pagination.pageIndex * pagination.pageSize + 1}
                  –
                  {Math.min(
                    (pagination.pageIndex + 1) *
                      pagination.pageSize,
                    filtered.length
                  )}{' '}
                  of {filtered.length} students
                </p>

                <div className="flex flex-wrap items-center gap-2">
                  <label
                    htmlFor="students-page-size"
                    className="text-xs text-slate-500"
                  >
                    Rows per page
                  </label>

                  <select
                    id="students-page-size"
                    className="input !w-20 !py-2"
                    value={pagination.pageSize}
                    onChange={(event) =>
                      setPagination({
                        pageIndex: 0,
                        pageSize: Number(event.target.value),
                      })
                    }
                  >
                    {[10, 20, 30, 40, 50].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>

                  <Button
                    type="button"
                    variant="outline"
                    disabled={!table.getCanPreviousPage()}
                    onClick={() =>
                      table.previousPage()
                    }
                  >
                    Previous
                  </Button>

                  <span className="whitespace-nowrap text-xs text-slate-600 dark:text-slate-300">
                    {pagination.pageIndex + 1} /{' '}
                    {table.getPageCount()}
                  </span>

                  <Button
                    type="button"
                    variant="outline"
                    disabled={!table.getCanNextPage()}
                    onClick={() =>
                      table.nextPage()
                    }
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </Card>
  );
}


function AddStudentModal({ open, onClose, onCreated }) {
  const dialogRef = useRef(null);
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    const previousFocus = document.activeElement;
    dialogRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previousFocus?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 sm:p-5"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="add-student-title"
        className="max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-4 shadow-2xl outline-none dark:bg-slate-900 sm:p-6">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div><h2 id="add-student-title" className="text-xl font-bold">Add Student</h2>
            <p className="mt-1 text-sm text-slate-500">Enter details to create one student account.</p></div>
          <button type="button" aria-label="Close Add Student dialog" onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 dark:hover:bg-slate-800"><X size={20}/></button>
        </div>
        <AddOne onCreated={onCreated} onCancel={onClose}/>
      </div>
    </div>
  );
}

export function TeacherStudents() {
  const [showAddModal, setShowAddModal] = useState(false);
  const [result, setResult] = useState(null);
  const qc = useQueryClient();
  function created(createdResult) {
    setResult(createdResult);
    setShowAddModal(false);
    void qc.invalidateQueries({ queryKey: cacheKey });
  }
  return (
    <div className="min-w-0 space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div><h1 className="text-2xl font-bold tracking-tight">Students</h1>
          <p className="mt-1 text-sm text-slate-500">Search, sort, and manage student accounts.</p></div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <button type="button" onClick={() => setShowAddModal(true)}
            className="btn-primary inline-flex items-center justify-center gap-2"><Plus size={17}/> Add Student</button>
          <Link to="/teacher/students/bulk" className="btn-outline inline-flex items-center justify-center gap-2">
            <Upload size={17}/> Bulk Student Add
          </Link>
        </div>
      </div>
      <Result result={result} onDismiss={() => setResult(null)} />
      <StudentsList />
      <AddStudentModal open={showAddModal} onClose={() => setShowAddModal(false)} onCreated={created}/>
    </div>
  );
}
