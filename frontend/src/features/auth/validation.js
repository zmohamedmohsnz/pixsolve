const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const validateEmail = email => {
  if (!email.trim()) return 'Email is required.';
  return emailPattern.test(email.trim()) ? '' : 'Enter a valid email address.';
};

export const validatePassword = password => {
  if (!password) return 'Password is required.';
  if (password.length < 8) return 'Password must be at least 8 characters.';
  if (password.length > 72) return 'Password must not exceed 72 characters.';
  if (!/[a-z]/.test(password)) return 'Password must include a lowercase letter.';
  if (!/[A-Z]/.test(password)) return 'Password must include an uppercase letter.';
  if (!/[0-9]/.test(password)) return 'Password must include a number.';
  if (!/[^A-Za-z0-9]/.test(password)) return 'Password must include a symbol.';
  return '';
};

export const apiFieldErrors = error => Object.fromEntries(
  (error?.details?.fields || []).flatMap(fieldError => {
    if (typeof fieldError === 'string') return [[fieldError, error.message]];
    return fieldError?.field && fieldError?.message ? [[fieldError.field, fieldError.message]] : [];
  })
);
