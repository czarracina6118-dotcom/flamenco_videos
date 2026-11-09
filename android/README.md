# Vídeos de guitarra para Android

El APK conserva la interfaz del curso, búsqueda, favoritos, anotaciones,
progreso, velocidad, miniaturas y bucle A–B. Añade acceso nativo de solo lectura
a las carpetas elegidas con el selector de Android. No copia los vídeos dentro
de la aplicación: los reproduce por partes desde el almacenamiento elegido.

## Uso

1. Instalar `Videos-Flamencos-1.1-prueba.apk`; aparece como «Vídeos APK».
2. Pulsar «ELEGIR CARPETA GUITARRA», entrar en la carpeta y confirmar «Usar esta carpeta».
3. Abrir una subcarpeta y reproducir un vídeo.
4. Para recuperar la carpeta al volver, pulsar el botón de carpeta guardada.

No necesita conexión ni permisos generales de almacenamiento. El permiso solo
abarca la carpeta seleccionada. Android puede impedir seleccionar la raíz del
almacenamiento o Descargas; elige una subcarpeta como GUITARRA.
Los PDF se abren con un lector PDF instalado. La compatibilidad de cada vídeo
depende de los codecs que admita el Android del dispositivo.

El progreso del navegador anterior no se importa automáticamente. Los datos
de esta aplicación se guardan en el dispositivo y se eliminan al desinstalarla.
Los vídeos originales no se modifican ni se eliminan.

## Compilación y validación

Con JDK 17, Android SDK 35 y Gradle 8.11.1:

```sh
cd android
gradle assembleDebug lintDebug testDebugUnitTest
```

GitHub Actions publica el APK en Artifacts → Videos-Flamencos-APK.
Las pruebas comprueban rangos de bytes, archivos de más de 2 GB y lectura sin
cargar todo el vídeo en memoria. Falta validar en dispositivos reales el
selector, restauración de permisos, pantalla completa, sonido, saltos,
velocidades, A–B, PDF, miniaturas y guardado al salir.

La firma es de prueba: una compilación futura puede requerir desinstalar.
Antes de actualizaciones que necesiten conservar progreso hay que configurar
una clave de firma privada permanente y una copia de seguridad de los datos.

Versión 1.1: el motor multimedia recibe los vídeos por una conexión local de bucle
interno (127.0.0.1), en lugar de un recurso interceptado de WebView. Solo se
aceptan rutas de sesión aleatorias y archivos registrados desde la carpeta elegida.
No se publican archivos en la red Wi-Fi. Las pruebas incluyen peticiones HTTP
reales completas y parciales, saltos hacia delante y atrás, HEAD y rangos sufijo.
