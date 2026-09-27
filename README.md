# Formatos Cuentas - Sistema Automatizado de Gestión de Contratistas

Plataforma integral (**Frontend React + Backend Node.js + MongoDB + Bot Telegram + IA Google Gemini**) para la generación, gestión y aprobación automática de cuentas de cobro, informes de actividades y certificados de supervisión para contratistas del sector público y privado.

El proyecto está diseñado y optimizado para ejecutarse tanto en **entornos de desarrollo local (Windows)** como en **producción en servidores de bajos recursos (Raspberry Pi 3 con 1 GB de RAM)** mediante **Docker Compose**.

---

## 📋 Arquitectura y Componentes

* **Frontend**: React 19, Vite, Framer Motion, Lucide Icons, servido a través de **Nginx**.
* **Backend**: Node.js 20 (Debian Bookworm Slim), Express 5, Mongoose, Docxtemplater, PDF-lib, Google Generative AI (Gemini).
* **Base de Datos**: MongoDB 4.4.18 (compatible con arquitectura ARM Cortex-A53 y memoria acotada).
* **Integración Telegram**: Bot interactivo para recepción de evidencias, recordatorios automáticos de corte y entrega de respaldos.
* **Seguridad y Resiliencia**: Rotación de logs limitada a 30MB, Healthcheck en tiempo real, protección contra OOM, reconexión automática ante fallos de disco.

---

## 🍓 Guía de Despliegue en Producción (Raspberry Pi 3)

Sigue estos pasos detallados para instalar y poner en marcha el sistema en una Raspberry Pi 3 con Raspberry Pi OS.

### Paso 1: Configurar Memoria SWAP (Obligatorio para 1 GB de RAM)

Para que el empaquetado de Vite y la base de datos se ejecuten sin problemas de memoria (*Out of Memory*), incrementa la memoria swap a 1024 MB:

```bash
sudo dphys-swapfile swapoff
sudo nano /etc/dphys-swapfile
```
Cambia el valor a:
```ini
CONF_SWAPSIZE=1024
```
Guarda (`Ctrl + O`, `Enter`, `Ctrl + X`) y aplica los cambios:
```bash
sudo dphys-swapfile setup
sudo dphys-swapfile swapon
```
*(Verifica con `free -m` que la línea `Swap` muestre al menos 1024 MB).*

---

### Paso 2: Habilitar Cgroups de Memoria en el Kernel

Permite a Docker limitar el uso de memoria de los contenedores para proteger la estabilidad del sistema:

1. Edita el archivo de arranque del kernel:
   * **En Raspberry Pi OS Bookworm (Debian 12):**
     ```bash
     sudo nano /boot/firmware/cmdline.txt
     ```
   * **En versiones anteriores (Bullseye / Buster):**
     ```bash
     sudo nano /boot/cmdline.txt
     ```
2. > [!IMPORTANT]
   > Todo el contenido de `cmdline.txt` debe mantenerse en **UNA SOLA LÍNEA**. No presiones *Enter*.

   Agrega un espacio al final de esa única línea y añade:
   ```text
   cgroup_enable=cpuset cgroup_enable=memory cgroup_memory=1
   ```
3. Guarda (`Ctrl + O`, `Enter`, `Ctrl + X`) y reinicia la Raspberry Pi:
   ```bash
   sudo reboot
   ```

---

### Paso 3: Clonar el Proyecto y Configurar Variables de Entorno

1. Clona el repositorio en tu carpeta de usuario:
   ```bash
   git clone https://github.com/oscarhenao3600/autocuentas.git
   cd autocuentas
   ```

2. Crea tu archivo `.env` a partir de la plantilla:
   ```bash
   cp .env.example .env
   nano .env
   ```

3. Completa los valores requeridos:
   ```env
   PORT=5000

   # Base de datos local de Docker:
   MONGODB_URI=mongodb://mongodb:27017/formatos_cuentas

   # Clave secreta para tokens JWT:
   JWT_SECRET=tu_clave_secreta_super_segura_de_produccion

   # API Key de Google Gemini (Obligatoria para la extracción de minutas con IA):
   GEMINI_API_KEY=AIzaSy...

   # Token de Telegram Bot (obtenido con @BotFather):
   TELEGRAM_BOT_TOKEN=8219991478:AA...

   # Tu Telegram Chat ID personal para recibir alertas y copias de seguridad:
   # (Obtén tu ID escribiendo a @userinfobot en Telegram)
   TELEGRAM_ADMIN_CHAT_ID=123456789

   # Retención de respaldos en días:
   RETENTION_DAYS=14

   # Salario Mínimo Legal Vigente para Colombia:
   SMMLV=1423500
   ```

> [!TIP]
> **Ahorro de ~350 MB de RAM en la Raspberry Pi:**
> Si prefieres liberar la memoria de la base de datos para que la Raspberry Pi trabaje más holgada, crea un clúster gratuito en [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) y coloca la cadena `mongodb+srv://...` en tu variable `MONGODB_URI`.

---

### Paso 4: Construir y Levantar los Contenedores

Puedes usar el script automatizado:
```bash
chmod +x deploy-pi.sh
./deploy-pi.sh
```

O hacerlo manualmente con Docker Compose:
```bash
docker compose up -d --build
```

---

### Paso 5: Crear el Usuario Administrador Inicial

Una vez levantados los contenedores, ejecuta el script de inicialización dentro del backend:
```bash
docker compose exec backend node seed.js
```
Esto creará el usuario administrador por defecto:
* **Correo:** `oscarhenao3600@gmail.com`
* **Contraseña:** `Fg@uniquindio75510` *(Cámbiala después de ingresar)*.

---

### Paso 6: Configurar Auto-arranque tras Apagón o Reinicio (systemd)

Asegura que tu aplicación se levante automáticamente si la Raspberry Pi se reinicia o recupera energía tras un corte de luz:

```bash
sudo cp autocuentas.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable autocuentas.service
```

---

### Paso 7: Programar Respaldos Automáticos Diarios (Cron + Telegram)

El script `backup-pi.sh` genera una copia comprimida de la base de datos MongoDB, los archivos subidos (`uploads`), las plantillas Word (`templates`) y la configuración `.env`, eliminando respaldos antiguos y enviando el archivo a tu Telegram:

1. Concede permisos de ejecución y prueba el respaldo manual:
   ```bash
   chmod +x backup-pi.sh
   ./backup-pi.sh
   ```
2. Programa la ejecución diaria automática a las **3:00 AM**:
   ```bash
   crontab -e
   ```
   Agrega esta línea al final del archivo:
   ```text
   0 3 * * * /home/oscarhenao/autocuentas/backup-pi.sh >> /home/oscarhenao/backups/backup.log 2>&1
   ```

---

## 🌐 Acceso a la Aplicación

Para acceder desde tu computadora, tablet o celular conectado a la misma red:

1. Averigua la dirección IP de tu Raspberry Pi:
   ```bash
   hostname -I
   ```
2. Abre tu navegador web e ingresa a:
   ```text
   http://<IP_DE_TU_RASPBERRY>
   ```
   *(Ejemplo: `http://192.168.1.50`)*.

### Rutas Administrativas
Al iniciar sesión con una cuenta de rol `admin`:
* **Dashboard Principal:** `http://<IP_DE_TU_RASPBERRY>/dashboard`
* **Gestión de Funcionarios/Contratistas:** `http://<IP_DE_TU_RASPBERRY>/admin/users`
* **Configuración de Formatos:** `http://<IP_DE_TU_RASPBERRY>/admin/formats`
* **Revisión de Cuentas de Cobro:** `http://<IP_DE_TU_RASPBERRY>/admin/accounts`
* **Gestor de Archivos y Documentos:** `http://<IP_DE_TU_RASPBERRY>/admin/documents`
* **Monitoreo de Salud de la API:** `http://<IP_DE_TU_RASPBERRY>/api/health`

---

## 💻 Desarrollo Local en Windows (sin Docker)

Si deseas trabajar en desarrollo local en tu computadora Windows:

1. **Base de Datos**: Inicia MongoDB localmente o usa el contenedor de base de datos:
   ```powershell
   docker compose up -d mongodb
   ```
2. **Backend**:
   ```powershell
   cd backend
   npm install
   npm run dev
   ```
   *(El servidor iniciará en `http://localhost:5000`)*.
3. **Frontend**:
   ```powershell
   cd frontend
   npm install
   npm run dev
   ```
   *(La aplicación iniciará en `http://localhost:5173`, redirigiendo automáticamente las peticiones de `/api`, `/uploads` y `/generated` al puerto `5000`)*.

---

## 🛠️ Comandos de Mantenimiento y Diagnóstico

* **Ver el estado de los contenedores:**
  ```bash
  docker compose ps
  ```
* **Ver logs en tiempo real:**
  ```bash
  docker compose logs -f backend
  docker compose logs -f frontend
  ```
* **Ver consumo de CPU y RAM de cada contenedor:**
  ```bash
  docker stats
  ```
* **Reiniciar el backend tras una actualización:**
  ```bash
  docker compose restart backend
  ```
* **Consultar el estado de salud de la API:**
  ```bash
  curl http://localhost:5000/api/health
  ```
* **Detener todos los servicios:**
  ```bash
  docker compose down
  ```

---

## 🛡️ Volúmenes de Persistencia de Datos

Los datos se guardan en volúmenes gestionados por Docker para no perder información al actualizar contenedores:
* `mongodb_data`: Documentos y colecciones de la base de datos.
* `backend_uploads`: Archivos subidos por los contratistas (PDFs, RUT, Minutas, Evidencias).
* `backend_generated`: Documentos Word (`.docx`) y archivos ZIP de cuentas generadas.
* `backend_templates`: Plantillas oficiales de los formatos institucionales.
