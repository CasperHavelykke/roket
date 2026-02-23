import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { useTheme } from '../theme';

const policyDA = `Privatlivspolitik

Denne privatlivspolitik gælder for Røket-appen (herefter kaldet "Applikationen") til mobile enheder, som er skabt af Casper Larsen (herefter kaldet "Tjenesteudbyderen") som en annoncestøttet tjeneste. Denne tjeneste er beregnet til brug "SOM DEN ER".

Indsamling og brug af oplysninger

Applikationen indsamler oplysninger, når du downloader og bruger den. Disse oplysninger kan omfatte information såsom:

• Din enheds internetprotokol-adresse (f.eks. IP-adresse)
• De sider i Applikationen, du besøger, tidspunktet og datoen for dit besøg, og den tid du bruger på disse sider
• Den tid du bruger på Applikationen
• Det operativsystem du bruger på din mobile enhed

Applikationen indsamler desuden følgende personlige oplysninger:

• E-mailadresse (til kontooprettelse og login)
• Visningsnavn og bio (til din offentlige profil)
• Fødselsdato (til aldersverifikation og valgfri visning af alder)
• Køn og seksualitet (valgfrit, til din profil)
• Profilbilleder og chatbilleder (gemt på Google Firebase Storage)
• Chatbeskeder (gemt på Google Firebase Firestore)
• Push notification-token (til levering af beskednotifikationer)

Placeringsdata

Applikationen indsamler din enheds placering, mens appen er i brug, for at vise brugere i nærheden. Placeringsdata indsamles ikke når appen er lukket eller kører i baggrunden.

Placeringsdata bruges på følgende måder:

• Nærhedsvisning: Din placering bruges til at vise dig andre brugere i nærheden og til at vise dem din omtrentlige afstand.
• Placeringsdata gemmes på Google Firebase Firestore og opdateres mens du bruger Applikationen.

Tjenesteudbyderen kan bruge de oplysninger, du har givet, til at kontakte dig fra tid til anden for at give dig vigtige oplysninger, påkrævede meddelelser og markedsføringsmateriale.

Tredjepartsadgang

Applikationen bruger Google Firebase som sin backend-tjeneste til godkendelse, datalagring, fillagring og push-notifikationer. Dine data behandles og opbevares på Googles servere i overensstemmelse med Googles databehandlingsvilkår. Google sælger ikke dine personlige data.

Tjenesteudbyderen kan videregive brugerleverede og automatisk indsamlede oplysninger:

• som krævet ved lov, f.eks. for at efterkomme en stævning eller lignende juridisk proces;
• når de i god tro mener, at videregivelse er nødvendig for at beskytte deres rettigheder, beskytte din sikkerhed eller andres sikkerhed, efterforske svindel eller besvare en anmodning fra en offentlig myndighed;
• med deres betroede tjenesteudbydere, der arbejder på deres vegne, ikke har en uafhængig brug af de oplysninger, vi videregiver til dem, og har accepteret at overholde reglerne i denne privatlivserklæring.

Fravalgsrettigheder

Du kan stoppe al indsamling af oplysninger fra Applikationen ved blot at afinstallere den. Du kan bruge de standard afinstallationsprocesser, der er tilgængelige som en del af din mobile enhed eller via app-markedspladsen.

Dataopbevaringspolitik

Tjenesteudbyderen vil opbevare brugerleverede data, så længe du bruger Applikationen og i en rimelig tid derefter. Du kan slette din konto og alle tilknyttede data direkte i Applikationen via Indstillinger > Slet konto. Du kan også kontakte os på casper.roket@proton.me, og vi vil svare inden for rimelig tid.

Ved kontosletning fjernes følgende data permanent: din profil, chatbeskeder, profilbilleder, feedback og rapporter.

Alderskrav og børnesikkerhed

Applikationen er udelukkende beregnet til brugere, der er mindst 18 år. Tjenesteudbyderen indsamler ikke bevidst personligt identificerbare oplysninger fra personer under 18 år og markedsfører ikke til mindreårige.

Tjenesteudbyderen har en streng nul-tolerance-politik overfor seksuelt misbrug og udnyttelse af børn (CSAE). Alt bruger-uploadet indhold scannes automatisk. Materiale der mistænkes for at indeholde seksuelt indhold med mindreårige (CSAM) rapporteres til relevante myndigheder.

Hvis du har grund til at tro, at en person under 18 år bruger Applikationen, eller at Applikationen bruges til at udnytte mindreårige, bedes du straks kontakte os på support@roketapp.eu.

Sikkerhed

Tjenesteudbyderen er optaget af at beskytte fortroligheden af dine oplysninger. Tjenesteudbyderen har fysiske, elektroniske og proceduremæssige sikkerhedsforanstaltninger til at beskytte de oplysninger, Tjenesteudbyderen behandler og vedligeholder. Data overføres via krypterede forbindelser og opbevares på sikre servere hos Google Firebase.

Ændringer

Denne privatlivspolitik kan opdateres fra tid til anden af enhver grund. Tjenesteudbyderen vil informere dig om eventuelle ændringer i privatlivspolitikken ved at opdatere denne side med den nye privatlivspolitik. Du rådes til at konsultere denne privatlivspolitik regelmæssigt for eventuelle ændringer, da fortsat brug anses som godkendelse af alle ændringer.

Denne privatlivspolitik er gældende fra 2026-02-18.

Dit samtykke

Ved at bruge Applikationen giver du samtykke til behandling af dine oplysninger som beskrevet i denne privatlivspolitik nu og som ændret af os.

Kontakt os

Hvis du har spørgsmål vedrørende privatlivets fred, mens du bruger Applikationen, eller har spørgsmål om praksis, bedes du kontakte Tjenesteudbyderen via e-mail på casper.roket@proton.me.`;

const policyEN = `Privacy Policy

This privacy policy applies to the Røket app (hereby referred to as "Application") for mobile devices that was created by Casper Larsen (hereby referred to as "Service Provider") as an Ad Supported service. This service is intended for use "AS IS".

Information Collection and Use

The Application collects information when you download and use it. This information may include information such as:

• Your device's Internet Protocol address (e.g. IP address)
• The pages of the Application that you visit, the time and date of your visit, the time spent on those pages
• The time spent on the Application
• The operating system you use on your mobile device

The Application also collects the following personal information:

• Email address (for account creation and login)
• Display name and bio (for your public profile)
• Date of birth (for age verification and optional age display)
• Gender and sexuality (optional, for your profile)
• Profile photos and chat images (stored on Google Firebase Storage)
• Chat messages (stored on Google Firebase Firestore)
• Push notification token (for delivering message notifications)

Location Data

The Application collects your device's location while the app is in use, to show nearby users. Location data is not collected when the app is closed or running in the background.

Location data is used in the following ways:

• Proximity display: Your location is used to show you other users nearby and to show them your approximate distance.
• Location data is stored on Google Firebase Firestore and updated while you are using the Application.

The Service Provider may use the information you provided to contact you from time to time to provide you with important information, required notices and marketing promotions.

Third Party Access

The Application uses Google Firebase as its backend service for authentication, data storage, file storage and push notifications. Your data is processed and stored on Google's servers in accordance with Google's data processing terms. Google does not sell your personal data.

The Service Provider may disclose User Provided and Automatically Collected Information:

• as required by law, such as to comply with a subpoena, or similar legal process;
• when they believe in good faith that disclosure is necessary to protect their rights, protect your safety or the safety of others, investigate fraud, or respond to a government request;
• with their trusted services providers who work on their behalf, do not have an independent use of the information we disclose to them, and have agreed to adhere to the rules set forth in this privacy statement.

Opt-Out Rights

You can stop all collection of information by the Application easily by uninstalling it. You may use the standard uninstall processes as may be available as part of your mobile device or via the mobile application marketplace or network.

Data Retention Policy

The Service Provider will retain User Provided data for as long as you use the Application and for a reasonable time thereafter. You can delete your account and all associated data directly in the Application via Settings > Delete Account. You may also contact us at casper.roket@proton.me and we will respond in a reasonable time.

Upon account deletion, the following data is permanently removed: your profile, chat messages, profile photos, feedback and reports.

Age Requirement and Child Safety

The Application is intended exclusively for users who are at least 18 years old. The Service Provider does not knowingly collect personally identifiable information from persons under 18 and does not market to minors.

The Service Provider has a strict zero-tolerance policy towards child sexual abuse and exploitation (CSAE). All user-uploaded content is automatically scanned. Material suspected of containing sexual content involving minors (CSAM) is reported to relevant authorities.

If you have reason to believe that a person under 18 is using the Application, or that the Application is being used to exploit minors, please contact us immediately at support@roketapp.eu.

Security

The Service Provider is concerned about safeguarding the confidentiality of your information. The Service Provider provides physical, electronic, and procedural safeguards to protect information the Service Provider processes and maintains. Data is transmitted via encrypted connections and stored on secure Google Firebase servers.

Changes

This Privacy Policy may be updated from time to time for any reason. The Service Provider will notify you of any changes to the Privacy Policy by updating this page with the new Privacy Policy. You are advised to consult this Privacy Policy regularly for any changes, as continued use is deemed approval of all changes.

This privacy policy is effective as of 2026-02-18.

Your Consent

By using the Application, you are consenting to the processing of your information as set forth in this Privacy Policy now and as amended by us.

Contact Us

If you have any questions regarding privacy while using the Application, or have questions about the practices, please contact the Service Provider via email at casper.roket@proton.me.`;

const policyES = `Política de privacidad

Esta política de privacidad se aplica a la aplicación Røket (en adelante denominada "Aplicación") para dispositivos móviles, creada por Casper Larsen (en adelante denominado "Proveedor del Servicio") como un servicio con publicidad. Este servicio está destinado a ser utilizado "TAL CUAL".

Recopilación y uso de información

La Aplicación recopila información cuando la descargas y la utilizas. Esta información puede incluir datos como:

• La dirección de Protocolo de Internet de tu dispositivo (por ejemplo, dirección IP)
• Las páginas de la Aplicación que visitas, la hora y fecha de tu visita, y el tiempo que pasas en esas páginas
• El tiempo que pasas en la Aplicación
• El sistema operativo que utilizas en tu dispositivo móvil

La Aplicación también recopila la siguiente información personal:

• Dirección de correo electrónico (para la creación de cuenta e inicio de sesión)
• Nombre visible y bio (para tu perfil público)
• Fecha de nacimiento (para verificación de edad y visualización opcional de edad)
• Género y sexualidad (opcional, para tu perfil)
• Fotos de perfil e imágenes de chat (almacenadas en Google Firebase Storage)
• Mensajes de chat (almacenados en Google Firebase Firestore)
• Token de notificaciones push (para la entrega de notificaciones de mensajes)

Datos de ubicación

La Aplicación recopila la ubicación de tu dispositivo mientras la app está en uso, para mostrar usuarios cercanos. Los datos de ubicación no se recopilan cuando la app está cerrada o funcionando en segundo plano.

Los datos de ubicación se utilizan de las siguientes maneras:

• Visualización de proximidad: Tu ubicación se utiliza para mostrarte otros usuarios cercanos y para mostrarles tu distancia aproximada.
• Los datos de ubicación se almacenan en Google Firebase Firestore y se actualizan mientras utilizas la Aplicación.

El Proveedor del Servicio puede utilizar la información que proporcionaste para contactarte de vez en cuando para proporcionarte información importante, avisos requeridos y promociones de marketing.

Acceso de terceros

La Aplicación utiliza Google Firebase como su servicio de backend para autenticación, almacenamiento de datos, almacenamiento de archivos y notificaciones push. Tus datos se procesan y almacenan en los servidores de Google de acuerdo con los términos de procesamiento de datos de Google. Google no vende tus datos personales.

El Proveedor del Servicio puede divulgar información proporcionada por el usuario y recopilada automáticamente:

• según lo requiera la ley, como para cumplir con una citación u otro proceso legal similar;
• cuando crean de buena fe que la divulgación es necesaria para proteger sus derechos, proteger tu seguridad o la seguridad de otros, investigar fraude o responder a una solicitud gubernamental;
• con sus proveedores de servicios de confianza que trabajan en su nombre, no tienen un uso independiente de la información que les divulgamos y han aceptado cumplir con las reglas establecidas en esta declaración de privacidad.

Derechos de exclusión

Puedes detener toda la recopilación de información por parte de la Aplicación simplemente desinstalándola. Puedes utilizar los procesos de desinstalación estándar disponibles como parte de tu dispositivo móvil o a través de la tienda de aplicaciones móviles.

Política de retención de datos

El Proveedor del Servicio conservará los datos proporcionados por el usuario mientras utilices la Aplicación y durante un tiempo razonable después. Puedes eliminar tu cuenta y todos los datos asociados directamente en la Aplicación a través de Ajustes > Eliminar cuenta. También puedes contactarnos en casper.roket@proton.me y responderemos en un tiempo razonable.

Al eliminar la cuenta, se eliminan permanentemente los siguientes datos: tu perfil, mensajes de chat, fotos de perfil, comentarios y reportes.

Requisito de edad y seguridad infantil

La Aplicación está destinada exclusivamente a usuarios que tengan al menos 18 años. El Proveedor del Servicio no recopila conscientemente información de identificación personal de personas menores de 18 años y no comercializa a menores.

El Proveedor del Servicio tiene una estricta política de tolerancia cero hacia el abuso y la explotación sexual infantil (CSAE). Todo el contenido subido por usuarios se escanea automáticamente. El material sospechoso de contener contenido sexual que involucre a menores (CSAM) se reporta a las autoridades pertinentes.

Si tienes razones para creer que una persona menor de 18 años está utilizando la Aplicación, o que la Aplicación se está utilizando para explotar a menores, contáctanos inmediatamente en support@roketapp.eu.

Seguridad

El Proveedor del Servicio se preocupa por proteger la confidencialidad de tu información. El Proveedor del Servicio proporciona medidas de seguridad físicas, electrónicas y procedimentales para proteger la información que procesa y mantiene. Los datos se transmiten a través de conexiones cifradas y se almacenan en servidores seguros de Google Firebase.

Cambios

Esta Política de Privacidad puede actualizarse de vez en cuando por cualquier motivo. El Proveedor del Servicio te notificará cualquier cambio en la Política de Privacidad actualizando esta página con la nueva Política de Privacidad. Se te recomienda consultar esta Política de Privacidad regularmente para cualquier cambio, ya que el uso continuado se considera aprobación de todos los cambios.

Esta política de privacidad es efectiva a partir del 2026-02-18.

Tu consentimiento

Al utilizar la Aplicación, estás consintiendo el procesamiento de tu información según lo establecido en esta Política de Privacidad ahora y según sea modificada por nosotros.

Contáctanos

Si tienes alguna pregunta sobre la privacidad mientras utilizas la Aplicación, o tienes preguntas sobre las prácticas, por favor contacta al Proveedor del Servicio por correo electrónico en casper.roket@proton.me.`;

const policyDE = `Datenschutzrichtlinie

Diese Datenschutzrichtlinie gilt für die Røket-App (im Folgenden als „Anwendung" bezeichnet) für mobile Geräte, die von Casper Larsen (im Folgenden als „Dienstanbieter" bezeichnet) als werbefinanzierter Dienst erstellt wurde. Dieser Dienst ist zur Nutzung „WIE BESEHEN" bestimmt.

Erhebung und Verwendung von Informationen

Die Anwendung erhebt Informationen, wenn Sie sie herunterladen und verwenden. Diese Informationen können Daten wie folgt umfassen:

• Die Internet-Protokoll-Adresse Ihres Geräts (z. B. IP-Adresse)
• Die Seiten der Anwendung, die Sie besuchen, Uhrzeit und Datum Ihres Besuchs sowie die auf diesen Seiten verbrachte Zeit
• Die in der Anwendung verbrachte Zeit
• Das Betriebssystem, das Sie auf Ihrem mobilen Gerät verwenden

Die Anwendung erhebt außerdem folgende personenbezogene Daten:

• E-Mail-Adresse (für Kontoerstellung und Anmeldung)
• Anzeigename und Bio (für Ihr öffentliches Profil)
• Geburtsdatum (für Altersverifikation und optionale Altersanzeige)
• Geschlecht und Sexualität (optional, für Ihr Profil)
• Profilfotos und Chat-Bilder (gespeichert auf Google Firebase Storage)
• Chat-Nachrichten (gespeichert auf Google Firebase Firestore)
• Push-Benachrichtigungs-Token (für die Zustellung von Nachrichtenbenachrichtigungen)

Standortdaten

Die Anwendung erfasst den Standort Ihres Geräts während der Nutzung der App, um Nutzer in der Nähe anzuzeigen. Standortdaten werden nicht erfasst, wenn die App geschlossen ist oder im Hintergrund läuft.

Standortdaten werden folgendermaßen verwendet:

• Nähe-Anzeige: Ihr Standort wird verwendet, um Ihnen andere Nutzer in der Nähe anzuzeigen und ihnen Ihre ungefähre Entfernung zu zeigen.
• Standortdaten werden auf Google Firebase Firestore gespeichert und aktualisiert, während Sie die Anwendung nutzen.

Der Dienstanbieter kann die von Ihnen bereitgestellten Informationen verwenden, um Sie gelegentlich zu kontaktieren, um Ihnen wichtige Informationen, erforderliche Mitteilungen und Marketingaktionen zukommen zu lassen.

Zugriff durch Dritte

Die Anwendung verwendet Google Firebase als Backend-Dienst für Authentifizierung, Datenspeicherung, Dateispeicherung und Push-Benachrichtigungen. Ihre Daten werden auf Googles Servern gemäß den Datenverarbeitungsbedingungen von Google verarbeitet und gespeichert. Google verkauft Ihre personenbezogenen Daten nicht.

Der Dienstanbieter kann vom Nutzer bereitgestellte und automatisch erhobene Informationen offenlegen:

• soweit gesetzlich vorgeschrieben, z. B. zur Erfüllung einer Vorladung oder eines ähnlichen rechtlichen Verfahrens;
• wenn er in gutem Glauben der Ansicht ist, dass die Offenlegung zum Schutz seiner Rechte, zum Schutz Ihrer oder der Sicherheit anderer, zur Untersuchung von Betrug oder zur Beantwortung einer behördlichen Anfrage erforderlich ist;
• an vertrauenswürdige Dienstleister, die in seinem Auftrag arbeiten, die offengelegten Informationen nicht eigenständig nutzen und sich zur Einhaltung der in dieser Datenschutzerklärung dargelegten Regeln verpflichtet haben.

Opt-Out-Rechte

Sie können die Erhebung aller Informationen durch die Anwendung einfach durch Deinstallation beenden. Sie können die Standard-Deinstallationsverfahren verwenden, die als Teil Ihres mobilen Geräts oder über den App-Marktplatz verfügbar sind.

Datenaufbewahrungsrichtlinie

Der Dienstanbieter bewahrt vom Nutzer bereitgestellte Daten so lange auf, wie Sie die Anwendung nutzen, und für einen angemessenen Zeitraum danach. Sie können Ihr Konto und alle zugehörigen Daten direkt in der Anwendung über Einstellungen > Konto löschen entfernen. Sie können uns auch unter casper.roket@proton.me kontaktieren, und wir werden innerhalb einer angemessenen Frist antworten.

Bei der Kontolöschung werden folgende Daten dauerhaft entfernt: Ihr Profil, Chat-Nachrichten, Profilfotos, Feedback und Meldungen.

Altersanforderung und Kindersicherheit

Die Anwendung ist ausschließlich für Nutzer bestimmt, die mindestens 18 Jahre alt sind. Der Dienstanbieter erhebt wissentlich keine personenbezogenen Daten von Personen unter 18 Jahren und richtet sich nicht an Minderjährige.

Der Dienstanbieter verfolgt eine strenge Null-Toleranz-Politik gegenüber sexuellem Missbrauch und Ausbeutung von Kindern (CSAE). Alle von Nutzern hochgeladenen Inhalte werden automatisch gescannt. Material, das im Verdacht steht, sexuelle Inhalte mit Minderjährigen zu enthalten (CSAM), wird den zuständigen Behörden gemeldet.

Wenn Sie Grund zu der Annahme haben, dass eine Person unter 18 Jahren die Anwendung nutzt, oder dass die Anwendung zur Ausbeutung von Minderjährigen verwendet wird, kontaktieren Sie uns bitte umgehend unter support@roketapp.eu.

Sicherheit

Der Dienstanbieter ist um den Schutz der Vertraulichkeit Ihrer Informationen bemüht. Der Dienstanbieter bietet physische, elektronische und verfahrenstechnische Sicherheitsmaßnahmen zum Schutz der von ihm verarbeiteten und verwalteten Informationen. Daten werden über verschlüsselte Verbindungen übertragen und auf sicheren Google Firebase-Servern gespeichert.

Änderungen

Diese Datenschutzrichtlinie kann jederzeit und aus jedem Grund aktualisiert werden. Der Dienstanbieter wird Sie über Änderungen der Datenschutzrichtlinie informieren, indem er diese Seite mit der neuen Datenschutzrichtlinie aktualisiert. Es wird empfohlen, diese Datenschutzrichtlinie regelmäßig auf Änderungen zu überprüfen, da die fortgesetzte Nutzung als Zustimmung zu allen Änderungen gilt.

Diese Datenschutzrichtlinie gilt ab dem 18.02.2026.

Ihre Einwilligung

Durch die Nutzung der Anwendung stimmen Sie der Verarbeitung Ihrer Informationen zu, wie in dieser Datenschutzrichtlinie beschrieben und von uns geändert.

Kontakt

Wenn Sie Fragen zum Datenschutz während der Nutzung der Anwendung haben oder Fragen zu den Praktiken haben, kontaktieren Sie bitte den Dienstanbieter per E-Mail unter casper.roket@proton.me.`;

const policyFR = `Politique de confidentialité

Cette politique de confidentialité s'applique à l'application Røket (ci-après dénommée « Application ») pour appareils mobiles, créée par Casper Larsen (ci-après dénommé « Fournisseur de services ») en tant que service financé par la publicité. Ce service est destiné à être utilisé « TEL QUEL ».

Collecte et utilisation des informations

L'Application collecte des informations lorsque vous la téléchargez et l'utilisez. Ces informations peuvent inclure des données telles que :

• L'adresse de protocole Internet de votre appareil (par exemple, adresse IP)
• Les pages de l'Application que vous visitez, l'heure et la date de votre visite, et le temps passé sur ces pages
• Le temps passé sur l'Application
• Le système d'exploitation que vous utilisez sur votre appareil mobile

L'Application collecte également les informations personnelles suivantes :

• Adresse e-mail (pour la création de compte et la connexion)
• Nom d'affichage et bio (pour votre profil public)
• Date de naissance (pour la vérification de l'âge et l'affichage optionnel de l'âge)
• Genre et sexualité (optionnel, pour votre profil)
• Photos de profil et images de chat (stockées sur Google Firebase Storage)
• Messages de chat (stockés sur Google Firebase Firestore)
• Jeton de notification push (pour la livraison des notifications de messages)

Données de localisation

L'Application collecte la localisation de votre appareil pendant l'utilisation de l'app, pour afficher les utilisateurs à proximité. Les données de localisation ne sont pas collectées lorsque l'application est fermée ou fonctionne en arrière-plan.

Les données de localisation sont utilisées de la manière suivante :

• Affichage de proximité : Votre localisation est utilisée pour vous montrer d'autres utilisateurs à proximité et pour leur montrer votre distance approximative.
• Les données de localisation sont stockées sur Google Firebase Firestore et mises à jour pendant que vous utilisez l'Application.

Le Fournisseur de services peut utiliser les informations que vous avez fournies pour vous contacter de temps à autre afin de vous fournir des informations importantes, des avis requis et des promotions marketing.

Accès par des tiers

L'Application utilise Google Firebase comme service backend pour l'authentification, le stockage de données, le stockage de fichiers et les notifications push. Vos données sont traitées et stockées sur les serveurs de Google conformément aux conditions de traitement des données de Google. Google ne vend pas vos données personnelles.

Le Fournisseur de services peut divulguer les informations fournies par l'utilisateur et collectées automatiquement :

• tel que requis par la loi, par exemple pour se conformer à une assignation ou un processus juridique similaire ;
• lorsqu'il estime de bonne foi que la divulgation est nécessaire pour protéger ses droits, protéger votre sécurité ou celle d'autrui, enquêter sur une fraude ou répondre à une demande gouvernementale ;
• avec ses prestataires de services de confiance qui travaillent en son nom, n'ont pas d'utilisation indépendante des informations que nous leur divulguons et ont accepté de respecter les règles énoncées dans cette déclaration de confidentialité.

Droits de désinscription

Vous pouvez arrêter toute collecte d'informations par l'Application simplement en la désinstallant. Vous pouvez utiliser les processus de désinstallation standard disponibles sur votre appareil mobile ou via la boutique d'applications mobiles.

Politique de conservation des données

Le Fournisseur de services conservera les données fournies par l'utilisateur aussi longtemps que vous utilisez l'Application et pendant une durée raisonnable par la suite. Vous pouvez supprimer votre compte et toutes les données associées directement dans l'Application via Paramètres > Supprimer le compte. Vous pouvez également nous contacter à casper.roket@proton.me et nous répondrons dans un délai raisonnable.

Lors de la suppression du compte, les données suivantes sont définitivement supprimées : votre profil, vos messages de chat, vos photos de profil, vos commentaires et signalements.

Exigence d'âge et sécurité des enfants

L'Application est exclusivement destinée aux utilisateurs âgés d'au moins 18 ans. Le Fournisseur de services ne collecte pas sciemment d'informations personnellement identifiables auprès de personnes de moins de 18 ans et ne fait pas de marketing auprès des mineurs.

Le Fournisseur de services applique une politique stricte de tolérance zéro envers l'abus et l'exploitation sexuels des enfants (CSAE). Tout le contenu téléchargé par les utilisateurs est automatiquement analysé. Le matériel suspecté de contenir du contenu sexuel impliquant des mineurs (CSAM) est signalé aux autorités compétentes.

Si vous avez des raisons de croire qu'une personne de moins de 18 ans utilise l'Application, ou que l'Application est utilisée pour exploiter des mineurs, veuillez nous contacter immédiatement à support@roketapp.eu.

Sécurité

Le Fournisseur de services se soucie de la protection de la confidentialité de vos informations. Le Fournisseur de services fournit des mesures de sécurité physiques, électroniques et procédurales pour protéger les informations qu'il traite et maintient. Les données sont transmises via des connexions chiffrées et stockées sur des serveurs Google Firebase sécurisés.

Modifications

Cette Politique de confidentialité peut être mise à jour de temps à autre pour quelque raison que ce soit. Le Fournisseur de services vous informera de tout changement de la Politique de confidentialité en mettant à jour cette page avec la nouvelle Politique de confidentialité. Il vous est conseillé de consulter régulièrement cette Politique de confidentialité pour tout changement, car l'utilisation continue est considérée comme une approbation de tous les changements.

Cette politique de confidentialité est en vigueur à compter du 18/02/2026.

Votre consentement

En utilisant l'Application, vous consentez au traitement de vos informations tel que décrit dans cette Politique de confidentialité maintenant et tel que modifié par nous.

Nous contacter

Si vous avez des questions concernant la confidentialité lors de l'utilisation de l'Application, ou des questions sur les pratiques, veuillez contacter le Fournisseur de services par e-mail à casper.roket@proton.me.`;

const policyPT = `Política de privacidade

Esta política de privacidade aplica-se à aplicação Røket (doravante designada por "Aplicação") para dispositivos móveis, criada por Casper Larsen (doravante designado por "Prestador de Serviços") como um serviço suportado por publicidade. Este serviço destina-se a ser utilizado "TAL COMO ESTÁ".

Recolha e utilização de informações

A Aplicação recolhe informações quando a descarregas e utilizas. Estas informações podem incluir dados como:

• O endereço de Protocolo de Internet do teu dispositivo (por exemplo, endereço IP)
• As páginas da Aplicação que visitas, a hora e data da tua visita e o tempo passado nessas páginas
• O tempo passado na Aplicação
• O sistema operativo que utilizas no teu dispositivo móvel

A Aplicação também recolhe as seguintes informações pessoais:

• Endereço de e-mail (para criação de conta e login)
• Nome visível e bio (para o teu perfil público)
• Data de nascimento (para verificação de idade e exibição opcional de idade)
• Género e sexualidade (opcional, para o teu perfil)
• Fotos de perfil e imagens de chat (armazenadas no Google Firebase Storage)
• Mensagens de chat (armazenadas no Google Firebase Firestore)
• Token de notificações push (para entrega de notificações de mensagens)

Dados de localização

A Aplicação recolhe a localização do teu dispositivo enquanto a app está em uso, para mostrar utilizadores próximos. Os dados de localização não são recolhidos quando a app está fechada ou a funcionar em segundo plano.

Os dados de localização são utilizados das seguintes formas:

• Exibição de proximidade: A tua localização é utilizada para te mostrar outros utilizadores próximos e para lhes mostrar a tua distância aproximada.
• Os dados de localização são armazenados no Google Firebase Firestore e atualizados enquanto utilizas a Aplicação.

O Prestador de Serviços pode utilizar as informações que forneceste para te contactar ocasionalmente para te fornecer informações importantes, avisos obrigatórios e promoções de marketing.

Acesso de terceiros

A Aplicação utiliza o Google Firebase como serviço de backend para autenticação, armazenamento de dados, armazenamento de ficheiros e notificações push. Os teus dados são processados e armazenados nos servidores da Google de acordo com os termos de processamento de dados da Google. A Google não vende os teus dados pessoais.

O Prestador de Serviços pode divulgar informações fornecidas pelo utilizador e recolhidas automaticamente:

• conforme exigido por lei, como para cumprir uma intimação ou processo legal semelhante;
• quando acredita de boa-fé que a divulgação é necessária para proteger os seus direitos, proteger a tua segurança ou a segurança de outros, investigar fraude ou responder a um pedido governamental;
• com os seus prestadores de serviços de confiança que trabalham em seu nome, não têm uso independente das informações que lhes divulgamos e concordaram em cumprir as regras estabelecidas nesta declaração de privacidade.

Direitos de exclusão

Podes parar toda a recolha de informações pela Aplicação simplesmente desinstalando-a. Podes utilizar os processos de desinstalação padrão disponíveis como parte do teu dispositivo móvel ou através da loja de aplicações.

Política de retenção de dados

O Prestador de Serviços reterá os dados fornecidos pelo utilizador enquanto utilizares a Aplicação e por um período razoável depois. Podes eliminar a tua conta e todos os dados associados diretamente na Aplicação através de Definições > Eliminar conta. Também podes contactar-nos em casper.roket@proton.me e responderemos num prazo razoável.

Ao eliminar a conta, os seguintes dados são permanentemente removidos: o teu perfil, mensagens de chat, fotos de perfil, feedback e denúncias.

Requisito de idade e segurança infantil

A Aplicação destina-se exclusivamente a utilizadores com pelo menos 18 anos. O Prestador de Serviços não recolhe conscientemente informações pessoalmente identificáveis de pessoas menores de 18 anos e não comercializa para menores.

O Prestador de Serviços tem uma política estrita de tolerância zero em relação ao abuso e exploração sexual de crianças (CSAE). Todo o conteúdo carregado por utilizadores é automaticamente analisado. Material suspeito de conter conteúdo sexual envolvendo menores (CSAM) é reportado às autoridades competentes.

Se tiveres razões para acreditar que uma pessoa menor de 18 anos está a utilizar a Aplicação, ou que a Aplicação está a ser utilizada para explorar menores, contacta-nos imediatamente em support@roketapp.eu.

Segurança

O Prestador de Serviços preocupa-se com a proteção da confidencialidade das tuas informações. O Prestador de Serviços fornece salvaguardas físicas, eletrónicas e processuais para proteger as informações que processa e mantém. Os dados são transmitidos através de ligações encriptadas e armazenados em servidores seguros do Google Firebase.

Alterações

Esta Política de Privacidade pode ser atualizada ocasionalmente por qualquer motivo. O Prestador de Serviços notificar-te-á de quaisquer alterações à Política de Privacidade atualizando esta página com a nova Política de Privacidade. Aconselhamos-te a consultar regularmente esta Política de Privacidade para quaisquer alterações, uma vez que o uso continuado é considerado aprovação de todas as alterações.

Esta política de privacidade é efetiva a partir de 18/02/2026.

O teu consentimento

Ao utilizar a Aplicação, consentes o processamento das tuas informações conforme estabelecido nesta Política de Privacidade agora e conforme alterada por nós.

Contacta-nos

Se tiveres alguma questão sobre privacidade durante a utilização da Aplicação, ou tiveres questões sobre as práticas, por favor contacta o Prestador de Serviços por e-mail em casper.roket@proton.me.`;

export default function PrivacyPolicyScreen({ navigation }: any) {
  const { colors, language, t } = useTheme();
  const insets = useSafeAreaInsets();
  const policyMap: Record<string, string> = { da: policyDA, en: policyEN, es: policyES, de: policyDE, fr: policyFR, pt: policyPT };
  const policy = policyMap[language] || policyEN;

  return (
    <SafeAreaView edges={['bottom']} style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={[colors.primaryBlue, colors.primaryRed]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.header, { paddingTop: insets.top + 10 }]}
      >
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={[styles.backButtonText, { color: colors.textWhite }]}>←</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textWhite }]}>{t.privacyPolicyTitle}</Text>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.card, { backgroundColor: colors.white }]}>
          <Text style={[styles.policyText, { color: colors.textPrimary }]}>{policy}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 14,
    paddingHorizontal: 16,
  },
  backButton: {
    marginRight: 12,
  },
  backButtonText: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  card: {
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  policyText: {
    fontSize: 14,
    lineHeight: 22,
  },
});
