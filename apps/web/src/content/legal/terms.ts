import { CONTACT_EMAIL, type LocalizedDocument } from './types';

// The rules for using the app. Keep both languages saying the same thing, and update
// LEGAL_UPDATED when they change.

export const terms: LocalizedDocument = {
  en: {
    title: 'Terms of service',
    description: 'The rules for using Cloud Video Player, including what may not be uploaded.',
    intro: [
      'These terms are the agreement between you and Cloud Video Player, an independent project run from the United States, for using this service. By creating an account you accept them.',
      `Questions: ${CONTACT_EMAIL}.`,
    ],
    sections: [
      {
        heading: 'Who can use the service',
        paragraphs: [
          'You must be at least 13 years old. If you are under 18, or under the age of majority where you live, you need the permission of a parent or guardian, who accepts these terms for you.',
          'Use your own email address, keep your password to yourself, and tell us if you think someone else is using your account. You are responsible for what is done with it.',
        ],
      },
      {
        heading: 'Your videos stay yours',
        paragraphs: [
          'You keep every right you have in the videos you upload. You give us only the permission we need to run the service for you: to store your videos, to make a playable copy and a preview image, and to show them to the people allowed to see them under these terms. That permission ends when you delete the video or your account.',
          'You promise that you have the right to upload and share each video. Recordings of concerts and shows can include music, performances and images that belong to other people; keeping and sharing them is your responsibility.',
        ],
      },
      {
        heading: 'What you may not upload or do',
        items: [
          'Sexual content or nudity.',
          'Any sexual or exploitative content involving a minor. We report it to the authorities and close the account.',
          'Violence, cruelty, or content that promotes harm to people or animals.',
          'Harassment, threats, or hatred against people for who they are.',
          'Content that is illegal, or that invades someone’s privacy, such as recordings of people in private places without their consent.',
          'Content you have no right to share.',
          'Files that are not videos, or anything meant to damage or overload the service.',
          'Using the service to get around its limits, to reach other people’s content without permission, or to collect data about its users.',
        ],
      },
      {
        heading: 'Review, reports and blocking',
        paragraphs: [
          'Every upload is reviewed by an administrator before anyone else can see it. To do that, administrators can watch any uploaded video.',
          'Anyone who can see a video can report it. A reported video is hidden until an administrator has looked at it. You can also stop seeing a person’s videos by blocking them.',
          'We may refuse or remove any video, and suspend or delete any account, that breaks these terms or the law.',
        ],
      },
      {
        heading: 'Copyright complaints',
        paragraphs: [
          `If you believe a video here infringes your copyright, write to ${CONTACT_EMAIL} with your name, what the work is, where the video is, and a statement that you are the owner or act for them. We will review it and remove what infringes.`,
        ],
      },
      {
        heading: 'Storage and availability',
        paragraphs: [
          'Each account has a storage limit, shown in the app. We may change the limit for new uploads.',
          'The service is free of charge today. If paid plans are ever offered, the full price will be shown before you pay, and nothing will be charged without your explicit agreement.',
          'We work to keep the service running and your videos safe, but we cannot promise it will always be available or free of errors. Do not make it the only copy of a video you cannot afford to lose.',
        ],
      },
      {
        heading: 'Ending your use',
        paragraphs: [
          'You can delete any video, or your whole account and its data, at any time from the app. We may suspend or close an account that breaks these terms; where we reasonably can, we will tell you why.',
          'If we ever stop the service, we will give you reasonable notice so you can download or re-upload your videos elsewhere.',
        ],
      },
      {
        heading: 'Responsibility',
        paragraphs: [
          'The service is provided “as is”. To the extent the law allows, we are not liable for indirect losses, for lost data, or for content uploaded by other people. Nothing in these terms limits rights that the law of your country does not allow to be limited.',
        ],
      },
      {
        heading: 'Law and changes',
        paragraphs: [
          'These terms are governed by the laws of the United States, without removing any protection that the consumer law of your own country gives you.',
          'If we change these terms we will update this page and its date, and for an important change we will tell you in the app or by email before it takes effect. If you keep using the service after that, you accept the new terms; if you do not agree, you can delete your account.',
        ],
      },
    ],
  },
  es: {
    title: 'Términos del servicio',
    description: 'Las reglas para usar Cloud Video Player, incluido lo que no se puede subir.',
    intro: [
      'Estos términos son el acuerdo entre tú y Cloud Video Player, un proyecto independiente operado desde Estados Unidos, para usar este servicio. Al crear una cuenta los aceptas.',
      `Preguntas: ${CONTACT_EMAIL}.`,
    ],
    sections: [
      {
        heading: 'Quién puede usar el servicio',
        paragraphs: [
          'Debes tener al menos 13 años. Si eres menor de 18 años, o menor de edad según la ley del lugar donde vives, necesitas el permiso de tu madre, padre o tutor, quien acepta estos términos en tu nombre.',
          'Usa tu propio correo electrónico, no compartas tu contraseña y avísanos si crees que otra persona está usando tu cuenta. Eres responsable de lo que se haga con ella.',
        ],
      },
      {
        heading: 'Tus videos siguen siendo tuyos',
        paragraphs: [
          'Conservas todos los derechos que tengas sobre los videos que subes. Solo nos das el permiso que necesitamos para prestarte el servicio: guardar tus videos, crear una copia reproducible y una imagen de vista previa, y mostrarlos a las personas que pueden verlos según estos términos. Ese permiso termina cuando eliminas el video o tu cuenta.',
          'Garantizas que tienes derecho a subir y compartir cada video. Las grabaciones de conciertos y espectáculos pueden incluir música, interpretaciones e imágenes que pertenecen a otras personas; conservarlas y compartirlas es tu responsabilidad.',
        ],
      },
      {
        heading: 'Lo que no puedes subir ni hacer',
        items: [
          'Contenido sexual o desnudos.',
          'Cualquier contenido sexual o de explotación que involucre a un menor de edad. Lo denunciamos ante las autoridades y cerramos la cuenta.',
          'Violencia, crueldad o contenido que promueva el daño a personas o animales.',
          'Acoso, amenazas u odio contra las personas por ser quienes son.',
          'Contenido ilegal, o que invada la privacidad de alguien, como grabaciones de personas en lugares privados sin su consentimiento.',
          'Contenido que no tengas derecho a compartir.',
          'Archivos que no sean videos, o cualquier cosa pensada para dañar o sobrecargar el servicio.',
          'Usar el servicio para saltarte sus límites, para acceder sin permiso al contenido de otras personas o para recopilar datos de sus usuarios.',
        ],
      },
      {
        heading: 'Revisión, reportes y bloqueos',
        paragraphs: [
          'Un administrador revisa cada video subido antes de que otra persona pueda verlo. Para ello, los administradores pueden ver cualquier video subido.',
          'Cualquier persona que pueda ver un video puede reportarlo. Un video reportado queda oculto hasta que un administrador lo revise. También puedes dejar de ver los videos de una persona bloqueándola.',
          'Podemos rechazar o retirar cualquier video, y suspender o eliminar cualquier cuenta, que incumpla estos términos o la ley.',
        ],
      },
      {
        heading: 'Reclamos de derechos de autor',
        paragraphs: [
          `Si crees que un video publicado aquí infringe tus derechos de autor, escribe a ${CONTACT_EMAIL} indicando tu nombre, cuál es la obra, dónde está el video y una declaración de que eres el titular o actúas en su nombre. Lo revisaremos y retiraremos lo que infrinja.`,
        ],
      },
      {
        heading: 'Almacenamiento y disponibilidad',
        paragraphs: [
          'Cada cuenta tiene un límite de almacenamiento, que se muestra en la aplicación. Podemos cambiar el límite para las subidas nuevas.',
          'Hoy el servicio es gratuito. Si alguna vez se ofrecen planes de pago, el precio completo se mostrará antes de pagar y no se cobrará nada sin tu aceptación expresa.',
          'Trabajamos para mantener el servicio en funcionamiento y tus videos a salvo, pero no podemos prometer que siempre estará disponible ni libre de errores. No lo conviertas en la única copia de un video que no puedes permitirte perder.',
        ],
      },
      {
        heading: 'Dejar de usar el servicio',
        paragraphs: [
          'Puedes eliminar cualquier video, o toda tu cuenta con sus datos, en cualquier momento desde la aplicación. Podemos suspender o cerrar una cuenta que incumpla estos términos; cuando sea razonablemente posible, te diremos por qué.',
          'Si alguna vez dejamos de ofrecer el servicio, te avisaremos con una antelación razonable para que puedas descargar tus videos o subirlos a otro lugar.',
        ],
      },
      {
        heading: 'Responsabilidad',
        paragraphs: [
          'El servicio se ofrece «tal cual». En la medida en que la ley lo permita, no respondemos por pérdidas indirectas, por datos perdidos ni por el contenido subido por otras personas. Nada en estos términos limita los derechos que la ley de tu país no permite limitar.',
        ],
      },
      {
        heading: 'Ley aplicable y cambios',
        paragraphs: [
          'Estos términos se rigen por las leyes de Estados Unidos, sin quitarte ninguna protección que te otorgue la ley de protección al consumidor de tu país.',
          'Si cambiamos estos términos, actualizaremos esta página y su fecha, y si el cambio es importante te avisaremos en la aplicación o por correo antes de que entre en vigor. Si sigues usando el servicio después de eso, aceptas los términos nuevos; si no estás de acuerdo, puedes eliminar tu cuenta.',
        ],
      },
    ],
  },
};
