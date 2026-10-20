export const ok = (value, warnings = []) => ({ ok: true, value, warnings });
export const err = (code, message, field) => ({
  ok: false,
  errors: [{ code, message, field }],
});
