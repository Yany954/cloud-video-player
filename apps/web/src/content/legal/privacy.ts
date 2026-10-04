import { CONTACT_EMAIL, type LocalizedDocument } from './types';

// Describes what the app really does. When the app changes what it stores or who can see it,
// change this text in both languages and update LEGAL_UPDATED.

export const privacy: LocalizedDocument = {
  en: {
    title: 'Privacy policy',
    description: 'What Cloud Video Player stores about you, who can see it, and how to delete it.',
    intro: [
      'Cloud Video Player is a private place to store and watch the videos you film at concerts and events. It is run as an independent project from the United States. This policy says what we store, why, who can see it, and what you can do about it.',
      `If anything here is unclear, write to ${CONTACT_EMAIL}.`,
    ],
    sections: [
      {
        heading: 'What we store',
        items: [
          'Your account: your email address. Your password is kept by our sign-in provider in a form we cannot read.',
          'Your videos: the files you upload, a playable copy and a preview image made from each one, and its title, file name, size, length and upload date.',
          'Your events: their names, which videos are in them and in what order, and who you invited.',
          'What you do for safety: the videos you report (with the reason and note you give) and the people you block.',
          'How much storage you use.',
          'Technical records: when our system handles a request it records technical details such as account and video identifiers and errors. These records are deleted after 14 days. Our hosting provider also processes your IP address in order to deliver pages and videos to you.',
        ],
        closing: [
          'We do not ask for your name, phone number, address or payment details. We use no analytics, advertising or tracking tools, and we do not sell or rent personal data.',
        ],
      },
      {
        heading: 'Why we store it',
        paragraphs: [
          'Only to run the service: to sign you in, to keep and play your videos, to show them to the people allowed to see them, to keep the service safe, and to answer you when you write to us.',
        ],
      },
      {
        heading: 'Who can see what',
        items: [
          'You always see your own videos.',
          'Administrators of this service review every uploaded video before other people can see it. To do that they can watch any uploaded video. They also see the email address of each account, and the email address of anyone who reports a video.',
          'A video you put in an event is visible only to the people in that event, once an administrator has approved it.',
          'A video that is not in an event is visible to every signed-in user once an administrator has approved it.',
          'If you own an event, you see the email address of each person who joins it. If you join an event, its owner sees yours.',
          'Nobody outside the service can open your videos. Links to video files are created for one viewer and stop working after a few hours.',
        ],
      },
      {
        heading: 'Service providers',
        paragraphs: [
          'The service runs on Amazon Web Services (AWS), in data centres in the United States. AWS stores the files and records, runs the sign-in system and sends its emails (confirmation codes, invitations and password resets). AWS acts on our instructions and does not use your data for its own purposes.',
          'We share data with no one else, unless a law or a valid legal order requires it.',
        ],
      },
      {
        heading: 'How long we keep it',
        items: [
          'Your videos and events stay until you delete them or delete your account.',
          'Deleting a video removes its files and its record at once.',
          'Deleting your account removes your videos, the events you own, your place in other people’s events, the list of people you blocked and your sign-in account. Videos that other people added to your events stay with those people.',
          'A backup of the records (not of the video files) is kept for up to 35 days so the service can recover from a failure, and is then overwritten.',
          'Reports you made about other people’s videos are kept while those videos exist.',
        ],
      },
      {
        heading: 'Your choices and rights',
        items: [
          'See and change: your profile page shows your email address and storage use, and lets you change your password.',
          'Delete: remove any video from “Your videos”, or your whole account from your profile page.',
          'Ask: write to us to get a copy of your data, to correct it, or to ask any question about it. We answer within 30 days.',
        ],
        closing: [
          'Depending on where you live (for example the European Union, the United Kingdom, Colombia or California), the law may give you further rights, such as objecting to a use of your data or complaining to your data protection authority. We honour those rights wherever you live.',
        ],
      },
      {
        heading: 'Children and people in your videos',
        paragraphs: [
          'You must be at least 13 years old to have an account. If you are under 18, you need the permission of a parent or guardian. We do not knowingly keep accounts of children under 13; if you believe one exists, write to us and we will delete it.',
          'Videos of concerts and family events often show other people, including children. Upload only videos you have the right to keep and share, and respect the wishes of the people in them. If you appear in a video here and want it removed, write to us.',
        ],
      },
      {
        heading: 'Security',
        paragraphs: [
          'Everything travels over encrypted connections, and files and records are encrypted where they are stored. Video files are kept private and can be reached only through time-limited links. No system is perfectly secure: if we learn of a breach that affects you, we will tell you.',
        ],
      },
      {
        heading: 'Cookies and browser storage',
        paragraphs: [
          'We store only what the service needs to work: your sign-in session and your language and appearance choices. The cookie policy lists each item.',
        ],
      },
      {
        heading: 'Changes to this policy',
        paragraphs: [
          'If we change how we handle your data, we will update this page and its date. For an important change we will also tell you in the app or by email before it takes effect.',
        ],
      },
    ],
  },
  es: {
    title: 'Política de privacidad',
    description: 'Qué guarda Cloud Video Player sobre ti, quién puede verlo y cómo eliminarlo.',
    intro: [
      'Cloud Video Player es un lugar privado para guardar y ver los videos que grabas en conciertos y eventos. Es un proyecto independiente operado desde Estados Unidos. Esta política explica qué guardamos, para qué, quién puede verlo y qué puedes hacer al respecto.',
      `Si algo no queda claro, escribe a ${CONTACT_EMAIL}.`,
    ],
    sections: [
      {
        heading: 'Qué guardamos',
        items: [
          'Tu cuenta: tu correo electrónico. Tu contraseña la guarda nuestro proveedor de inicio de sesión de una forma que no podemos leer.',
          'Tus videos: los archivos que subes, una copia reproducible y una imagen de vista previa creadas a partir de cada uno, y su título, nombre de archivo, tamaño, duración y fecha de subida.',
          'Tus eventos: sus nombres, qué videos contienen y en qué orden, y a quién invitaste.',
          'Lo que haces por seguridad: los videos que reportas (con el motivo y la nota que escribes) y las personas que bloqueas.',
          'Cuánto almacenamiento usas.',
          'Registros técnicos: cuando nuestro sistema atiende una solicitud, registra detalles técnicos como identificadores de cuenta y de video, y errores. Estos registros se eliminan a los 14 días. Nuestro proveedor de alojamiento también procesa tu dirección IP para poder entregarte las páginas y los videos.',
        ],
        closing: [
          'No pedimos tu nombre, teléfono, dirección ni datos de pago. No usamos herramientas de analítica, publicidad ni rastreo, y no vendemos ni alquilamos datos personales.',
        ],
      },
      {
        heading: 'Para qué lo guardamos',
        paragraphs: [
          'Solo para prestar el servicio: iniciar tu sesión, conservar y reproducir tus videos, mostrarlos a las personas que pueden verlos, mantener el servicio seguro y responderte cuando nos escribes.',
        ],
      },
      {
        heading: 'Quién puede ver qué',
        items: [
          'Tú siempre ves tus propios videos.',
          'Los administradores de este servicio revisan cada video subido antes de que otras personas puedan verlo. Para ello pueden ver cualquier video subido. También ven el correo electrónico de cada cuenta, y el de quien reporta un video.',
          'Un video que pones en un evento solo lo ven las personas de ese evento, una vez que un administrador lo aprueba.',
          'Un video que no está en un evento lo ven todos los usuarios con sesión iniciada, una vez que un administrador lo aprueba.',
          'Si un evento es tuyo, ves el correo electrónico de cada persona que se une. Si te unes a un evento, su dueño ve el tuyo.',
          'Nadie fuera del servicio puede abrir tus videos. Los enlaces a los archivos de video se crean para una sola persona y dejan de funcionar a las pocas horas.',
        ],
      },
      {
        heading: 'Proveedores del servicio',
        paragraphs: [
          'El servicio funciona en Amazon Web Services (AWS), en centros de datos de Estados Unidos. AWS guarda los archivos y los registros, opera el sistema de inicio de sesión y envía sus correos (códigos de confirmación, invitaciones y restablecimiento de contraseña). AWS actúa siguiendo nuestras instrucciones y no usa tus datos para fines propios.',
          'No compartimos datos con nadie más, salvo que una ley o una orden legal válida lo exija.',
        ],
      },
      {
        heading: 'Cuánto tiempo lo conservamos',
        items: [
          'Tus videos y eventos se conservan hasta que los elimines o elimines tu cuenta.',
          'Eliminar un video borra de inmediato sus archivos y su registro.',
          'Eliminar tu cuenta borra tus videos, los eventos que te pertenecen, tu lugar en los eventos de otras personas, la lista de personas que bloqueaste y tu cuenta de inicio de sesión. Los videos que otras personas agregaron a tus eventos se quedan con esas personas.',
          'Una copia de seguridad de los registros (no de los archivos de video) se conserva hasta 35 días para que el servicio pueda recuperarse de una falla, y luego se sobrescribe.',
          'Los reportes que hiciste sobre videos de otras personas se conservan mientras esos videos existan.',
        ],
      },
      {
        heading: 'Tus opciones y derechos',
        items: [
          'Ver y cambiar: tu página de perfil muestra tu correo electrónico y tu uso de almacenamiento, y te permite cambiar tu contraseña.',
          'Eliminar: borra cualquier video desde «Tus videos», o toda tu cuenta desde tu página de perfil.',
          'Preguntar: escríbenos para obtener una copia de tus datos, corregirlos o hacer cualquier consulta sobre ellos. Respondemos en un plazo de 30 días.',
        ],
        closing: [
          'Según dónde vivas (por ejemplo, la Unión Europea, el Reino Unido, Colombia o California), la ley puede darte más derechos, como oponerte a un uso de tus datos o presentar una queja ante tu autoridad de protección de datos. Respetamos esos derechos vivas donde vivas.',
        ],
      },
      {
        heading: 'Menores de edad y personas que aparecen en tus videos',
        paragraphs: [
          'Debes tener al menos 13 años para tener una cuenta. Si eres menor de 18 años, necesitas el permiso de tu madre, padre o tutor. No conservamos a sabiendas cuentas de menores de 13 años; si crees que existe alguna, escríbenos y la eliminaremos.',
          'Los videos de conciertos y eventos familiares suelen mostrar a otras personas, incluidos niños. Sube solo videos que tengas derecho a conservar y compartir, y respeta los deseos de quienes aparecen en ellos. Si apareces en un video aquí y quieres que se retire, escríbenos.',
        ],
      },
      {
        heading: 'Seguridad',
        paragraphs: [
          'Todo viaja por conexiones cifradas, y los archivos y registros están cifrados donde se guardan. Los archivos de video son privados y solo se accede a ellos mediante enlaces de duración limitada. Ningún sistema es perfectamente seguro: si sabemos de una brecha que te afecte, te avisaremos.',
        ],
      },
      {
        heading: 'Cookies y almacenamiento del navegador',
        paragraphs: [
          'Solo guardamos lo que el servicio necesita para funcionar: tu sesión y tus preferencias de idioma y apariencia. La política de cookies detalla cada elemento.',
        ],
      },
      {
        heading: 'Cambios en esta política',
        paragraphs: [
          'Si cambiamos la forma en que tratamos tus datos, actualizaremos esta página y su fecha. Si el cambio es importante, también te avisaremos en la aplicación o por correo antes de que entre en vigor.',
        ],
      },
    ],
  },
};
