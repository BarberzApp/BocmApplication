// Very lightweight US-style formatter: (XXX) XXX-XXXX for 10+ digits.
// Falls back to digits only if fewer than 4 digits.
export const formatPhoneNumber = (input: string): string => {
  if (!input) return '';
  const digits = input.replace(/\D+/g, '').slice(0, 15); // hard cap to avoid runaway input
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
};

export default { formatPhoneNumber };

