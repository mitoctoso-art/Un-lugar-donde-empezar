// Contraseña fuerte: 8+ caracteres, al menos una letra, un número
// y un símbolo. Se usa tanto en el registro como en el script de
// creación de administrador, para no duplicar la regla en dos sitios.

function isStrongPassword(password) {
  if (typeof password !== 'string') return false;
  const hasMinLength = password.length >= 8;
  const hasLetter = /[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSymbol = /[^A-Za-z0-9ÁÉÍÓÚÑáéíóúñ]/.test(password);
  return hasMinLength && hasLetter && hasNumber && hasSymbol;
}

const PASSWORD_RULES_MESSAGE =
  'La contraseña debe tener al menos 8 caracteres e incluir letras, números y al menos un símbolo (por ejemplo: Piura25@).';

module.exports = { isStrongPassword, PASSWORD_RULES_MESSAGE };
