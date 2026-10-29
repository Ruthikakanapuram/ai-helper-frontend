import { createRootRoute, createRoute, createRouter, redirect, Outlet } from '@tanstack/react-router';
import { useAuth } from '../features/auth/store';
import { Shell } from './shell';
import { Login } from './login';
import { TeacherActivities } from './teacher/index';
import { CreateActivity } from './teacher/create-activity';
import { TeacherMonitor } from './teacher/live-monitor';
import { StudentHome } from './student/index';
import { StudentChat } from './student/chat-session';
import { AdminDashboard } from './admin/index';
const root = createRootRoute({ component: () => <Outlet /> });
const index = createRoute({ getParentRoute: () => root, path: '/', beforeLoad: () => { const u = useAuth.getState().user; throw redirect({ to: u ? u.role === 'TEACHER' ? '/teacher/activities' : u.role === 'STUDENT' ? '/student' : '/admin' : '/login' }); } });
const login = createRoute({ getParentRoute: () => root, path: '/login', component: Login, beforeLoad: () => { const u = useAuth.getState().user; if (u)
        throw redirect({ to: u.role === 'TEACHER' ? '/teacher/activities' : u.role === 'STUDENT' ? '/student' : '/admin' }); } });
function guard(role) { return () => { const u = useAuth.getState().user; if (!u || u.role !== role)
    throw redirect({ to: '/login' }); }; }
const teacher = createRoute({ getParentRoute: () => root, path: '/teacher', beforeLoad: guard('TEACHER'), component: Shell });
const teacherIndex = createRoute({ getParentRoute: () => teacher, path: '/', beforeLoad: () => { throw redirect({ to: '/teacher/activities' }); } });
const teacherList = createRoute({ getParentRoute: () => teacher, path: 'activities', component: TeacherActivities });
const teacherNew = createRoute({ getParentRoute: () => teacher, path: 'activities/new', component: CreateActivity });
const teacherActivity = createRoute({ getParentRoute: () => teacher, path: 'activities/$activityId', component: TeacherMonitor });
const student = createRoute({ getParentRoute: () => root, path: '/student', beforeLoad: guard('STUDENT'), component: Shell });
const studentIndex = createRoute({ getParentRoute: () => student, path: '/', component: StudentHome });
const studentActivity = createRoute({ getParentRoute: () => student, path: 'activities/$activityId', component: StudentChat });
const admin = createRoute({ getParentRoute: () => root, path: '/admin', beforeLoad: guard('ADMIN'), component: Shell });
const adminIndex = createRoute({ getParentRoute: () => admin, path: '/', component: AdminDashboard });
const tree = root.addChildren([index, login, teacher.addChildren([teacherIndex, teacherList, teacherNew, teacherActivity]), student.addChildren([studentIndex, studentActivity]), admin.addChildren([adminIndex])]);
export const router = createRouter({ routeTree: tree, defaultPreload: 'intent' });
