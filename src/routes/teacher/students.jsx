import { useMemo, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createColumnHelper, flexRender, getCoreRowModel, getPaginationRowModel, useReactTable } from '@tanstack/react-table';
import { toast } from 'sonner';
import { Plus, Upload, Download, Search, ShieldAlert } from 'lucide-react';
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
function Result({result,onDismiss}) {
  if(!result)return null;
  return <Card className="my-5 border border-amber-400 p-5"><div className="flex items-start justify-between gap-3"><div><h3 className="font-bold">{result.count} students created</h3><p className="text-sm text-amber-700 dark:text-amber-300">Temporary passwords are returned once. Download now and store securely. Do not share this CSV publicly.</p></div><Button variant="ghost" onClick={onDismiss}>Dismiss</Button></div>
    <Button className="mt-3" onClick={()=>exportCredentials(result.students)}><Download size={16}/> Download credentials CSV</Button>
  </Card>;
}
function AddOne({onCreated}) {
 const [value,setValue]=useState(emptyStudent);const [errors,setErrors]=useState({});
 const mutation=useMutation({mutationFn:students=>api.createStudentsBulk(students),onSuccess:r=>{toast.success(`${r.count} student created`);setValue(emptyStudent());setErrors({});onCreated(r);},onError:e=>toast.error(e.message)});
 const submit=e=>{e.preventDefault();const next=validateStudent(value);setErrors(next);if(Object.keys(next).length)return;mutation.mutate([cleanStudent(value)]);};
 return <Card className="p-6"><h2 className="mb-4 text-lg font-bold">Add one student</h2><form onSubmit={submit}><StudentFields value={value} onChange={setValue} errors={errors}/><Button className="mt-5" type="submit" disabled={mutation.isPending}>{mutation.isPending?'Creating...':'Create student'}</Button></form></Card>;
}
function AddBulk({onCreated}) {
 const [rows,setRows]=useState([]);const [error,setError]=useState('');
 const mutation=useMutation({mutationFn:students=>api.createStudentsBulk(students),onSuccess:r=>{toast.success(`${r.count} students created`);setRows([]);setError('');onCreated(r);},onError:e=>setError(e.message)});
 async function readFile(e){const file=e.target.files?.[0];if(!file)return;try{if(file.size>2_000_000)throw new Error('CSV must be under 2MB');const parsed=parseCsv(await file.text());setRows(parsed);setError('');}catch(err){setRows([]);setError(err.message);}e.target.value='';}
 const duplicateNames=useMemo(()=>{const seen=new Set();return rows.filter(r=>{const key=r.username.trim().toLowerCase();if(seen.has(key))return true;seen.add(key);return false;}).map(r=>r.username)},[rows]);
 const invalid=rows.map((r,index)=>({index:index+2,errors:validateStudent(r)})).filter(x=>Object.keys(x.errors).length);
 function submit(){if(invalid.length||duplicateNames.length||!rows.length)return;mutation.mutate(rows.map(cleanStudent));}
 function downloadTemplate(){const url=URL.createObjectURL(new Blob([csvTemplate()],{type:'text/csv'}));const a=document.createElement('a');a.href=url;a.download='student-import-template.csv';a.click();URL.revokeObjectURL(url);}
 return <Card className="p-6"><h2 className="mb-2 text-lg font-bold">Bulk add students</h2><p className="muted mb-4 text-sm">CSV headers: username, fullName, rollNumber, year, branch, section. Maximum 500 per upload. Creation is transactional.</p>
 <div className="flex flex-wrap gap-3"><Button type="button" variant="outline" onClick={downloadTemplate}><Download size={16}/> CSV template</Button><label className="btn-outline inline-flex cursor-pointer items-center gap-2"><Upload size={16}/> Select CSV<input type="file" accept=".csv,text/csv" onChange={readFile} className="sr-only"/></label></div>
 {rows.length>0&&<div className="mt-4"><p className="font-semibold">{rows.length} students ready for validation</p><div className="mt-2 max-h-60 overflow-auto rounded-lg border"><table className="w-full text-left text-xs"><thead><tr>{['Username','Full name','Roll','Year','Branch','Section'].map(x=><th className="p-2" key={x}>{x}</th>)}</tr></thead><tbody>{rows.slice(0,100).map((r,i)=><tr className="border-t" key={i}>{['username','fullName','rollNumber','year','branch','section'].map(k=><td className="p-2" key={k}>{r[k]}</td>)}</tr>)}</tbody></table></div>{rows.length>100&&<p className="muted text-xs">Showing first 100 rows</p>}</div>}
 {duplicateNames.length>0&&<p role="alert" className="mt-3 text-sm text-red-600">Duplicate usernames: {duplicateNames.join(', ')}</p>}
 {invalid.length>0&&<p role="alert" className="mt-3 text-sm text-red-600">Invalid rows: {invalid.slice(0,10).map(x=>`${x.index} (${Object.keys(x.errors).join(', ')})`).join('; ')}{invalid.length>10?' ...':''}</p>}
 {error&&<p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
 <Button type="button" className="mt-4" disabled={!rows.length||invalid.length>0||duplicateNames.length>0||mutation.isPending} onClick={submit}>{mutation.isPending?'Importing...':`Import ${rows.length} students`}</Button>
 </Card>;
}
function StudentsList() {
 const [search,setSearch]=useState('');
 const q=useQuery({queryKey:cacheKey,queryFn:api.getStudentsList});
 const students=Array.isArray(q.data)?q.data:Array.isArray(q.data?.students)?q.data.students:[];
 const filtered=useMemo(()=>students.filter(s=>[s.fullName,s.username,s.rollNumber,s.branch,s.section].some(v=>String(v??'').toLowerCase().includes(search.toLowerCase()))),[students,search]);
 const columns=useMemo(()=>[
 studentCols.accessor('fullName',{header:'Student',cell:i=><span className="font-semibold">{i.getValue()}</span>}),
 studentCols.accessor('rollNumber',{header:'Roll Number',cell:i=>i.getValue()||'—'}),
 studentCols.accessor('username',{header:'Username',cell:i=>i.getValue()||'—'}),
 studentCols.accessor('year',{header:'Year'}),studentCols.accessor('branch',{header:'Branch'}),studentCols.accessor('section',{header:'Section'})
 ],[]);
 const table=useReactTable({data:filtered,columns,getCoreRowModel:getCoreRowModel(),getPaginationRowModel:getPaginationRowModel(),initialState:{pagination:{pageSize:10}}});
 return <Card className="p-5"><div className="mb-4 flex flex-wrap justify-between gap-3"><h2 className="text-lg font-bold">Student directory</h2><label className="flex items-center gap-2 rounded-lg border px-3"><Search size={16}/><span className="sr-only">Search students</span><input className="bg-transparent py-2 outline-none" placeholder="Search students" value={search} onChange={e=>setSearch(e.target.value)}/></label></div>
 {q.isPending?<Loading/>:q.isError?<div><ErrorState error={q.error} retry={()=>void q.refetch()}/><p className="muted text-center text-sm">This view requires GET /api/students and access for TEACHER.</p></div>:!filtered.length?<Empty title="No matching students" description="Try another search or add students above."/>:<><div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead className="bg-slate-50 dark:bg-slate-800"><tr>{table.getHeaderGroups().flatMap(g=>g.headers.map(h=><th key={h.id} className="p-3">{flexRender(h.column.columnDef.header,h.getContext())}</th>))}</tr></thead><tbody>{table.getRowModel().rows.map(row=><tr key={row.id} className="border-t dark:border-slate-800">{row.getVisibleCells().map(cell=><td className="p-3" key={cell.id}>{flexRender(cell.column.columnDef.cell,cell.getContext())}</td>)}</tr>)}</tbody></table></div><div className="mt-4 flex items-center justify-end gap-3"><span className="muted text-sm">Page {table.getState().pagination.pageIndex+1} of {table.getPageCount()}</span><Button variant="outline" disabled={!table.getCanPreviousPage()} onClick={()=>table.previousPage()}>Previous</Button><Button variant="outline" disabled={!table.getCanNextPage()} onClick={()=>table.nextPage()}>Next</Button></div></>}
 </Card>;
}
export function TeacherStudents(){const [tab,setTab]=useState('list');const [result,setResult]=useState(null);const qc=useQueryClient();const created=r=>{setResult(r);void qc.invalidateQueries({queryKey:cacheKey});};return <><SectionHeading title="Students" description="Manage student accounts and securely import new students." actions={<Link to="/teacher/activities" className="btn-outline">Activities</Link>}/><div className="mb-6 flex flex-wrap gap-2" role="tablist" aria-label="Students sections">{[['list','Student view'],['one','Single add'],['bulk','Bulk add']].map(([key,name])=><button role="tab" aria-selected={tab===key} key={key} onClick={()=>setTab(key)} className={`rounded-xl px-5 py-3 text-sm font-semibold ${tab===key?'bg-blue-600 text-white':'border dark:border-slate-700'}`}>{name}</button>)}</div><Result result={result} onDismiss={()=>setResult(null)}/>{tab==='list'?<StudentsList/>:tab==='one'?<AddOne onCreated={created}/>:<AddBulk onCreated={created}/>}<div className="mt-5 flex items-start gap-2 text-sm text-slate-500"><ShieldAlert size={18}/><p>This page requires your NestJS StudentsController to allow the TEACHER role for both student creation and listing.</p></div></>}
