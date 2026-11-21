# Mi Curso de Guitarra

Academia personal con cursos por carpetas, progreso, favoritos, notas, bucles A-B y sesiones de práctica de 30 o 60 minutos.

## iPad y Safari

Abre la web en Safari. Puedes añadirla a la pantalla de inicio con Compartir → Añadir a pantalla de inicio.

- **ELEGIR CARPETA GUITARRA**: usa el selector de carpetas de Archivos en iPadOS 18.4 o posterior. Empieza con una carpeta pequeña de un curso.
- **ELEGIR VÍDEOS**: permite seleccionar vídeos individuales, también cuando no esté disponible la selección de carpetas. Se muestran juntos en «Mis vídeos».
- Pulsa **CREAR / ACTUALIZAR ÍNDICE** para organizar los cursos de la carpeta seleccionada.
- Los vídeos se leen desde la selección; la aplicación no los sube ni guarda copias en su base de datos. Archivos puede descargar los vídeos de un proveedor de nube para entregarlos a Safari. No es reproducción directa por streaming desde la API de Google Drive.
- Al cerrar o recargar la aplicación, vuelve a elegir la misma carpeta o los vídeos. Las notas, favoritos e historial siguen en el almacenamiento de ese navegador. Borrar los datos del navegador elimina esos datos; no se sincronizan entre dispositivos.
- La reproducción depende del contenedor y los códecs admitidos por Safari. Si un MKV falla, prueba una copia MP4 con H.264 y AAC; renombrar la extensión no convierte el vídeo.

En Chrome/Edge de escritorio se conserva la apertura de carpetas mediante File System Access cuando esté disponible.

## Comprobaciones

Ejecuta `node --test selected-files.test.cjs` para comprobar la navegación de carpetas anidadas, los nombres de lección repetidos, la apertura de archivos individuales y la selección vacía.

La adaptación requiere una prueba final en el iPad real: selección desde Archivos, reproducción de un vídeo compatible, pantalla completa, recuperación tras recargar y apertura desde la pantalla de inicio. No se ha validado todavía en Safari/iPadOS real.

Referencia de compatibilidad: https://webkit.org/blog/16574/webkit-features-in-safari-18-4/
