#!/bin/bash
# ===================================================================
# SCRIPT DE COPIA DE SEGURIDAD AUTOMÁTICA - FORMATOS CUENTAS
# Guarda base de datos MongoDB, archivos subidos, plantillas y .env
# Rotación automática (últimos 14 días) y notificación opcional por Telegram
# ===================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# 1. Cargar variables de entorno si existen
if [ -f .env ]; then
    set -a
    source .env 2>/dev/null || true
    set +a
fi

# Directorio donde se almacenarán los backups
BACKUP_DIR="${BACKUP_DIR:-$HOME/backups/autocuentas}"
mkdir -p "$BACKUP_DIR"

TIMESTAMP=$(date +"%Y-%m-%d_%H%M%S")
TEMP_BACKUP_DIR="/tmp/autocuentas_backup_${TIMESTAMP}"
mkdir -p "$TEMP_BACKUP_DIR"

echo "📦 [$(date +'%T')] Iniciando respaldo de Formatos Cuentas..."

# 2. Respaldo de Base de Datos MongoDB
echo "💾 [1/4] Respaldando base de datos MongoDB..."
if docker ps --format '{{.Names}}' | grep -q "^formatos_cuentas_db$"; then
    # Respaldo desde el contenedor local de MongoDB
    docker exec formatos_cuentas_db mongodump --archive=/tmp/mongo_dump.gz --gzip 2>/dev/null || true
    if docker cp formatos_cuentas_db:/tmp/mongo_dump.gz "$TEMP_BACKUP_DIR/mongo_dump.gz" 2>/dev/null; then
        docker exec formatos_cuentas_db rm -f /tmp/mongo_dump.gz
        echo "   ✅ MongoDB local respaldado exitosamente."
    else
        echo "   ⚠️ Advertencia: No se pudo volcar mongodump desde el contenedor local."
    fi
elif [[ "$MONGODB_URI" =~ mongodb\+srv:\/\/ ]]; then
    # Si usa MongoDB Atlas, intentamos volcar con mongodump si está instalado
    if command -v mongodump &>/dev/null; then
        mongodump --uri="$MONGODB_URI" --archive="$TEMP_BACKUP_DIR/mongo_dump.gz" --gzip --quiet || true
        echo "   ✅ MongoDB Atlas respaldado."
    else
        echo "   ℹ️ Base de datos en MongoDB Atlas (respaldos automáticos en la nube)."
    fi
fi

# 3. Respaldo de Archivos y Plantillas
echo "📁 [2/4] Respaldando archivos subidos y plantillas..."
if docker ps --format '{{.Names}}' | grep -q "^formatos_cuentas_backend$"; then
    docker cp formatos_cuentas_backend:/app/uploads "$TEMP_BACKUP_DIR/uploads" 2>/dev/null || true
    docker cp formatos_cuentas_backend:/app/templates "$TEMP_BACKUP_DIR/templates" 2>/dev/null || true
else
    [ -d "backend/uploads" ] && cp -r backend/uploads "$TEMP_BACKUP_DIR/uploads" 2>/dev/null || true
    [ -d "backend/templates" ] && cp -r backend/templates "$TEMP_BACKUP_DIR/templates" 2>/dev/null || true
fi

# Respaldo de configuración .env
[ -f .env ] && cp .env "$TEMP_BACKUP_DIR/env_backup"

# 4. Comprimir todo en un archivo .tar.gz
echo "🗜️ [3/4] Empaquetando y comprimiendo respaldo..."
TAR_FILE="${BACKUP_DIR}/backup_autocuentas_${TIMESTAMP}.tar.gz"
tar -czf "$TAR_FILE" -C "$TEMP_BACKUP_DIR" .
rm -rf "$TEMP_BACKUP_DIR"

FILE_SIZE=$(du -h "$TAR_FILE" | cut -f1)
echo "✅ Respaldo creado en: $TAR_FILE (Tamaño: $FILE_SIZE)"

# 5. Rotación de copias antiguas (conservar los últimos 14 días)
RETENTION_DAYS=${RETENTION_DAYS:-14}
echo "🧹 [4/4] Limpiando respaldos con más de ${RETENTION_DAYS} días..."
find "$BACKUP_DIR" -name "backup_autocuentas_*.tar.gz" -type f -mtime +"$RETENTION_DAYS" -exec rm -f {} +

# 6. Notificación opcional por Telegram si está configurado
if [ -n "$TELEGRAM_BOT_TOKEN" ] && [ -n "$TELEGRAM_ADMIN_CHAT_ID" ]; then
    echo "📲 Enviando notificación a Telegram..."
    MSG="✅ *Copia de Seguridad Exitosa - Formatos Cuentas*
📅 *Fecha:* $(date +'%Y-%m-%d %H:%M:%S')
📦 *Archivo:* \`$(basename "$TAR_FILE")\`
📊 *Tamaño:* ${FILE_SIZE}
🖥️ *Host:* $(hostname)"

    curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
        -d "chat_id=${TELEGRAM_ADMIN_CHAT_ID}" \
        -d "parse_mode=Markdown" \
        -d "text=${MSG}" >/dev/null || true

    # Si el archivo es menor a 45MB, enviarlo adjunto por Telegram
    RAW_SIZE_BYTES=$(stat -c%s "$TAR_FILE" 2>/dev/null || stat -f%z "$TAR_FILE" 2>/dev/null || echo 0)
    if [ "$RAW_SIZE_BYTES" -gt 0 ] && [ "$RAW_SIZE_BYTES" -lt 45000000 ]; then
        curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendDocument" \
            -F "chat_id=${TELEGRAM_ADMIN_CHAT_ID}" \
            -F "document=@${TAR_FILE}" \
            -F "caption=📦 Archivo de Respaldo (${TIMESTAMP})" >/dev/null || true
    fi
fi

echo "🎉 [$(date +'%T')] Proceso de copia de seguridad finalizado con éxito."
