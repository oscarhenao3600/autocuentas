# Formatos Cuentas - Sistema de Gestión de Contratistas

Plataforma completa (Frontend en React + Backend en Node.js + MongoDB) para la gestión automatizada de cuentas de cobro y contratos, potenciada por Inteligencia Artificial (Google Gemini) para la lectura automática de minutas.

---

## 🚀 Despliegue Rápido (Docker)

El sistema está completamente Dockerizado, lo que significa que puedes ejecutarlo en cualquier servidor o computador local sin necesidad de instalar Node.js ni configurar bases de datos manualmente.

### Prerrequisitos
- Tener instalado [Docker](https://docs.docker.com/get-docker/) y [Docker Compose](https://docs.docker.com/compose/install/).

### 1. Configuración de Variables de Entorno (`.env`)

Antes de construir la imagen, debes definir tus credenciales privadas.
En la carpeta raíz del proyecto, asegúrate de que el archivo `docker-compose.yml` va a leer un archivo `.env`. Puedes crear un archivo llamado `.env` en la raíz del proyecto (junto al docker-compose) con el siguiente contenido:

```env
# Clave secreta para firmar los tokens de sesión (JWT)
# Cambia esto por una cadena larga y segura en producción
JWT_SECRET=tu_clave_secreta_super_segura_123

# API Key de Google Gemini (Obligatoria para la IA que lee los contratos)
# Consíguela gratis en: https://aistudio.google.com/app/apikey
GEMINI_API_KEY=AIzaSyTu_AQUI_PONES_TU_API_KEY_REAL
```

*(Nota: En Docker Compose, la base de datos se conecta automáticamente por la red interna en `mongodb://mongodb:27017/formatos_cuentas`, así que no necesitas configurar la URL de Mongo en el `.env` a menos que quieras apuntar a una base de datos externa).*

### 2. Construir y Levantar el Sistema

Una vez configurado tu `.env`, abre tu terminal en la carpeta raíz del proyecto y ejecuta:

```bash
docker-compose up --build -d
```

Este comando hará lo siguiente automáticamente:
1. Descargará la base de datos MongoDB y la ejecutará en el puerto `27017`.
2. Compilará el Backend (Node.js) y lo expondrá en el puerto `5000`.
3. Compilará el Frontend (React/Vite) para producción y lo servirá a través de un servidor ultra-rápido Nginx en el puerto `80`.

### 3. Acceder a la Aplicación

- **Frontend (Sitio Web):** Abre tu navegador y ve a `http://localhost`. (Si estás en un servidor, usa la IP pública de tu servidor).
- **Backend (API):** Responde internamente en el puerto `5000` (las rutas de frontend hacia `/api` son manejadas por Nginx automáticamente para evitar problemas de CORS).

---

## 📂 Estructura de Volúmenes (Datos Persistentes)

Al usar Docker Compose, creamos 3 "Volúmenes" para asegurar que tu información nunca se pierda aunque apagues o elimines los contenedores:

1. `mongodb_data`: Guarda todos los usuarios, contratos y cuentas en la base de datos.
2. `backend_uploads`: Guarda los PDFs de Minutas, RUTs, Certificados Bancarios e imágenes de evidencias que suben los contratistas.
3. `backend_generated`: Guarda los documentos finales de Microsoft Word (`.docx`) de las cuentas de cobro generadas.

---

## 🛠️ Comandos Útiles de Docker

- **Detener el sistema (sin borrar datos):**
  ```bash
  docker-compose stop
  ```
- **Detener y borrar los contenedores:**
  ```bash
  docker-compose down
  ```
- **Ver los logs (errores o consola) del backend:**
  ```bash
  docker logs formatos_cuentas_backend -f
  ```
- **Reiniciar la app tras aplicar cambios en el código:**
  ```bash
  docker-compose up --build -d
  ```

---

## 🔒 Consideraciones de Seguridad en Producción
- Asegúrate de cambiar `JWT_SECRET` a una clave encriptada de 64 caracteres.
- Por defecto Nginx expone el puerto `80` (HTTP). Si sales a producción, se recomienda configurar un certificado SSL (HTTPS) con Let's Encrypt / Certbot.
- La aplicación cuenta con protecciones internas (Límite de peticiones, saneamiento de Mongo y Cabeceras seguras mediante Helmet) ya configuradas en `server.js`.
