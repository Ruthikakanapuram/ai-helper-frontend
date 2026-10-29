// IMPORTANT: Replace these option values with exact values in common.enum.ts.
// The NestJS DTO validates ENUM VALUES (not display labels).
export const BRANCHES = ['CSE', 'ECE', 'EEE'];
export const YEARS = ['1', '2', '3', '4'];
export const SECTIONS = ['A', 'B', 'C'];
export const FIELDS = ['username','fullName','rollNumber','year','branch','section'];
export const emptyStudent = () => ({ username:'',fullName:'',rollNumber:'',year:'',branch:'',section:'' });
export function validateStudent(s) {
  const errors = {};
  if (!s.username.trim()) errors.username = 'Username is required';
  if (!s.fullName.trim()) errors.fullName = 'Full name is required';
  if (!s.year) errors.year = 'Year is required';
  if (!s.branch) errors.branch = 'Branch is required';
  if (!s.section) errors.section = 'Section is required';
  if (s.username.length > 100) errors.username = 'Username is too long';
  if (s.fullName.length > 150) errors.fullName = 'Maximum 150 characters';
  if (s.rollNumber.length > 50) errors.rollNumber = 'Maximum 50 characters';
  return errors;
}
export function cleanStudent(s) {
  return {username:s.username.trim(),fullName:s.fullName.trim(),
    ...(s.rollNumber.trim() ? {rollNumber:s.rollNumber.trim()} : {}),
    year:s.year,branch:s.branch,section:s.section};
}
export function parseCsv(raw) {
  // RFC4180-style quoted fields, escaped quotes, CRLF and newlines inside quotes.
  const rows=[];let row=[];let field='';let quoted=false;
  for(let i=0;i<raw.length;i++){
    const ch=raw[i];
    if(quoted){if(ch==='"' && raw[i+1]==='"'){field+='"';i++;}else if(ch==='"'){quoted=false;}else{field+=ch;}}
    else if(ch==='"'){quoted=true;}
    else if(ch===','){row.push(field);field='';}
    else if(ch==='\n'){row.push(field);rows.push(row);row=[];field='';}
    else if(ch==='\r'){if(raw[i+1]==='\n')i++;row.push(field);rows.push(row);row=[];field='';}
    else{field+=ch;}
  }
  if(quoted)throw new Error('CSV has an unclosed quoted value');
  if(field!==''||row.length){row.push(field);rows.push(row);}
  if(!rows.length)throw new Error('CSV is empty');
  const headings=rows.shift().map(h=>h.replace(/^\uFEFF/,'').trim());
  if(FIELDS.some(k=>!headings.includes(k)))throw new Error(`CSV headers must be: ${FIELDS.join(', ')}`);
  const values=rows.filter(r=>r.some(v=>v.trim())).map((r,i)=>{
    if(r.length!==headings.length)throw new Error(`Row ${i+2} has the wrong number of columns`);
    return Object.fromEntries(FIELDS.map(k=>[k, (r[headings.indexOf(k)]||'').trim()]));
  });
  if(!values.length)throw new Error('CSV contains no students');
  if(values.length>500)throw new Error('Maximum 500 students per import');
  return values;
}
export function csvTemplate() {return `${FIELDS.join(',')}\nstudent101,Example Student,25BD1A0101,1,CSE,A\n`;}
