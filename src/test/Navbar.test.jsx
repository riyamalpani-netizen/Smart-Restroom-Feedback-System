import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { AuthProvider } from '../hooks/useAuth';

const renderWithRouter = (ui) => {
  return render(<BrowserRouter>{ui}</BrowserRouter>);
};

const mockUser = {
  name: 'Test User',
  email: 'test@example.com',
  role: 'super_admin',
};

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    user: mockUser,
    logout: vi.fn(),
  }),
  AuthProvider: ({ children }) => children,
}));

describe('Navbar', () => {
  it('renders the page title', () => {
    renderWithRouter(<Navbar />);
    const titleElement = screen.getByText('Dashboard');
    expect(titleElement).toBeInTheDocument();
  });

  it('renders the user name', () => {
    renderWithRouter(<Navbar />);
    const nameElement = screen.getByText('Test User');
    expect(nameElement).toBeInTheDocument();
  });
});
