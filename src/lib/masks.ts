export const onlyDigits = (v: string): string => (v ?? "").replace(/\D/g, "");

export function maskCNPJ(v: string): string {
  const d = onlyDigits(v).slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

export function maskPhone(v: string): string {
  const d = onlyDigits(v).slice(0, 11);
  if (d.length <= 10) {
    return d
      .replace(/^(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{4})(\d)/, "$1-$2");
  }
  return d
    .replace(/^(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d)/, "$1-$2");
}

export function maskCEP(v: string): string {
  const d = onlyDigits(v).slice(0, 8);
  return d.replace(/^(\d{5})(\d)/, "$1-$2");
}

export const isValidCNPJ = (v: string) => onlyDigits(v).length === 14;
export const isValidCEP = (v: string) => onlyDigits(v).length === 8;
export const isValidPhone = (v: string) => {
  const n = onlyDigits(v).length;
  return n === 10 || n === 11;
};
export const isValidEmail = (v: string) =>
  /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test((v ?? "").trim());
