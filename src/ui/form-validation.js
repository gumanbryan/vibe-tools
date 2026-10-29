// Shared by every modal: prevent incomplete values from reaching accounting.
export function wireValidation(form, extraCheck = () => {}) {
  const submit = form.querySelector('[type=submit]');
  const errorBox = form.querySelector('#form-error');
  const labelOf = el => el.closest('label')?.querySelector('span')?.textContent || el.name;
  const validate = () => {
    const inputs = [...form.querySelectorAll('input,select,textarea')];
    for (const el of inputs) el.setCustomValidity('');
    extraCheck(form);
    let first = '';
    for (const el of inputs) {
      if (el.disabled || el.type === 'hidden' || !el.willValidate) continue;
      const v = el.validity, label = labelOf(el);
      let message = '';
      if (v.customError) message = el.validationMessage;
      else if (v.valueMissing) message = `請填寫${label}`;
      else if (v.badInput || v.typeMismatch) message = `${label}請輸入有效數值或格式`;
      else if (v.rangeUnderflow) message = `${label}不可小於 ${el.min}`;
      else if (v.rangeOverflow) message = `${label}不可大於 ${el.max}`;
      else if (v.stepMismatch) message = `${label}的數值精度不符，請依欄位單位輸入`;
      else if (!v.valid) message = `請核對${label}`;
      el.setAttribute('aria-invalid', message ? 'true' : 'false');
      const wrapper = el.closest('label');
      let hint = wrapper?.querySelector('.field-error');
      if (!hint && wrapper) {
        hint = document.createElement('small'); hint.className = 'field-error';
        hint.id = `error-${el.name.replace(/[^a-z0-9-]/gi,'-')}`;
        wrapper.append(hint); el.setAttribute('aria-describedby', hint.id);
      }
      if (hint) hint.textContent = message;
      if (message && !first) first = message;
    }
    submit.disabled = !!first;
    errorBox.textContent = first ? '請先完成標示的欄位，才能儲存。' : '';
    return !first;
  };
  form.addEventListener('input', validate);
  form.addEventListener('change', validate);
  form.noValidate = true;
  validate();
  return validate;
}
export function friendlyFormError(error) {
  return /DecimalError|Invalid argument|有限數值/.test(error?.message ?? '')
    ? '有數字欄位尚未填寫或格式不正確，請核對股數、單價與費率。資料尚未儲存，可修正或取消。'
    : error?.message || '無法儲存，請核對資料後再試；也可以取消返回。';
}
