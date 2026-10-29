
import { useForm } from '@tanstack/react-form';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { GraduationCap, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

import {
  api,
  decodeToken,
  saveAccessToken,
  clearAccessToken,
} from '../lib/api';

import { loginSchema } from '../lib/schemas';
import { useAuth } from '../features/auth/store';
import { Button, Spinner } from '../components/ui';

export function Login() {
  const navigate = useNavigate();
  const setSession = useAuth((state) => state.setSession);
const logout = useAuth((state) => state.logout);

  const mutation = useMutation({
    mutationFn: ({ username, password }) =>
      api.login(username, password),

    onSuccess: (response, variables) => {
      try {
        // NestJS response:
        // { access_token: "...", token_type: "Bearer" }

        const token = response.access_token;

        if (!token || response.token_type !== 'Bearer') {
          throw new Error('Invalid authentication response');
        }

        const decoded = decodeToken(token);

        const role = decoded.role?.toUpperCase();

        if (!['TEACHER', 'STUDENT', 'ADMIN'].includes(role)) {
          throw new Error('Unknown user role');
        }

        if (!decoded.sub) {
          throw new Error('User ID missing from token');
        }

        if (
          typeof decoded.exp !== 'number' ||
          decoded.exp * 1000 <= Date.now()
        ) {
          throw new Error('Authentication token has expired');
        }

        // Construct the frontend user object
        const user = {
          id: String(decoded.sub),
          username: variables.username,
          name: variables.username,
          role,
        };

        // Persist token and update Zustand
        setSession(user, token);

        toast.success('Login successful');

        const destination = {
          TEACHER: '/teacher/activities',
          STUDENT: '/student',
          ADMIN: '/admin',
        };

        void navigate({
          to: destination[role],
          replace: true,
        });
      } catch (error) {
        logout();
        toast.error(error.message || 'Login failed');
      }
    },

    onError: (error) => {
      toast.error(error.message || 'Unable to login');
    },
  });

  const form = useForm({
    defaultValues: {
      username: '',
      password: '',
    },

    validators: {
      onSubmit: loginSchema,
    },

    onSubmit: async ({ value }) => {
      await mutation.mutateAsync(value);
    },
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-100 via-blue-50 to-indigo-100 p-5 dark:from-slate-950 dark:via-slate-950 dark:to-blue-950">

      <div className="w-full max-w-md rounded-3xl border border-white/70 bg-white p-8 shadow-2xl shadow-blue-900/10 dark:border-slate-800 dark:bg-slate-900">

        {/* Application logo */}
        <div className="mb-8 flex items-center gap-3">
          <div className="rounded-2xl bg-blue-600 p-3 text-white">
            <GraduationCap size={28} />
          </div>

          <div>
            <h1 className="text-2xl font-extrabold">
              AI Helper
            </h1>

            <p className="muted">
              Your classroom, powered by AI
            </p>
          </div>
        </div>

        <h2 className="text-xl font-bold">
          Welcome back
        </h2>

        <p className="muted mb-6 mt-1">
          Sign in with your registered credentials.
        </p>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            void form.handleSubmit();
          }}
          className="space-y-4"
        >

          {/* Username */}
          <form.Field name="username">
            {(field) => (
              <div>
                <label
                  htmlFor="username"
                  className="field-label"
                >
                  Username
                </label>

                <input
                  id="username"
                  className="input"
                  autoComplete="username"
                  placeholder="Enter username"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) =>
                    field.handleChange(event.target.value)
                  }
                />

                {field.state.meta.errors.length > 0 && (
                  <p className="mt-1 text-xs text-red-600">
                    {field.state.meta.errors
                      .map((error) => String(error?.message))
                      .join(', ')}
                  </p>
                )}
              </div>
            )}
          </form.Field>

          {/* Password */}
          <form.Field name="password">
            {(field) => (
              <div>
                <label
                  htmlFor="password"
                  className="field-label"
                >
                  Password
                </label>

                <input
                  id="password"
                  type="password"
                  className="input"
                  autoComplete="current-password"
                  placeholder="Enter password"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) =>
                    field.handleChange(event.target.value)
                  }
                />

                {field.state.meta.errors.length > 0 && (
                  <p className="mt-1 text-xs text-red-600">
                    {field.state.meta.errors
                      .map((error) => String(error?.message))
                      .join(', ')}
                  </p>
                )}
              </div>
            )}
          </form.Field>

          {/* Login button */}
          <Button
            type="submit"
            className="w-full"
            disabled={mutation.isPending}
          >
            {mutation.isPending ? (
              <Spinner />
            ) : (
              <>
                Sign in
                <ArrowRight size={16} />
              </>
            )}
          </Button>

        </form>

        <p className="muted mt-6 text-center text-xs">
          Teacher, Student and Admin accounts supported
        </p>
      </div>
    </div>
  );
}
