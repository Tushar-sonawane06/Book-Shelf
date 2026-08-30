import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import Register from './Register.jsx';
import { AuthContext } from '../context/AuthContext.jsx';

const navigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => navigate };
});

function normalisedError({ status, code, message, data }) {
  const axiosError = new Error('Request failed');
  axiosError.response = { status, data };
  return { status, code, message, original: axiosError };
}

function renderRegister(register) {
  const value = {
    register,
    login: vi.fn(),
    isAuthenticated: false,
    loading: false,
    user: null,
    logout: vi.fn(),
    checkAuth: vi.fn(),
  };

  return render(
    <MemoryRouter>
      <AuthContext.Provider value={value}>
        <Register />
      </AuthContext.Provider>
    </MemoryRouter>
  );
}

async function fillForm(user, { password = 'correct-horse', confirm = 'correct-horse' } = {}) {
  await user.type(screen.getByLabelText('Name'), 'Reader');
  await user.type(screen.getByLabelText('Email'), 'reader@example.com');
  await user.type(screen.getByLabelText('Password'), password);
  await user.type(screen.getByLabelText('Confirm Password'), confirm);
  await user.click(screen.getByRole('button', { name: /register/i }));
}

describe('Register', () => {
  beforeEach(() => {
    navigate.mockClear();
  });

  it('shows that the email is already taken instead of a generic failure', async () => {
    const user = userEvent.setup();
    const register = vi.fn().mockRejectedValue(
      normalisedError({
        status: 409,
        code: 'HTTP_ERROR',
        message: 'An unexpected error occurred.',
        data: { message: 'Email already registered' },
      })
    );

    renderRegister(register);
    await fillForm(user);

    expect(await screen.findByRole('alert')).toHaveTextContent('Email already registered');
    expect(screen.queryByText('Failed to register')).not.toBeInTheDocument();
  }, 15000);

  it('puts each validation message on the field it belongs to', async () => {
    const user = userEvent.setup();
    const register = vi.fn().mockRejectedValue(
      normalisedError({
        status: 400,
        code: 'HTTP_ERROR',
        data: {
          message: 'Validation failed',
          errors: [
            { field: 'password', message: 'password must be at least 8 characters' },
            { field: 'name', message: 'name is required' },
          ],
        },
      })
    );

    renderRegister(register);
    await fillForm(user, { password: 'short', confirm: 'short' });

    await screen.findByText('password must be at least 8 characters');
    expect(screen.getByText('name is required')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'false');
  });

  it('catches a password mismatch locally without calling the API', async () => {
    const user = userEvent.setup();
    const register = vi.fn();

    renderRegister(register);
    await fillForm(user, { password: 'correct-horse', confirm: 'battery-staple' });

    expect(await screen.findByText('Passwords do not match')).toBeInTheDocument();
    expect(register).not.toHaveBeenCalled();
  });

  it('clears a previous error when the form is resubmitted', async () => {
    const user = userEvent.setup();
    const register = vi
      .fn()
      .mockRejectedValueOnce(
        normalisedError({ status: 409, data: { message: 'Email already registered' } })
      )
      .mockResolvedValueOnce({ user: { name: 'Reader' } });

    renderRegister(register);
    await fillForm(user);
    expect(await screen.findByRole('alert')).toHaveTextContent('Email already registered');

    await user.click(screen.getByRole('button', { name: /register/i }));

    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/'));
    expect(screen.queryByText('Email already registered')).not.toBeInTheDocument();
  });
});
