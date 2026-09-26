#!/bin/bash
# ===================================================================
# SCRIPT DE DESPLIEGUE AUTOMÁTICO EN RASPBERRY PI 3 (DOCKER)
# ===================================================================

set -e

echo "🚀 Iniciando despliegue de Formatos Cuentas en Raspberry Pi 3..."

# 1. Verificar archivo .env
if [ ! -f .env ]; then
    echo "⚠️ Archivo .env no encontrado. Copiando desde .env.example..."
    cp .env.example .env
    echo "ℹ️ Por favor edita .env con tus credenciales (GEMINI_API_KEY, TELEGRAM_BOT_TOKEN) antes de continuar."
    exit 1
fi

# 2. Verificar memoria Swap (Crucial para Raspberry Pi 3 con 1GB RAM)
SWAP_TOTAL=$(free -m | awk '/Swap:/ {print $2}')
if [ "$SWAP_TOTAL" -lt 512 ]; then
    echo "⚠️ ADVERTENCIA: La memoria Swap actual es de solo ${SWAP_TOTAL}MB."
    echo "   Para compilar y correr Docker en Raspberry Pi 3 se recomienda al menos 1024MB de Swap."
    echo "   Para aumentar el Swap en Raspberry Pi OS:"
    echo "     sudo dphys-swapfile swapoff"
    echo "     sudo nano /etc/dphys-swapfile  # Cambiar CONF_SWAPSIZE=1024"
    echo "     sudo dphys-swapfile setup"
    echo "     sudo dphys-swapfile swapon"
    echo "--------------------------------------------------------"
fi

# 3. Detectar comando de docker compose
if docker compose version &> /dev/null; then
    COMPOSE_CMD="docker compose"
elif command -v docker-compose &> /dev/null; then
    COMPOSE_CMD="docker-compose"
else
    echo "❌ Error: Docker Compose no está instalado. Instálalo con: sudo apt install docker-compose-plugin"
    exit 1
fi

# 4. Levantar contenedores
echo "📦 Construyendo y levantando contenedores con $COMPOSE_CMD..."
$COMPOSE_CMD up -d --build

# 5. Estado de los contenedores
echo ""
echo "✅ Despliegue finalizado con éxito."
$COMPOSE_CMD ps

IP_LOCAL=$(hostname -I | awk '{print $1}')
echo ""
echo "🌐 Aplicación disponible en:"
echo "   http://${IP_LOCAL}:80"
echo "   http://localhost:80"
echo "   Backend API: http://${IP_LOCAL}:5000/api"
