# Mi Curso de Guitarra

Academia personal con cursos por carpetas, progreso, favoritos, notas, bucles A-B y sesiones de práctica de 30 o 60 minutos.

## iPad y Safari

Abre la web en Safari. Puedes añadirla a la pantalla de inicio con Compartir → Añadir a pantalla de inicio.

### GUITARRA en Google Drive (v7.4)

1. Pulsa **CONECTAR GOOGLE DRIVE**, elige tu cuenta y autoriza la lectura de Drive.
2. El selector propio del curso busca GUITARRA. Abre la carpeta que corresponda y pulsa **USAR ESTA CARPETA**. También puedes navegar desde **MI UNIDAD**.
3. Pulsa **CREAR / ACTUALIZAR ÍNDICE** para reunir los cursos de todas las subcarpetas. El índice solo obtiene metadatos; no descarga la videoteca.
4. Al abrir un vídeo, un servicio de la aplicación transmite el contenido desde la API de Drive por rangos de bytes al reproductor integrado. Los vídeos y los permisos de acceso no se guardan en la caché de la aplicación. No se usa un intermediario externo para los vídeos.
5. El identificador de la carpeta elegida queda guardado en este navegador. Al recargar o caducar el permiso temporal, pulsa **CONECTAR GOOGLE DRIVE** para recuperar la carpeta. Esto no equivale a una sesión de Google permanente.

Google pide el alcance `drive.readonly`, que permite ver y descargar archivos de la cuenta; el código solo implementa operaciones GET. La selección de GUITARRA limita la navegación del curso, no el alcance del consentimiento de Google. **DESCONECTAR DRIVE** revoca el permiso de la sesión y elimina la carpeta recordada; conserva las notas y el progreso locales.

La configuración usa un cliente OAuth de tipo **Aplicación web** cuyo origen autorizado es `https://czarracina6118-dotcom.github.io` (sin ruta ni barra final). El ID de cliente público está en `drive-ui.js`; no se necesita ni se debe incluir un secreto de cliente en esta web. El proyecto de Google Cloud debe tener habilitada la API de Drive y permitir la cuenta usada como usuario de prueba cuando esté en modo de prueba.

Los permisos temporales se conservan únicamente en la memoria de la página. El servicio de reproducción solicita a esa página el permiso para cada petición de un vídeo registrado; envía Authorization a Google en una cabecera y no incorpora permisos a las URL. Los identificadores de archivo separan las notas de vídeos con el mismo nombre en distintas carpetas.

### Archivos elegidos desde el dispositivo

- **ELEGIR CARPETA LOCAL**: usa el selector de carpetas de Archivos en iPadOS 18.4 o posterior. Google Drive puede aparecer desactivado en ese selector; para Drive usa la conexión directa descrita arriba.
- **ELEGIR VÍDEOS**: permite seleccionar vídeos individuales, también cuando no esté disponible la selección de carpetas. Se muestran juntos en «Mis vídeos».
- Pulsa **CREAR / ACTUALIZAR ÍNDICE** para organizar los cursos de la carpeta seleccionada.
- Los vídeos se leen desde la selección; la aplicación no los sube ni guarda copias en su base de datos. Archivos puede descargar los vídeos de un proveedor de nube para entregarlos a Safari. Este selector es independiente de la conexión directa con Drive.
- Al cerrar o recargar la aplicación, vuelve a elegir la misma carpeta o los vídeos. Las notas, favoritos e historial siguen en el almacenamiento de ese navegador. Borrar los datos del navegador elimina esos datos; no se sincronizan entre dispositivos.
- La reproducción depende del contenedor y los códecs admitidos por Safari. Si un MKV falla, prueba una copia MP4 con H.264 y AAC; renombrar la extensión no convierte el vídeo.

En Chrome/Edge de escritorio se conserva la apertura de carpetas mediante File System Access cuando esté disponible.

## Comprobaciones

Ejecuta `node --test *.test.cjs`. Las pruebas cubren la navegación paginada, nombres repetidos, expiración, permisos de descarga, transmisión por rangos, aislamiento de permisos, recuperación del índice, notas, práctica tras recargar, y selección local. Las respuestas de Google y el DOM se simulan; estas pruebas no acreditan una autorización real de Google ni compatibilidad de reproducción con todos los códecs.

En el iPad del usuario ya se ha validado la selección de varios vídeos de Drive desde Archivos, las miniaturas y el reproductor integrado de v7.3. La nueva conexión directa de v7.4 requiere validar inicio de sesión, navegación de GUITARRA, indexación y reproducción de un MP4 real, búsqueda temporal, bucle A-B y recuperación tras recargar.

Referencia de compatibilidad: https://webkit.org/blog/16574/webkit-features-in-safari-18-4/
