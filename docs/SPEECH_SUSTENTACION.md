# Speech de sustentación — SecureHome IoT

## Presentación breve

SecureHome IoT es una solución de seguridad residencial basada en ESP32-CAM que integra contratación, visita técnica, monitoreo y alertas en una sola plataforma. El cliente registra su instalación, selecciona el diseño del equipo, agenda una visita y, una vez instalado, consulta sus cámaras desde el panel. El administrador gestiona solicitudes, citas y accesos de soporte bajo políticas de seguridad en Supabase.

El valor del proyecto no está solamente en mostrar una cámara. El sistema conecta el dispositivo físico con un proceso completo: identidad, agenda, seguimiento, comunicación, monitoreo y alertas. Así se convierte un prototipo IoT en un servicio que puede operarse y mantenerse.

## Cómo funciona la detección

La ESP32-CAM captura y transmite el video. En el MVP, la detección de personas se ejecuta con MediaPipe en el navegador que tiene abierto el panel; no se ejecuta dentro del ESP32 ni en un servicio de inferencia en la nube. El backend AWS protege y distribuye el stream, y recibe los eventos para enviar las alertas.

Esta decisión reduce el trabajo del microcontrolador y evita enviar cada fotograma a un servicio de inteligencia artificial. Su limitación es que la detección depende de que el panel esté abierto. Como evolución, el detector puede trasladarse a un servicio de borde o backend que funcione permanentemente aunque ningún usuario tenga abierto el navegador.

## Agenda y nueva instalación

La información de las visitas se almacena en PostgreSQL de Supabase, en la tabla `installation_appointments`. Cada cita se relaciona con una solicitud mediante `request_id` y guarda fecha, hora, estado y marcas de creación y actualización. Las políticas RLS permiten al cliente consultar y modificar únicamente la cita asociada con su solicitud.

Si se cancela solamente una cita, el cliente puede seleccionar otra fecha y hora y reagendarla. Si se cancela toda la solicitud de instalación, el panel ofrece crear una nueva solicitud, sin borrar el historial anterior.

## Registro

El registro usa Supabase Auth. Si la confirmación por correo está activa, el usuario se redirige al inicio de sesión con un mensaje para revisar su correo; los datos sensibles ya no permanecen visibles en el formulario. Si Supabase entrega una sesión inmediata, el flujo continúa hacia la personalización del sistema.

## Permanencia y tiempos operativos

- Permanencia contractual mínima: 4 meses desde la activación.
- Anticipación mínima para reservar una visita: 2 horas.
- Acceso temporal del administrador a una cámara: 5 minutos por autorización.
- La retención de grabaciones no está implementada en el MVP: se ofrece transmisión en vivo y captura asociada a una alerta, no grabación continua.

Debe evitarse confundir permanencia contractual con retención de datos. Antes de una salida comercial se debe definir y publicar una política de conservación y eliminación para perfiles, solicitudes, mensajes e imágenes de alertas.

## Costos y rentabilidad

Los valores mostrados actualmente corresponden a una propuesta referencial del MVP, no a una tarifa comercial validada. Para obtener un precio rentable se debe calcular, por cada plan:

`precio inicial = hardware + carcasa + consumibles + instalación + transporte + garantía + margen`

`mensualidad = nube + mensajería + soporte + mantenimiento + contingencia + margen`

La propuesta comercial no debe aprobarse hasta contar con una lista de materiales y tiempos reales. Un margen objetivo debe aplicarse después de sumar todos los costos, en vez de fijar el precio únicamente por comparación con otros productos. También conviene ofrecer compra del equipo y suscripción por separado para que el cliente entienda qué paga una sola vez y qué servicio recibe cada mes.

## Cierre

SecureHome IoT demuestra una arquitectura funcional de extremo a extremo: dispositivo, transmisión, detección, alertas, base de datos y experiencia de cliente. El MVP ya valida el flujo técnico y operativo. Los siguientes pasos para convertirlo en producto son ejecutar detección permanente fuera del navegador, validar el costo real por instalación, definir retención de datos y fortalecer las pruebas de integración con el hardware.

## Respuestas rápidas para preguntas

**¿Dónde se guarda la cita?** En `installation_appointments`, dentro de PostgreSQL en Supabase.

**¿Se puede reagendar?** Sí. Una cita cancelada se reactiva con una nueva fecha y hora; una solicitud completa cancelada permite crear otra instalación.

**¿Dónde detecta personas?** En el navegador con MediaPipe. La ESP32-CAM captura el video y AWS distribuye el stream y procesa el envío de alertas.

**¿Graba todo el tiempo?** No. El MVP muestra video en vivo y captura evidencia cuando genera una alerta.

**¿Cuánto dura el contrato?** La permanencia mínima definida es de cuatro meses.

**¿Los precios ya son comerciales?** No. Son valores referenciales y deben recalcularse con costos reales y margen antes de vender el servicio.
