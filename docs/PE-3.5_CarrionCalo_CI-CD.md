# PE-3.5 — CI/CD y despliegue básico

## Proyecto: SecureHome IoT

Esta práctica implementa un flujo básico de **Integración Continua y Despliegue Continuo (CI/CD)** sobre el backend y la aplicación web del proyecto **SecureHome IoT**. Se utiliza **GitHub Actions** para automatizar las validaciones y preparar el artefacto antes de una liberación, mientras que **Vercel** realiza el despliegue mediante su integración con GitHub.

---

## 1. Definición del flujo CI/CD

El flujo de integración continua se ejecuta automáticamente cuando se realiza un `push` a las ramas `main` o `master`, así como al crear un `pull request`.

El pipeline sigue la siguiente secuencia:

```text
Push / Pull Request
        ↓
Checkout del repositorio
        ↓
Configuración de Node.js 22
        ↓
npm ci
        ↓
ESLint
        ↓
Pruebas automáticas
        ↓
Build de producción
        ↓
Generación y almacenamiento del artefacto
```

Cada etapa debe finalizar correctamente antes de continuar con la siguiente. Si una validación falla, GitHub Actions detiene el proceso y el cambio no debe considerarse listo para producción.

El workflow de GitHub Actions no publica directamente en Vercel. El despliegue es
un proceso posterior e independiente, ejecutado por la integración de Vercel con
el repositorio.

---

## 2. Configuración del pipeline

El pipeline está definido en
[`.github/workflows/ci.yml`](../.github/workflows/ci.yml).

Se utiliza **GitHub Actions** con un job denominado `quality`.

Las principales etapas configuradas son:

* Checkout del código fuente.
* Instalación y configuración de Node.js 22.
* Instalación reproducible de dependencias mediante `npm ci`.
* Validación de código mediante ESLint.
* Ejecución de pruebas automáticas.
* Construcción del proyecto mediante Vite.
* Empaquetado del resultado de producción.
* Almacenamiento del artefacto generado durante 14 días.

Las validaciones también fueron ejecutadas localmente:

```bash
npm ci
npm run lint
npm test
npm run build
```

### Resultado de las pruebas

La ejecución local detectó dos archivos de prueba que contienen cuatro casos. El
resumen de Node.js informó:

```text
tests 2
pass 2
fail 0
```

Las pruebas verifican aspectos relacionados con:

* registro y validación OAuth utilizando PKCE;
* rechazo de `redirect URI` o verificadores PKCE incorrectos;
* conservación del `correlation ID` durante una traza;
* registro de errores y spans en operaciones fallidas.

El proceso de construcción con Vite también finalizó correctamente, generando el directorio:

```text
dist/
```

De esta manera, el código es validado antes de considerarse apto para una liberación.

---

## 3. Gestión de secretos

SecureHome IoT evita almacenar credenciales sensibles directamente dentro del código fuente.

Las variables utilizadas se clasifican de la siguiente manera:

| Variable                        | Tipo                                | Ubicación                           |
| ------------------------------- | ----------------------------------- | ----------------------------------- |
| `VITE_SUPABASE_URL`             | Configuración pública               | Variables de entorno                |
| `VITE_SUPABASE_ANON_KEY`        | Clave pública limitada mediante RLS | Variables de entorno                |
| `MCP_SUPABASE_URL`              | Configuración del servidor          | Variables del entorno de despliegue |
| `MCP_SUPABASE_SERVICE_ROLE_KEY` | Secreto crítico                     | Solo entorno del servidor           |
| `MCP_OAUTH_SECRET`              | Secreto crítico                     | Solo entorno del servidor           |
| `MCP_PUBLIC_URL`                | Configuración pública               | Variables del entorno               |

### Reglas aplicadas

1. Los archivos `.env` reales no deben almacenarse en GitHub.
2. Se utilizan archivos como `.env.example` únicamente como referencia.
3. Los secretos críticos no utilizan el prefijo `VITE_`, ya que las variables con este prefijo pueden incorporarse al código enviado al navegador.
4. Las credenciales sensibles del servidor se almacenan mediante variables de entorno.
5. Los secretos no deben mostrarse en logs, capturas, commits ni documentación pública.
6. Si una credencial es expuesta, debe ser revocada y reemplazada inmediatamente.

Con estas medidas se evita almacenar secretos directamente en el repositorio.

---

## 4. Despliegue controlado

La estrategia de liberación utiliza **GitHub Actions** como puerta de validación y **Vercel** como plataforma de despliegue.

El procedimiento establecido es:

1. Realizar los cambios en una rama y ejecutar las validaciones locales.
2. Registrar los cambios mediante Git y abrir un `pull request`.
3. GitHub Actions ejecuta automáticamente el pipeline de CI.
4. Comprobar que lint, pruebas y build finalicen correctamente.
5. Validar el deployment Preview generado por Vercel.
6. Fusionar el cambio en `main` únicamente después de aprobar CI y Preview.
7. Vercel genera el deployment de producción correspondiente.
8. Verificar el funcionamiento del sistema antes de considerar la versión estable.

Antes de liberar una versión se pueden realizar pruebas básicas o *smoke tests* sobre funciones críticas como:

* carga de la aplicación;
* autenticación;
* acceso al backend;
* funcionamiento de los endpoints principales;
* funcionamiento del endpoint MCP utilizado por SecureHome.

Esto permite separar la validación técnica del código de su exposición definitiva a los usuarios.

---

## 5. Rollback y auditoría

Cada despliegue debe poder relacionarse con una versión concreta del código.

Para ello se conserva como evidencia:

* historial de commits;
* SHA del commit;
* ejecución correspondiente de GitHub Actions;
* resultado de las pruebas;
* artefacto generado;
* deployment realizado;
* fecha del cambio;
* resultado de las verificaciones posteriores al despliegue.

El artefacto generado por GitHub Actions utiliza el SHA del commit en su nombre:

```text
securehome-iot-<SHA>.tar.gz
```

Esto permite relacionar directamente un artefacto con el código que lo produjo.

### Estrategia de rollback

Si una nueva versión presenta un problema:

1. Se identifica el commit que introdujo el error.
2. Se detienen nuevas liberaciones mientras se analiza el problema.
3. Se puede restaurar en Vercel una versión anterior que haya funcionado correctamente.
4. Se utiliza `git revert` para revertir el cambio problemático sin eliminar el historial del repositorio.
5. El cambio de reversión vuelve a pasar por GitHub Actions.
6. Se ejecutan nuevamente las pruebas básicas del sistema.
7. Se registra el resultado del rollback.

Ejemplo:

```bash
git log --oneline
git revert <SHA_DEL_COMMIT>
git push origin main
```

El uso de `git revert` permite mantener un historial auditable y evita reescribir el historial compartido del proyecto.

---

## Evidencia de ejecución

Durante la práctica se ejecutaron correctamente:

```bash
npm ci
npm run lint
npm test
npm run build
```

Resultado obtenido:

```text
✔ registra un cliente y valida una solicitud OAuth con PKCE
✔ rechaza redirect URI o verificador PKCE diferentes
✔ preserva el correlation ID en toda la traza exitosa
✔ registra el span y la traza fallidos con código de error

2 archivos de prueba, 4 casos definidos
tests: 2
pass: 2
fail: 0
```

El build de producción también finalizó correctamente:

```text
vite building client environment for production...
✓ 1862 modules transformed.
✓ built
```

El código fue posteriormente enviado a la rama `main` del repositorio, activando el flujo de integración continua configurado.

---

## Conclusión

La implementación permite que **SecureHome IoT** disponga de un proceso básico y reproducible de CI/CD. Antes de considerar una versión lista para despliegue, el código pasa por instalación controlada de dependencias, análisis con ESLint, pruebas automáticas y construcción de producción.

Además, el manejo de secretos mediante variables de entorno, la identificación de artefactos mediante el SHA del commit y la estrategia de rollback con Git/Vercel proporcionan una base para realizar despliegues más seguros, trazables y recuperables ante errores.
