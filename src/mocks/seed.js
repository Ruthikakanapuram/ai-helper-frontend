const branches = ['CSE', 'ECE', 'IT'];
const sections = ['A', 'B', 'C'];
export const students = Array.from({ length: 60 }, (_, i) => ({ id: `s${i + 1}`, name: ['Aarav', 'Diya', 'Rohan', 'Meera', 'Vikram', 'Ananya', 'Kiran', 'Nisha', 'Aditya', 'Priya'][i % 10] + ' ' + ['Sharma', 'Reddy', 'Rao', 'Nair', 'Patel', 'Kumar'][Math.floor(i / 10) % 6], rollNumber: `25BD1A${String(i + 1).padStart(4, '0')}`, branch: branches[i % 3], year: Math.floor(i / 15) % 4 + 1, section: sections[Math.floor(i / 3) % 3] }));
export const users = [{ id: 't1', name: 'Dr. Kavya Rao', username: 'teacher', role: 'TEACHER' }, { id: 'admin1', name: 'System Admin', username: 'admin', role: 'ADMIN' }, { id: 't2', name: 'Prof. Anil Kumar', username: 'teacher2', role: 'TEACHER' }, ...students.map((s, i) => ({ id: s.id, name: s.name, username: i === 0 ? 'student' : `student${i + 1}`, role: 'STUDENT', rollNumber: s.rollNumber }))];
const now = Date.now();
const iso = (delta) => new Date(now + delta).toISOString();
export const activities = [
    { id: 'a1', name: 'Digital Safety & Awareness', topic: 'Online Grooming', description: 'Learn to recognize warning signs and safely respond to suspicious online interactions.', duration: 45, status: 'ACTIVE', studentIds: students.slice(0, 25).map(s => s.id), createdAt: iso(-3600000), startedAt: iso(-9 * 60000), teacherId: 't1' },
    { id: 'a2', name: 'AI Fundamentals', topic: 'Generative AI', description: 'Explore how generative AI works.', duration: 30, status: 'DRAFT', studentIds: students.slice(0, 15).map(s => s.id), createdAt: iso(-7200000), teacherId: 't1' },
    { id: 'a3', name: 'Cybersecurity Basics', topic: 'Phishing', description: 'Identify common phishing techniques.', duration: 15, status: 'STOPPED', studentIds: students.slice(0, 30).map(s => s.id), createdAt: iso(-86400000), startedAt: iso(-84000000), stoppedAt: iso(-83000000), teacherId: 't1' },
    { id: 'a4', name: 'Responsible Social Media', topic: 'Digital Citizenship', description: 'Practice responsible social media participation.', duration: 30, status: 'ACTIVE', studentIds: students.slice(10, 40).map(s => s.id), createdAt: iso(-3600000), startedAt: iso(-4 * 60000), teacherId: 't1' },
    { id: 'a5', name: 'Prompt Engineering Lab', topic: 'AI Literacy', description: 'Write and refine effective prompts.', duration: 45, status: 'DRAFT', studentIds: students.slice(0, 50).map(s => s.id), createdAt: iso(-1800000), teacherId: 't1' }
];
export const sessions = [{ id: 'sess-a1-s2', activityId: 'a1', studentId: 's2', status: 'IN_PROGRESS', startedAt: iso(-7 * 60000) }, { id: 'sess-a1-s3', activityId: 'a1', studentId: 's3', status: 'COMPLETED', startedAt: iso(-8 * 60000), endedAt: iso(-3 * 60000) }];
export const messages = [
    { id: 'm1', sessionId: 'sess-a1-s2', studentId: 's2', activityId: 'a1', role: 'user', content: 'What is online grooming?', createdAt: iso(-6 * 60000) },
    { id: 'm2', sessionId: 'sess-a1-s2', studentId: 's2', activityId: 'a1', role: 'assistant', content: 'Online grooming is when someone builds **trust** with a young person online to manipulate or exploit them. Warning signs include requests for secrecy, private photos, or moving conversations to hidden channels.', createdAt: iso(-5 * 60000) },
    { id: 'm3', sessionId: 'sess-a1-s3', studentId: 's3', activityId: 'a1', role: 'user', content: 'How do I report suspicious messages?', createdAt: iso(-7 * 60000) },
    { id: 'm4', sessionId: 'sess-a1-s3', studentId: 's3', activityId: 'a1', role: 'assistant', content: 'Use the **report** and **block** tools, save evidence if safe, and talk to a trusted adult. Avoid replying to the person.', createdAt: iso(-6 * 60000) }
];
export const db = { students, users, activities, sessions, messages };
