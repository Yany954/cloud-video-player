// Español latinoamericano neutro, de «tú». Debe tener exactamente la misma forma que `en.ts`.

import type { Messages } from './en';

export const es: Messages = {
  common: {
    appName: 'Cloud Video Player',
    skipToContent: 'Ir al contenido',
    loading: 'Cargando',
  },
  theme: {
    switchToDark: 'Cambiar a modo oscuro',
    switchToLight: 'Cambiar a modo claro',
    legend: 'Colores',
    system: 'Igual que mi dispositivo',
    light: 'Claro',
    dark: 'Oscuro',
  },
  language: {
    label: 'Idioma',
  },
  nav: {
    label: 'Principal',
    yourVideos: 'Tus videos',
    events: 'Eventos',
    library: 'Biblioteca',
    review: 'Revisión',
    users: 'Usuarios',
    profile: 'Perfil',
    profileOf: (email: string) => `Perfil de ${email}`,
    signOut: 'Cerrar sesión',
  },
  loginPage: {
    title: 'Iniciar sesión | Cloud Video Player',
    privacyNote:
      'Aquí los videos son privados. Solo ves los tuyos, los eventos a los que te invitaron y lo que aprobaron los administradores de la biblioteca.',
    asideTitle: 'Todos los conciertos que grabaste, en un solo lugar privado.',
    asideText:
      'En calidad original, fuera de tu teléfono, y solo los ven las personas que invites.',
  },
  auth: {
    email: 'Correo electrónico',
    password: 'Contraseña',
    showPassword: 'Mostrar contraseña',
    hidePassword: 'Ocultar contraseña',
    passwordHint: (min: number) =>
      `Al menos ${min} caracteres. Unas cuantas palabras al azar funcionan bien.`,
    passwordsDoNotMatch: 'Las contraseñas no coinciden.',
    unsupportedStep:
      'Esta cuenta necesita un paso de inicio de sesión que esta aplicación todavía no admite.',
    signIn: {
      title: 'Iniciar sesión',
      intro: 'Usa el correo electrónico y la contraseña de tu cuenta.',
      submit: 'Iniciar sesión',
      submitting: 'Iniciando sesión',
      cantSignIn: '¿No puedes entrar?',
      resetPassword: 'Restablece tu contraseña',
      newHere: '¿Primera vez aquí?',
      createAccount: 'Crea una cuenta',
    },
    signUp: {
      title: 'Crea tu cuenta',
      intro: 'Te enviaremos un código por correo para confirmar que la dirección es tuya.',
      repeatPassword: 'Repite la contraseña',
      submit: 'Crear cuenta',
      submitting: 'Creando la cuenta',
      haveAccount: '¿Ya tienes una cuenta?',
      signIn: 'Inicia sesión',
    },
    confirmEmail: {
      title: 'Revisa tu correo',
      introBefore: 'Enviamos un código de 6 dígitos a',
      introAfter: '. Puede tardar un minuto y quizá esté en tu carpeta de correo no deseado.',
      code: 'Código de confirmación',
      submit: 'Confirmar e iniciar sesión',
      submitting: 'Confirmando',
      noEmail: '¿Aún no llega el correo?',
      resend: 'Enviar un código nuevo',
      resent: 'Va en camino un código nuevo.',
    },
    forgot: {
      title: '¿Olvidaste tu contraseña?',
      intro: 'Escribe tu correo y te enviaremos un código para elegir una nueva.',
      submit: 'Enviar código',
      submitting: 'Enviando',
      remembered: '¿Ya la recordaste?',
      signIn: 'Inicia sesión',
    },
    reset: {
      title: 'Elige una contraseña nueva',
      introBefore: 'Si',
      introAfter:
        'tiene una cuenta, le enviamos un código de 6 dígitos. Puede tardar un minuto y quizá esté en tu carpeta de correo no deseado.',
      code: 'Código del correo',
      newPassword: 'Contraseña nueva',
      repeatNewPassword: 'Repite la contraseña nueva',
      submit: 'Guardar e iniciar sesión',
      submitting: 'Guardando',
      noEmail: '¿Aún no llega el correo?',
      resend: 'Enviar un código nuevo',
    },
    newPassword: {
      title: 'Elige tu contraseña',
      intro: 'Tu contraseña temporal funcionó. Ahora elige una que solo tú conozcas.',
      newPassword: 'Contraseña nueva',
      repeatNewPassword: 'Repite la contraseña nueva',
      submit: 'Guardar y continuar',
      submitting: 'Guardando',
    },
  },
  authErrors: {
    tooManyAttempts: 'Demasiados intentos. Espera unos minutos y vuelve a intentarlo.',
    stillTemporaryPassword:
      'Esta cuenta todavía tiene su contraseña temporal. Usa la del correo de invitación, o pide a un administrador que te invite de nuevo.',
    emailNeverConfirmed:
      'El correo de esta cuenta nunca se confirmó. Inicia sesión con tu contraseña para recibir un código de confirmación nuevo.',
    incorrectCredentials: 'El correo o la contraseña no son correctos.',
    accountExists: 'Ya existe una cuenta con este correo. Inicia sesión.',
    wrongCode: 'Ese código no es correcto. Revisa el correo y escríbelo de nuevo.',
    expiredCode: 'Ese código ya venció. Pide uno nuevo abajo.',
    invalidEmail: 'Escribe un correo electrónico válido, como nombre@ejemplo.com.',
    passwordTooShort: 'Elige una contraseña de al menos 12 caracteres.',
    network: 'No se pudo conectar con el servidor. Revisa tu conexión y vuelve a intentarlo.',
    unknown: 'Algo salió mal. Vuelve a intentarlo.',
  },
};
