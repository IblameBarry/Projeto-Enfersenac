// utils/parse.js
// O formulário de prontuário usa campos de texto livre (ex.: "82 bpm",
// "36.5 °C", "6/10"), mas o banco guarda colunas tipadas (INT, DECIMAL,
// DATE). Estas funções fazem essa conversão de forma tolerante,
// devolvendo null quando não há como interpretar o valor.

function paraInteiro(valor) {
  if (valor === undefined || valor === null) return null;
  const match = String(valor).match(/-?\d+/);
  return match ? parseInt(match[0], 10) : null;
}

function paraDecimal(valor) {
  if (valor === undefined || valor === null) return null;
  const match = String(valor).match(/-?\d+(?:[.,]\d+)?/);
  if (!match) return null;
  return parseFloat(match[0].replace(',', '.'));
}

// Lê "6/10" ou "6" e devolve um inteiro entre 0 e 10 (ou null).
function paraEscalaDor(valor) {
  const n = paraInteiro(valor);
  if (n === null) return null;
  return Math.min(10, Math.max(0, n));
}

// Lê "98%" e devolve um inteiro entre 0 e 100 (ou null).
function paraPercentual(valor) {
  const n = paraInteiro(valor);
  if (n === null) return null;
  return Math.min(100, Math.max(0, n));
}

// Aceita "DD/MM/AAAA" ou "AAAA-MM-DD" e devolve "AAAA-MM-DD" (ou null).
function paraData(valor) {
  if (!valor) return null;
  const texto = String(valor).trim();

  let m = texto.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;

  m = texto.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return texto;

  return null;
}

module.exports = { paraInteiro, paraDecimal, paraEscalaDor, paraPercentual, paraData };
