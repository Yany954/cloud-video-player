import type { LocalizedDocument } from './types';

// Lists exactly what the web app keeps in the browser. When code starts storing something new
// (search the code for `document.cookie`, `localStorage` and `sessionStorage`), add it here in
// both languages. If anything beyond "needed to work" is ever added, a consent banner becomes
// necessary.

export const cookies: LocalizedDocument = {
  en: {
    title: 'Cookie policy',
    description: 'The few things Cloud Video Player keeps in your browser, and why.',
    intro: [
      'Cloud Video Player keeps a small amount of information in your browser. All of it is needed for the service to work or to remember a choice you made. We use no advertising, analytics or tracking cookies, and no other company places cookies through this site. That is why there is no cookie banner asking for consent.',
    ],
    sections: [
      {
        heading: 'Cookies',
        items: [
          'cvp.lang: the language you chose (English or Spanish). Kept for one year. Set only when you use the language switch.',
          'cvp.session: a marker that you are signed in, so the home page takes you straight to your videos. It holds no personal data and cannot be used to sign in. Kept for 30 days and removed when you sign out.',
        ],
      },
      {
        heading: 'Other browser storage',
        items: [
          'Your sign-in session: the keys that prove you are signed in, kept by our sign-in system until you sign out or they expire.',
          'cvp.theme: your choice of light or dark colours.',
          'cvp.autoplay-next: whether the next video of an event starts by itself.',
          'cvp.uploads-in-progress: which uploads were not finished, so they can continue where they stopped.',
          'cvp.return-to: the page to return to after signing in, for example an invitation. Kept only until you close the tab.',
        ],
      },
      {
        heading: 'How to remove them',
        paragraphs: [
          'Signing out removes your session. You can delete everything else at any time from your browser’s settings, under cookies and site data; the app will then use its defaults again.',
        ],
      },
    ],
  },
  es: {
    title: 'Política de cookies',
    description: 'Lo poco que Cloud Video Player guarda en tu navegador, y para qué.',
    intro: [
      'Cloud Video Player guarda una pequeña cantidad de información en tu navegador. Toda es necesaria para que el servicio funcione o para recordar una preferencia que elegiste. No usamos cookies de publicidad, analítica ni rastreo, y ninguna otra empresa coloca cookies a través de este sitio. Por eso no hay un aviso de cookies pidiendo tu consentimiento.',
    ],
    sections: [
      {
        heading: 'Cookies',
        items: [
          'cvp.lang: el idioma que elegiste (español o inglés). Se conserva un año. Solo se crea cuando usas el selector de idioma.',
          'cvp.session: una marca de que tienes la sesión iniciada, para que la página de inicio te lleve directo a tus videos. No contiene datos personales y no sirve para iniciar sesión. Se conserva 30 días y se elimina al cerrar sesión.',
        ],
      },
      {
        heading: 'Otro almacenamiento del navegador',
        items: [
          'Tu sesión: las claves que prueban que iniciaste sesión, que nuestro sistema de inicio de sesión conserva hasta que cierras sesión o caducan.',
          'cvp.theme: tu elección de colores claros u oscuros.',
          'cvp.autoplay-next: si el siguiente video de un evento empieza solo.',
          'cvp.uploads-in-progress: qué subidas no terminaron, para que puedan continuar donde quedaron.',
          'cvp.return-to: la página a la que volver después de iniciar sesión, por ejemplo una invitación. Solo se conserva hasta que cierras la pestaña.',
        ],
      },
      {
        heading: 'Cómo eliminarlas',
        paragraphs: [
          'Al cerrar sesión se elimina tu sesión. Puedes borrar todo lo demás cuando quieras desde la configuración de tu navegador, en cookies y datos de sitios; la aplicación volverá entonces a sus valores por defecto.',
        ],
      },
    ],
  },
};
