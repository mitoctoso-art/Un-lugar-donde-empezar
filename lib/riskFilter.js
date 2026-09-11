// Filtro simple a nivel de patrón de texto. No es un sistema de
// moderación clínica: solo evita que frases de riesgo directo se
// publiquen sin más, y en su lugar ofrece la línea de ayuda.
const RISK_PATTERNS = [
  /suicid/i,
  /quitarme la vida/i,
  /matarme/i,
  /no quiero vivir/i,
  /no quiero seguir viviendo/i,
  /hacerme da[nñ]o/i,
  /autolesion/i,
  /cortarme/i
];

function containsRisk(text) {
  return RISK_PATTERNS.some((pattern) => pattern.test(text));
}

const RISK_MESSAGE =
  'Esto suena a que estás pasando un momento muy difícil. Antes de publicarlo, habla con alguien: la Línea 113, opción 5, atiende las 24 horas, gratis.';

module.exports = { containsRisk, RISK_MESSAGE };
