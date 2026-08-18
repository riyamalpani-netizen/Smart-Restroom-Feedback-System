import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import DashboardCards from '../components/DashboardCards';

const mockStats = {
  unhappyFeedback: 5,
  activeAlerts: 3,
  todayFeedback: 50,
  totalRestrooms: 10,
  totalDevices: 20,
  onlineDevices: 18,
  offlineDevices: 2,
  happyFeedback: 35,
  okayFeedback: 10,
};

describe('DashboardCards', () => {
  it('renders dashboard cards with data', () => {
    render(<DashboardCards stats={mockStats} />);

    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('50')).toBeInTheDocument();
    expect(screen.getAllByText('10').length).toBe(2);
    expect(screen.getByText('20')).toBeInTheDocument();
    expect(screen.getByText('18')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('35')).toBeInTheDocument();
  });
});
