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
import GradientView from '../components/GradientView';
import { useTheme } from '../theme';

const termsDA = `Vilkår og betingelser

Disse vilkår og betingelser gælder for Røket-appen (herefter kaldet "Applikationen") til mobile enheder, som er skabt af Casper Larsen (herefter kaldet "Tjenesteudbyderen") som en annoncestøttet tjeneste.

Ved at downloade eller bruge Applikationen accepterer du automatisk følgende vilkår. Det anbefales kraftigt, at du grundigt læser og forstår disse vilkår, før du bruger Applikationen.

Uautoriseret kopiering eller ændring af Applikationen, enhver del af Applikationen eller vores varemærker er strengt forbudt. Ethvert forsøg på at udtrække kildekoden til Applikationen, oversætte Applikationen til andre sprog eller skabe afledte versioner er ikke tilladt. Alle varemærker, ophavsrettigheder, databaserettigheder og andre intellektuelle ejendomsrettigheder relateret til Applikationen forbliver Tjenesteudbyderens ejendom.

Tjenesteudbyderen er dedikeret til at sikre, at Applikationen er så nyttig og effektiv som muligt. Som sådan forbeholder de sig retten til at ændre Applikationen eller opkræve betaling for deres tjenester til enhver tid og af enhver grund. Tjenesteudbyderen forsikrer dig om, at eventuelle gebyrer for Applikationen eller dens tjenester vil blive klart kommunikeret til dig.

Applikationen gemmer og behandler personlige data, som du har givet til Tjenesteudbyderen, for at levere Tjenesten. Det er dit ansvar at opretholde sikkerheden for din telefon og adgangen til Applikationen. Tjenesteudbyderen fraråder kraftigt at jailbreake eller roote din telefon, hvilket indebærer at fjerne softwarebegrænsninger og -begrænsninger pålagt af enhedens officielle operativsystem. Sådanne handlinger kan udsætte din telefon for malware, virus, ondsindede programmer, kompromittere din telefons sikkerhedsfunktioner og kan resultere i, at Applikationen ikke fungerer korrekt eller slet ikke.

Vær opmærksom på, at Tjenesteudbyderen ikke påtager sig ansvar for visse aspekter. Nogle funktioner i Applikationen kræver en aktiv internetforbindelse, som kan være Wi-Fi eller leveret af din mobilnetværksudbyder. Tjenesteudbyderen kan ikke holdes ansvarlig, hvis Applikationen ikke fungerer med fuld kapacitet på grund af manglende adgang til Wi-Fi, eller hvis du har opbrugt din datamængde.

Hvis du bruger applikationen uden for et Wi-Fi-område, skal du være opmærksom på, at din mobilnetværksudbyders aftalevilkår stadig gælder. Derfor kan du pådrage dig gebyrer fra din mobiludbyder for dataforbrug under forbindelsen til applikationen eller andre tredjepartsgebyrer. Ved at bruge applikationen accepterer du ansvaret for sådanne gebyrer, herunder roaming-datagebyrer, hvis du bruger applikationen uden for dit hjemmeområde (dvs. region eller land) uden at deaktivere dataroaming. Hvis du ikke er regningsbetaleren for den enhed, som du bruger applikationen på, antager de, at du har fået tilladelse fra regningsbetaleren.

Tilsvarende kan Tjenesteudbyderen ikke altid påtage sig ansvar for din brug af applikationen. For eksempel er det dit ansvar at sikre, at din enhed forbliver opladet. Hvis din enhed løber tør for batteri, og du ikke kan få adgang til Tjenesten, kan Tjenesteudbyderen ikke holdes ansvarlig.

Med hensyn til Tjenesteudbyderens ansvar for din brug af applikationen er det vigtigt at bemærke, at selvom de bestræber sig på at sikre, at den altid er opdateret og nøjagtig, er de afhængige af tredjeparter til at levere information til dem, så de kan gøre den tilgængelig for dig. Tjenesteudbyderen påtager sig intet ansvar for tab, direkte eller indirekte, som du oplever som følge af, at du udelukkende stoler på denne funktionalitet i applikationen.

Tjenesteudbyderen kan ønske at opdatere applikationen på et tidspunkt. Applikationen er i øjeblikket tilgængelig i henhold til kravene for operativsystemet (og for eventuelle yderligere systemer, de beslutter at udvide tilgængeligheden af applikationen til), som kan ændre sig, og du skal downloade opdateringerne, hvis du vil fortsætte med at bruge applikationen. Tjenesteudbyderen garanterer ikke, at de altid vil opdatere applikationen, så den er relevant for dig og/eller kompatibel med den særlige operativsystemversion, der er installeret på din enhed. Du accepterer dog altid at acceptere opdateringer til applikationen, når de tilbydes dig. Tjenesteudbyderen kan også ønske at ophøre med at levere applikationen og kan opsige brugen af den til enhver tid uden at give dig opsigelsesvarsel. Medmindre de informerer dig om andet, vil (a) rettighederne og licenserne, der er givet til dig i disse vilkår, ophøre ved enhver opsigelse; (b) du skal ophøre med at bruge applikationen og (om nødvendigt) slette den fra din enhed.

Børnesikkerhed og nul-tolerance

Røket har en streng nul-tolerance-politik overfor seksuelt misbrug og udnyttelse af børn (CSAE). Følgende er strengt forbudt og vil medføre øjeblikkelig permanent udelukkelse samt anmeldelse til myndighederne:

• Upload, deling eller opbevaring af seksuelt indhold der involverer mindreårige (CSAM)
• Grooming eller enhver form for kontakt med mindreårige med seksuelt formål
• At udgive sig for at være mindreårig
• Enhver form for udnyttelse, misbrug eller chikane af mindreårige

Applikationen er udelukkende beregnet til brugere over 18 år. Alt indhold scannes automatisk, og mistænkeligt materiale rapporteres til relevante myndigheder.

Hvis du opdager indhold der involverer udnyttelse af mindreårige, bedes du straks rapportere det via appens rapporteringsfunktion eller kontakte os direkte på support@roketapp.eu.

Ændringer af disse vilkår og betingelser

Tjenesteudbyderen kan periodisk opdatere deres vilkår og betingelser. Derfor anbefales det, at du regelmæssigt gennemgår denne side for eventuelle ændringer. Tjenesteudbyderen vil informere dig om eventuelle ændringer ved at offentliggøre de nye vilkår og betingelser på denne side.

Disse vilkår og betingelser er gældende fra 2026-02-14.

Kontakt os

Hvis du har spørgsmål eller forslag vedrørende vilkårene og betingelserne, tøv ikke med at kontakte Tjenesteudbyderen via e-mail på casper.roket@proton.me.`;

const termsEN = `Terms & Conditions

These terms and conditions apply to the Røket app (hereby referred to as "Application") for mobile devices that was created by Casper Larsen (hereby referred to as "Service Provider") as an Ad Supported service.

Upon downloading or utilizing the Application, you are automatically agreeing to the following terms. It is strongly advised that you thoroughly read and understand these terms prior to using the Application.

Unauthorized copying, modification of the Application, any part of the Application, or our trademarks is strictly prohibited. Any attempts to extract the source code of the Application, translate the Application into other languages, or create derivative versions are not permitted. All trademarks, copyrights, database rights, and other intellectual property rights related to the Application remain the property of the Service Provider.

The Service Provider is dedicated to ensuring that the Application is as beneficial and efficient as possible. As such, they reserve the right to modify the Application or charge for their services at any time and for any reason. The Service Provider assures you that any charges for the Application or its services will be clearly communicated to you.

The Application stores and processes personal data that you have provided to the Service Provider in order to provide the Service. It is your responsibility to maintain the security of your phone and access to the Application. The Service Provider strongly advise against jailbreaking or rooting your phone, which involves removing software restrictions and limitations imposed by the official operating system of your device. Such actions could expose your phone to malware, viruses, malicious programs, compromise your phone's security features, and may result in the Application not functioning correctly or at all.

Please be aware that the Service Provider does not assume responsibility for certain aspects. Some functions of the Application require an active internet connection, which can be Wi-Fi or provided by your mobile network provider. The Service Provider cannot be held responsible if the Application does not function at full capacity due to lack of access to Wi-Fi or if you have exhausted your data allowance.

If you are using the application outside of a Wi-Fi area, please be aware that your mobile network provider's agreement terms still apply. Consequently, you may incur charges from your mobile provider for data usage during the connection to the application, or other third-party charges. By using the application, you accept responsibility for any such charges, including roaming data charges if you use the application outside of your home territory (i.e., region or country) without disabling data roaming. If you are not the bill payer for the device on which you are using the application, they assume that you have obtained permission from the bill payer.

Similarly, the Service Provider cannot always assume responsibility for your usage of the application. For instance, it is your responsibility to ensure that your device remains charged. If your device runs out of battery and you are unable to access the Service, the Service Provider cannot be held responsible.

In terms of the Service Provider's responsibility for your use of the application, it is important to note that while they strive to ensure that it is updated and accurate at all times, they do rely on third parties to provide information to them so that they can make it available to you. The Service Provider accepts no liability for any loss, direct or indirect, that you experience as a result of relying entirely on this functionality of the application.

The Service Provider may wish to update the application at some point. The application is currently available as per the requirements for the operating system (and for any additional systems they decide to extend the availability of the application to) may change, and you will need to download the updates if you want to continue using the application. The Service Provider does not guarantee that it will always update the application so that it is relevant to you and/or compatible with the particular operating system version installed on your device. However, you agree to always accept updates to the application when offered to you. The Service Provider may also wish to cease providing the application and may terminate its use at any time without providing termination notice to you. Unless they inform you otherwise, upon any termination, (a) the rights and licenses granted to you in these terms will end; (b) you must cease using the application, and (if necessary) delete it from your device.

Child Safety and Zero Tolerance

Røket has a strict zero-tolerance policy towards child sexual abuse and exploitation (CSAE). The following is strictly prohibited and will result in immediate permanent suspension and reporting to authorities:

• Uploading, sharing, or storing sexual content involving minors (CSAM)
• Grooming or any form of contact with minors for sexual purposes
• Impersonating a minor
• Any form of exploitation, abuse, or harassment of minors

The Application is intended exclusively for users aged 18 and older. All content is automatically scanned, and suspicious material is reported to relevant authorities.

If you discover content involving the exploitation of minors, please report it immediately via the app's reporting feature or contact us directly at support@roketapp.eu.

Changes to These Terms and Conditions

The Service Provider may periodically update their Terms and Conditions. Therefore, you are advised to review this page regularly for any changes. The Service Provider will notify you of any changes by posting the new Terms and Conditions on this page.

These terms and conditions are effective as of 2026-02-14.

Contact Us

If you have any questions or suggestions about the Terms and Conditions, please do not hesitate to contact the Service Provider at casper.roket@proton.me.`;

const termsES = `Términos y condiciones

Estos términos y condiciones se aplican a la aplicación Røket (en adelante denominada "Aplicación") para dispositivos móviles, creada por Casper Larsen (en adelante denominado "Proveedor del Servicio") como un servicio con publicidad.

Al descargar o utilizar la Aplicación, aceptas automáticamente los siguientes términos. Se recomienda encarecidamente que leas y comprendas estos términos antes de utilizar la Aplicación.

La copia o modificación no autorizada de la Aplicación, cualquier parte de la Aplicación o nuestras marcas comerciales está estrictamente prohibida. Cualquier intento de extraer el código fuente de la Aplicación, traducir la Aplicación a otros idiomas o crear versiones derivadas no está permitido. Todas las marcas comerciales, derechos de autor, derechos de base de datos y otros derechos de propiedad intelectual relacionados con la Aplicación siguen siendo propiedad del Proveedor del Servicio.

El Proveedor del Servicio se dedica a garantizar que la Aplicación sea lo más útil y eficiente posible. Como tal, se reserva el derecho de modificar la Aplicación o cobrar por sus servicios en cualquier momento y por cualquier motivo. El Proveedor del Servicio te asegura que cualquier cargo por la Aplicación o sus servicios se comunicará claramente.

La Aplicación almacena y procesa datos personales que has proporcionado al Proveedor del Servicio para proporcionar el Servicio. Es tu responsabilidad mantener la seguridad de tu teléfono y el acceso a la Aplicación. El Proveedor del Servicio desaconseja encarecidamente hacer jailbreak o rootear tu teléfono, lo que implica eliminar las restricciones y limitaciones de software impuestas por el sistema operativo oficial de tu dispositivo. Tales acciones podrían exponer tu teléfono a malware, virus, programas maliciosos, comprometer las funciones de seguridad de tu teléfono y pueden resultar en que la Aplicación no funcione correctamente o en absoluto.

Ten en cuenta que el Proveedor del Servicio no asume responsabilidad por ciertos aspectos. Algunas funciones de la Aplicación requieren una conexión activa a Internet, que puede ser Wi-Fi o proporcionada por tu proveedor de red móvil. El Proveedor del Servicio no puede ser considerado responsable si la Aplicación no funciona a plena capacidad debido a la falta de acceso a Wi-Fi o si has agotado tu límite de datos.

Si utilizas la aplicación fuera de un área Wi-Fi, ten en cuenta que los términos del acuerdo de tu proveedor de red móvil siguen aplicándose. En consecuencia, puedes incurrir en cargos de tu proveedor móvil por el uso de datos durante la conexión a la aplicación u otros cargos de terceros. Al utilizar la aplicación, aceptas la responsabilidad de dichos cargos, incluidos los cargos de datos en roaming si utilizas la aplicación fuera de tu territorio (es decir, región o país) sin desactivar el roaming de datos. Si no eres el titular de la factura del dispositivo en el que utilizas la aplicación, se asume que has obtenido permiso del titular de la factura.

Del mismo modo, el Proveedor del Servicio no siempre puede asumir la responsabilidad de tu uso de la aplicación. Por ejemplo, es tu responsabilidad asegurarte de que tu dispositivo permanezca cargado. Si tu dispositivo se queda sin batería y no puedes acceder al Servicio, el Proveedor del Servicio no puede ser considerado responsable.

En cuanto a la responsabilidad del Proveedor del Servicio por tu uso de la aplicación, es importante tener en cuenta que, aunque se esfuerzan por garantizar que esté siempre actualizada y sea precisa, dependen de terceros para proporcionarles información y así ponerla a tu disposición. El Proveedor del Servicio no acepta ninguna responsabilidad por cualquier pérdida, directa o indirecta, que experimentes como resultado de confiar enteramente en esta funcionalidad de la aplicación.

El Proveedor del Servicio puede desear actualizar la aplicación en algún momento. La aplicación está actualmente disponible según los requisitos del sistema operativo (y para cualquier sistema adicional al que decidan extender la disponibilidad de la aplicación), que pueden cambiar, y deberás descargar las actualizaciones si deseas seguir utilizando la aplicación. El Proveedor del Servicio no garantiza que siempre actualizará la aplicación para que sea relevante para ti y/o compatible con la versión particular del sistema operativo instalada en tu dispositivo. Sin embargo, aceptas siempre aceptar las actualizaciones de la aplicación cuando se te ofrezcan. El Proveedor del Servicio también puede desear dejar de proporcionar la aplicación y puede terminar su uso en cualquier momento sin darte aviso de terminación. A menos que te informen de lo contrario, ante cualquier terminación, (a) los derechos y licencias otorgados a ti en estos términos cesarán; (b) debes dejar de usar la aplicación y (si es necesario) eliminarla de tu dispositivo.

Seguridad infantil y tolerancia cero

Røket tiene una estricta política de tolerancia cero hacia el abuso y la explotación sexual infantil (CSAE). Lo siguiente está estrictamente prohibido y resultará en suspensión permanente inmediata y denuncia a las autoridades:

• Subir, compartir o almacenar contenido sexual que involucre a menores (CSAM)
• Grooming o cualquier forma de contacto con menores con fines sexuales
• Hacerse pasar por un menor
• Cualquier forma de explotación, abuso o acoso a menores

La Aplicación está destinada exclusivamente a usuarios mayores de 18 años. Todo el contenido se escanea automáticamente y el material sospechoso se reporta a las autoridades pertinentes.

Si descubres contenido que involucre la explotación de menores, repórtalo inmediatamente a través de la función de reporte de la app o contáctanos directamente en support@roketapp.eu.

Cambios en estos términos y condiciones

El Proveedor del Servicio puede actualizar periódicamente sus Términos y Condiciones. Por lo tanto, se te recomienda revisar esta página regularmente para cualquier cambio. El Proveedor del Servicio te notificará cualquier cambio publicando los nuevos Términos y Condiciones en esta página.

Estos términos y condiciones son efectivos a partir del 2026-02-14.

Contáctanos

Si tienes alguna pregunta o sugerencia sobre los Términos y Condiciones, no dudes en contactar al Proveedor del Servicio por correo electrónico en casper.roket@proton.me.`;

const termsDE = `Nutzungsbedingungen

Diese Nutzungsbedingungen gelten für die Røket-App (im Folgenden als „Anwendung" bezeichnet) für mobile Geräte, die von Casper Larsen (im Folgenden als „Dienstanbieter" bezeichnet) als werbefinanzierter Dienst erstellt wurde.

Durch das Herunterladen oder die Nutzung der Anwendung stimmen Sie automatisch den folgenden Bedingungen zu. Es wird dringend empfohlen, diese Bedingungen vor der Nutzung der Anwendung sorgfältig zu lesen und zu verstehen.

Das unbefugte Kopieren oder Ändern der Anwendung, jeglicher Teile der Anwendung oder unserer Marken ist strengstens untersagt. Jegliche Versuche, den Quellcode der Anwendung zu extrahieren, die Anwendung in andere Sprachen zu übersetzen oder abgeleitete Versionen zu erstellen, sind nicht gestattet. Alle Marken, Urheberrechte, Datenbankrechte und sonstigen geistigen Eigentumsrechte im Zusammenhang mit der Anwendung verbleiben beim Dienstanbieter.

Der Dienstanbieter ist bestrebt, sicherzustellen, dass die Anwendung so nützlich und effizient wie möglich ist. Als solcher behält er sich das Recht vor, die Anwendung zu ändern oder für seine Dienste jederzeit und aus jedem Grund Gebühren zu erheben. Der Dienstanbieter versichert Ihnen, dass etwaige Gebühren für die Anwendung oder ihre Dienste klar an Sie kommuniziert werden.

Die Anwendung speichert und verarbeitet personenbezogene Daten, die Sie dem Dienstanbieter zur Bereitstellung des Dienstes übermittelt haben. Es liegt in Ihrer Verantwortung, die Sicherheit Ihres Telefons und den Zugang zur Anwendung aufrechtzuerhalten. Der Dienstanbieter rät dringend davon ab, Ihr Telefon zu jailbreaken oder zu rooten, was die Entfernung von Softwarebeschränkungen und -einschränkungen beinhaltet, die vom offiziellen Betriebssystem Ihres Geräts auferlegt werden. Solche Handlungen könnten Ihr Telefon Malware, Viren und schädlichen Programmen aussetzen, die Sicherheitsfunktionen Ihres Telefons gefährden und dazu führen, dass die Anwendung nicht richtig oder überhaupt nicht funktioniert.

Bitte beachten Sie, dass der Dienstanbieter für bestimmte Aspekte keine Verantwortung übernimmt. Einige Funktionen der Anwendung erfordern eine aktive Internetverbindung, die über WLAN oder Ihren Mobilfunkanbieter bereitgestellt werden kann. Der Dienstanbieter kann nicht verantwortlich gemacht werden, wenn die Anwendung aufgrund fehlenden WLAN-Zugangs nicht mit voller Kapazität funktioniert oder wenn Sie Ihr Datenvolumen aufgebraucht haben.

Wenn Sie die Anwendung außerhalb eines WLAN-Bereichs verwenden, beachten Sie bitte, dass die Vertragsbedingungen Ihres Mobilfunkanbieters weiterhin gelten. Folglich können Ihnen Gebühren von Ihrem Mobilfunkanbieter für die Datennutzung während der Verbindung mit der Anwendung oder andere Drittanbietergebühren entstehen. Durch die Nutzung der Anwendung akzeptieren Sie die Verantwortung für solche Gebühren, einschließlich Roaming-Datengebühren, wenn Sie die Anwendung außerhalb Ihres Heimatgebiets (d. h. Region oder Land) nutzen, ohne das Datenroaming zu deaktivieren. Wenn Sie nicht der Rechnungszahler für das Gerät sind, auf dem Sie die Anwendung nutzen, wird angenommen, dass Sie die Genehmigung des Rechnungszahlers eingeholt haben.

Ebenso kann der Dienstanbieter nicht immer die Verantwortung für Ihre Nutzung der Anwendung übernehmen. Beispielsweise liegt es in Ihrer Verantwortung, sicherzustellen, dass Ihr Gerät aufgeladen bleibt. Wenn Ihrem Gerät der Akku ausgeht und Sie nicht auf den Dienst zugreifen können, kann der Dienstanbieter nicht verantwortlich gemacht werden.

In Bezug auf die Verantwortung des Dienstanbieters für Ihre Nutzung der Anwendung ist zu beachten, dass er zwar bestrebt ist, sicherzustellen, dass sie jederzeit aktuell und genau ist, er jedoch auf Dritte angewiesen ist, die ihm Informationen zur Verfügung stellen, damit er sie Ihnen zugänglich machen kann. Der Dienstanbieter übernimmt keine Haftung für Verluste, direkte oder indirekte, die Ihnen dadurch entstehen, dass Sie sich vollständig auf diese Funktionalität der Anwendung verlassen.

Der Dienstanbieter möchte die Anwendung möglicherweise irgendwann aktualisieren. Die Anwendung ist derzeit gemäß den Anforderungen des Betriebssystems (und für alle zusätzlichen Systeme, auf die die Verfügbarkeit der Anwendung erweitert wird) verfügbar, was sich ändern kann, und Sie müssen die Updates herunterladen, wenn Sie die Anwendung weiterhin nutzen möchten. Der Dienstanbieter garantiert nicht, dass er die Anwendung immer so aktualisiert, dass sie für Sie relevant und/oder mit der auf Ihrem Gerät installierten Betriebssystemversion kompatibel ist. Sie stimmen jedoch zu, Updates der Anwendung immer zu akzeptieren, wenn sie Ihnen angeboten werden. Der Dienstanbieter kann auch die Bereitstellung der Anwendung einstellen und deren Nutzung jederzeit ohne Kündigungsfrist beenden. Sofern nicht anders mitgeteilt, enden bei jeder Beendigung (a) die Ihnen in diesen Bedingungen gewährten Rechte und Lizenzen; (b) Sie müssen die Nutzung der Anwendung einstellen und (falls erforderlich) sie von Ihrem Gerät löschen.

Kindersicherheit und Null-Toleranz

Røket verfolgt eine strenge Null-Toleranz-Politik gegenüber sexuellem Missbrauch und Ausbeutung von Kindern (CSAE). Folgendes ist strengstens verboten und führt zu sofortiger dauerhafter Sperrung und Meldung an die Behörden:

• Hochladen, Teilen oder Speichern sexueller Inhalte, die Minderjährige betreffen (CSAM)
• Grooming oder jegliche Kontaktaufnahme mit Minderjährigen zu sexuellen Zwecken
• Sich als Minderjähriger ausgeben
• Jegliche Form von Ausbeutung, Missbrauch oder Belästigung von Minderjährigen

Die Anwendung ist ausschließlich für Nutzer ab 18 Jahren bestimmt. Alle Inhalte werden automatisch gescannt, und verdächtiges Material wird den zuständigen Behörden gemeldet.

Wenn Sie Inhalte entdecken, die die Ausbeutung von Minderjährigen betreffen, melden Sie diese bitte umgehend über die Meldefunktion der App oder kontaktieren Sie uns direkt unter support@roketapp.eu.

Änderungen dieser Nutzungsbedingungen

Der Dienstanbieter kann seine Nutzungsbedingungen regelmäßig aktualisieren. Daher wird Ihnen empfohlen, diese Seite regelmäßig auf Änderungen zu überprüfen. Der Dienstanbieter wird Sie über Änderungen informieren, indem er die neuen Nutzungsbedingungen auf dieser Seite veröffentlicht.

Diese Nutzungsbedingungen gelten ab dem 14.02.2026.

Kontakt

Wenn Sie Fragen oder Vorschläge zu den Nutzungsbedingungen haben, zögern Sie nicht, den Dienstanbieter per E-Mail unter casper.roket@proton.me zu kontaktieren.`;

const termsFR = `Conditions générales

Ces conditions générales s'appliquent à l'application Røket (ci-après dénommée « Application ») pour appareils mobiles, créée par Casper Larsen (ci-après dénommé « Fournisseur de services ») en tant que service financé par la publicité.

En téléchargeant ou en utilisant l'Application, vous acceptez automatiquement les conditions suivantes. Il est fortement conseillé de lire et de comprendre attentivement ces conditions avant d'utiliser l'Application.

La copie ou la modification non autorisée de l'Application, de toute partie de l'Application ou de nos marques est strictement interdite. Toute tentative d'extraire le code source de l'Application, de traduire l'Application dans d'autres langues ou de créer des versions dérivées n'est pas autorisée. Toutes les marques, droits d'auteur, droits de base de données et autres droits de propriété intellectuelle liés à l'Application restent la propriété du Fournisseur de services.

Le Fournisseur de services s'engage à faire en sorte que l'Application soit aussi utile et efficace que possible. À ce titre, il se réserve le droit de modifier l'Application ou de facturer ses services à tout moment et pour quelque raison que ce soit. Le Fournisseur de services vous assure que tout frais pour l'Application ou ses services vous sera clairement communiqué.

L'Application stocke et traite les données personnelles que vous avez fournies au Fournisseur de services afin de fournir le Service. Il est de votre responsabilité de maintenir la sécurité de votre téléphone et l'accès à l'Application. Le Fournisseur de services déconseille fortement de jailbreaker ou rooter votre téléphone, ce qui implique de supprimer les restrictions et limitations logicielles imposées par le système d'exploitation officiel de votre appareil. De telles actions pourraient exposer votre téléphone aux logiciels malveillants, virus, programmes malveillants, compromettre les fonctionnalités de sécurité de votre téléphone et peuvent entraîner un dysfonctionnement de l'Application.

Veuillez noter que le Fournisseur de services n'assume pas la responsabilité de certains aspects. Certaines fonctions de l'Application nécessitent une connexion Internet active, qui peut être Wi-Fi ou fournie par votre opérateur mobile. Le Fournisseur de services ne peut être tenu responsable si l'Application ne fonctionne pas à pleine capacité en raison d'un manque d'accès au Wi-Fi ou si vous avez épuisé votre forfait de données.

Si vous utilisez l'application en dehors d'une zone Wi-Fi, veuillez noter que les conditions de votre opérateur mobile s'appliquent toujours. Par conséquent, vous pouvez encourir des frais de votre opérateur mobile pour l'utilisation de données lors de la connexion à l'application, ou d'autres frais de tiers. En utilisant l'application, vous acceptez la responsabilité de tels frais, y compris les frais de données en itinérance si vous utilisez l'application en dehors de votre territoire (c'est-à-dire région ou pays) sans désactiver l'itinérance des données. Si vous n'êtes pas le payeur de la facture de l'appareil sur lequel vous utilisez l'application, il est présumé que vous avez obtenu l'autorisation du payeur.

De même, le Fournisseur de services ne peut pas toujours assumer la responsabilité de votre utilisation de l'application. Par exemple, il est de votre responsabilité de vous assurer que votre appareil reste chargé. Si votre appareil est à court de batterie et que vous ne pouvez pas accéder au Service, le Fournisseur de services ne peut pas être tenu responsable.

En ce qui concerne la responsabilité du Fournisseur de services pour votre utilisation de l'application, il est important de noter que bien qu'il s'efforce de s'assurer qu'elle est toujours à jour et exacte, il dépend de tiers pour lui fournir des informations afin de les mettre à votre disposition. Le Fournisseur de services n'accepte aucune responsabilité pour toute perte, directe ou indirecte, que vous subissez en vous fiant entièrement à cette fonctionnalité de l'application.

Le Fournisseur de services peut souhaiter mettre à jour l'application à un moment donné. L'application est actuellement disponible selon les exigences du système d'exploitation (et pour tout système supplémentaire auquel il décide d'étendre la disponibilité de l'application), qui peuvent changer, et vous devrez télécharger les mises à jour si vous souhaitez continuer à utiliser l'application. Le Fournisseur de services ne garantit pas qu'il mettra toujours à jour l'application pour qu'elle soit pertinente pour vous et/ou compatible avec la version du système d'exploitation installée sur votre appareil. Cependant, vous acceptez de toujours accepter les mises à jour de l'application lorsqu'elles vous sont proposées. Le Fournisseur de services peut également souhaiter cesser de fournir l'application et peut en interrompre l'utilisation à tout moment sans vous en aviser. Sauf indication contraire, lors de toute résiliation, (a) les droits et licences qui vous sont accordés dans ces conditions prennent fin ; (b) vous devez cesser d'utiliser l'application et (si nécessaire) la supprimer de votre appareil.

Sécurité des enfants et tolérance zéro

Røket applique une politique stricte de tolérance zéro envers l'abus et l'exploitation sexuels des enfants (CSAE). Ce qui suit est strictement interdit et entraînera une suspension permanente immédiate et un signalement aux autorités :

• Télécharger, partager ou stocker du contenu sexuel impliquant des mineurs (CSAM)
• Le grooming ou toute forme de contact avec des mineurs à des fins sexuelles
• Se faire passer pour un mineur
• Toute forme d'exploitation, d'abus ou de harcèlement de mineurs

L'Application est exclusivement destinée aux utilisateurs âgés de 18 ans et plus. Tout le contenu est automatiquement analysé et le matériel suspect est signalé aux autorités compétentes.

Si vous découvrez du contenu impliquant l'exploitation de mineurs, signalez-le immédiatement via la fonction de signalement de l'application ou contactez-nous directement à support@roketapp.eu.

Modifications de ces conditions générales

Le Fournisseur de services peut mettre à jour périodiquement ses Conditions générales. Par conséquent, il vous est conseillé de consulter régulièrement cette page pour tout changement. Le Fournisseur de services vous informera de tout changement en publiant les nouvelles Conditions générales sur cette page.

Ces conditions générales sont en vigueur à compter du 14/02/2026.

Nous contacter

Si vous avez des questions ou des suggestions concernant les Conditions générales, n'hésitez pas à contacter le Fournisseur de services par e-mail à casper.roket@proton.me.`;

const termsPT = `Termos e condições

Estes termos e condições aplicam-se à aplicação Røket (doravante designada por "Aplicação") para dispositivos móveis, criada por Casper Larsen (doravante designado por "Prestador de Serviços") como um serviço suportado por publicidade.

Ao descarregar ou utilizar a Aplicação, aceitas automaticamente os seguintes termos. É fortemente recomendado que leias e compreendas estes termos antes de utilizar a Aplicação.

A cópia ou modificação não autorizada da Aplicação, de qualquer parte da Aplicação ou das nossas marcas é estritamente proibida. Quaisquer tentativas de extrair o código-fonte da Aplicação, traduzir a Aplicação para outros idiomas ou criar versões derivadas não são permitidas. Todas as marcas, direitos de autor, direitos de base de dados e outros direitos de propriedade intelectual relacionados com a Aplicação permanecem propriedade do Prestador de Serviços.

O Prestador de Serviços dedica-se a garantir que a Aplicação seja o mais útil e eficiente possível. Como tal, reserva-se o direito de modificar a Aplicação ou cobrar pelos seus serviços a qualquer momento e por qualquer motivo. O Prestador de Serviços garante-te que quaisquer cobranças pela Aplicação ou seus serviços serão claramente comunicadas.

A Aplicação armazena e processa dados pessoais que forneceste ao Prestador de Serviços para fornecer o Serviço. É da tua responsabilidade manter a segurança do teu telefone e o acesso à Aplicação. O Prestador de Serviços desaconselha fortemente fazer jailbreak ou root ao teu telefone, o que envolve remover restrições e limitações de software impostas pelo sistema operativo oficial do teu dispositivo. Tais ações podem expor o teu telefone a malware, vírus, programas maliciosos, comprometer as funcionalidades de segurança do teu telefone e podem resultar no mau funcionamento da Aplicação.

Tem em atenção que o Prestador de Serviços não assume responsabilidade por certos aspetos. Algumas funções da Aplicação requerem uma ligação ativa à Internet, que pode ser Wi-Fi ou fornecida pelo teu operador de rede móvel. O Prestador de Serviços não pode ser responsabilizado se a Aplicação não funcionar em plena capacidade devido à falta de acesso a Wi-Fi ou se esgotaste o teu limite de dados.

Se utilizares a aplicação fora de uma área Wi-Fi, tem em atenção que os termos do acordo do teu operador de rede móvel continuam a aplicar-se. Consequentemente, podes incorrer em cobranças do teu operador móvel pelo uso de dados durante a ligação à aplicação ou outras cobranças de terceiros. Ao utilizar a aplicação, aceitas a responsabilidade por tais cobranças, incluindo cobranças de dados em roaming se utilizares a aplicação fora do teu território (ou seja, região ou país) sem desativar o roaming de dados. Se não fores o titular da fatura do dispositivo no qual utilizas a aplicação, presume-se que obtiveste permissão do titular da fatura.

Da mesma forma, o Prestador de Serviços nem sempre pode assumir a responsabilidade pela tua utilização da aplicação. Por exemplo, é da tua responsabilidade garantir que o teu dispositivo permanece carregado. Se o teu dispositivo ficar sem bateria e não conseguires aceder ao Serviço, o Prestador de Serviços não pode ser responsabilizado.

Em termos da responsabilidade do Prestador de Serviços pela tua utilização da aplicação, é importante notar que, embora se esforce por garantir que esteja sempre atualizada e precisa, depende de terceiros para lhe fornecerem informações para que possa disponibilizá-las para ti. O Prestador de Serviços não aceita qualquer responsabilidade por qualquer perda, direta ou indireta, que experimentes como resultado de confiares inteiramente nesta funcionalidade da aplicação.

O Prestador de Serviços pode desejar atualizar a aplicação em algum momento. A aplicação está atualmente disponível conforme os requisitos do sistema operativo (e para quaisquer sistemas adicionais aos quais decida estender a disponibilidade da aplicação), que podem mudar, e terás de descarregar as atualizações se quiseres continuar a utilizar a aplicação. O Prestador de Serviços não garante que atualizará sempre a aplicação para que seja relevante para ti e/ou compatível com a versão particular do sistema operativo instalada no teu dispositivo. No entanto, concordas em aceitar sempre as atualizações da aplicação quando te forem oferecidas. O Prestador de Serviços pode também desejar deixar de fornecer a aplicação e pode terminar a sua utilização a qualquer momento sem te dar aviso de terminação. Salvo indicação em contrário, após qualquer terminação, (a) os direitos e licenças concedidos nestes termos cessam; (b) deves deixar de utilizar a aplicação e (se necessário) eliminá-la do teu dispositivo.

Segurança infantil e tolerância zero

O Røket tem uma política estrita de tolerância zero em relação ao abuso e exploração sexual de crianças (CSAE). O seguinte é estritamente proibido e resultará em suspensão permanente imediata e denúncia às autoridades:

• Carregar, partilhar ou armazenar conteúdo sexual envolvendo menores (CSAM)
• Grooming ou qualquer forma de contacto com menores para fins sexuais
• Fazer-se passar por menor
• Qualquer forma de exploração, abuso ou assédio de menores

A Aplicação destina-se exclusivamente a utilizadores com 18 anos ou mais. Todo o conteúdo é automaticamente analisado e o material suspeito é reportado às autoridades competentes.

Se descobrires conteúdo envolvendo a exploração de menores, reporta-o imediatamente através da função de denúncia da app ou contacta-nos diretamente em support@roketapp.eu.

Alterações a estes termos e condições

O Prestador de Serviços pode atualizar periodicamente os seus Termos e Condições. Portanto, aconselhamos-te a rever esta página regularmente para quaisquer alterações. O Prestador de Serviços notificar-te-á de quaisquer alterações publicando os novos Termos e Condições nesta página.

Estes termos e condições são efetivos a partir de 14/02/2026.

Contacta-nos

Se tiveres alguma questão ou sugestão sobre os Termos e Condições, não hesites em contactar o Prestador de Serviços por e-mail em casper.roket@proton.me.`;

export default function TermsConditionsScreen({ navigation }: any) {
  const { colors, language, t } = useTheme();
  const insets = useSafeAreaInsets();
  const termsMap: Record<string, string> = { da: termsDA, en: termsEN, es: termsES, de: termsDE, fr: termsFR, pt: termsPT };
  const terms = termsMap[language] || termsEN;

  return (
    <SafeAreaView edges={['bottom']} style={[styles.container, { backgroundColor: colors.background }]}>
      <GradientView
        colors={[colors.primaryBlue, colors.primaryRed]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.header, { paddingTop: insets.top + 10 }]}
      >
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={[styles.backButtonText, { color: colors.textWhite }]}>←</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textWhite }]}>{t.termsTitle}</Text>
      </GradientView>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.card, { backgroundColor: colors.white }]}>
          <Text style={[styles.termsText, { color: colors.textPrimary }]}>{terms}</Text>
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
  termsText: {
    fontSize: 14,
    lineHeight: 22,
  },
});
