import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import StoryForm from '@/components/StoryForm';

// Mock the sanitization functions
jest.mock('@/lib/utils/sanitization', () => ({
  sanitizeInput: jest.fn((input) => input),
  validateChildName: jest.fn(() => true),
  checkBlocklist: jest.fn(() => false),
}));

describe('StoryForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render all required form fields', () => {
    render(<StoryForm />);
    
    expect(screen.getByLabelText(/child's name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/adventure type/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/special skill/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/story setting/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create story/i })).toBeInTheDocument();
  });

  it('should validate child name is required', async () => {
    render(<StoryForm />);
    
    const submitButton = screen.getByRole('button', { name: /create story/i });
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText(/child's name is required/i)).toBeInTheDocument();
    });
  });

  it('should validate child name length (2-20 characters)', async () => {
    render(<StoryForm />);
    
    const nameInput = screen.getByLabelText(/child's name/i);
    const submitButton = screen.getByRole('button', { name: /create story/i });
    
    // Test too short
    fireEvent.change(nameInput, { target: { value: 'A' } });
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText(/name must be between 2 and 20 characters/i)).toBeInTheDocument();
    });
    
    // Test too long
    fireEvent.change(nameInput, { target: { value: 'A'.repeat(21) } });
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText(/name must be between 2 and 20 characters/i)).toBeInTheDocument();
    });
  });

  it('should sanitize special characters from inputs', async () => {
    const { sanitizeInput } = require('@/lib/utils/sanitization');
    render(<StoryForm />);
    
    const nameInput = screen.getByLabelText(/child's name/i);
    fireEvent.change(nameInput, { target: { value: '<script>alert("xss")</script>Emma' } });
    
    expect(sanitizeInput).toHaveBeenCalledWith('<script>alert("xss")</script>Emma');
  });

  it('should limit input lengths appropriately', () => {
    render(<StoryForm />);
    
    const nameInput = screen.getByLabelText(/child's name/i);
    const skillInput = screen.getByLabelText(/special skill/i);
    
    expect(nameInput).toHaveAttribute('maxLength', '20');
    expect(skillInput).toHaveAttribute('maxLength', '50');
  });

  it('should prevent form submission with invalid data', async () => {
    const { validateChildName } = require('@/lib/utils/sanitization');
    validateChildName.mockReturnValue(false);
    
    render(<StoryForm />);
    
    const nameInput = screen.getByLabelText(/child's name/i);
    const submitButton = screen.getByRole('button', { name: /create story/i });
    
    fireEvent.change(nameInput, { target: { value: 'Invalid123' } });
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText(/please enter a valid name/i)).toBeInTheDocument();
    });
  });

  it('should show loading state during submission', async () => {
    render(<StoryForm />);
    
    const nameInput = screen.getByLabelText(/child's name/i);
    const adventureSelect = screen.getByLabelText(/adventure type/i);
    const submitButton = screen.getByRole('button', { name: /create story/i });
    
    fireEvent.change(nameInput, { target: { value: 'Emma' } });
    fireEvent.change(adventureSelect, { target: { value: 'magical-forest' } });
    
    fireEvent.click(submitButton);
    
    expect(screen.getByText(/creating your story/i)).toBeInTheDocument();
    expect(submitButton).toBeDisabled();
  });

  it('should reset form after successful submission', async () => {
    render(<StoryForm />);
    
    const nameInput = screen.getByLabelText(/child's name/i);
    const adventureSelect = screen.getByLabelText(/adventure type/i);
    const skillInput = screen.getByLabelText(/special skill/i);
    
    fireEvent.change(nameInput, { target: { value: 'Emma' } });
    fireEvent.change(adventureSelect, { target: { value: 'magical-forest' } });
    fireEvent.change(skillInput, { target: { value: 'magic' } });
    
    // Mock successful API response
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true })
    });
    
    const submitButton = screen.getByRole('button', { name: /create story/i });
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect((nameInput as HTMLInputElement).value).toBe('');
      expect((adventureSelect as HTMLSelectElement).value).toBe('');
      expect((skillInput as HTMLInputElement).value).toBe('');
    });
  });

  it('should handle form submission errors gracefully', async () => {
    render(<StoryForm />);
    
    const nameInput = screen.getByLabelText(/child's name/i);
    const adventureSelect = screen.getByLabelText(/adventure type/i);
    const submitButton = screen.getByRole('button', { name: /create story/i });
    
    // Fill in required fields
    fireEvent.change(nameInput, { target: { value: 'Emma' } });
    fireEvent.change(adventureSelect, { target: { value: 'magical-forest' } });
    
    // Mock API error
    global.fetch = jest.fn().mockRejectedValue(new Error('API Error'));
    
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText(/failed to create story. please try again/i)).toBeInTheDocument();
    });
  });

  it('should provide accessibility attributes', () => {
    render(<StoryForm />);
    
    const nameInput = screen.getByLabelText(/child's name/i);
    const adventureSelect = screen.getByLabelText(/adventure type/i);
    
    expect(nameInput).toHaveAttribute('required');
    expect(adventureSelect).toHaveAttribute('required');
    expect(nameInput).toHaveAttribute('aria-describedby');
  });
});