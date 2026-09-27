#!/bin/bash
# ===================================================================
# SCRIPT DE DESPLIEGUE EN RASPBERRY PI 3 (DOCKER)
# Soporta Raspberry Pi OS de 32 bits (armv7l) y 64 bits (aarch64)
# ===================================================================

set -e

echo "🚀 Iniciando despliegue de Formatos Cuentas en Raspberry Pi..."

# 1. Verificar archivo .env
if [ ! -f .env ]; then
    echo "⚠️ Archivo .env no encontrado. Creando desde .env.example..."
    cp .env.example .env
    echo "ℹ️ Por favor edita .env con tus credenciales antes de continuar."
    exit 1
fi

# Cargar variables de entorno
set -a
source .env 2>/dev/null || true
set +a

# 2. Verificar memoria Swap (Crucial para Raspberry Pi 3 con 1GB RAM)
SWAP_TOTAL=$(free -m | awk '/Swap:/ {print $2}')
if [ -n "$SWAP_TOTAL" ] && [ "$SWAP_TOTAL" -lt 512 ]; then
    echo "⚠️ ADVERTENCIA: La memoria Swap actual es de solo ${SWAP_TOTAL}MB."
    echo "   Para compilar y correr Docker en Raspberry Pi 3 se recomienda al menos 1024MB de Swap."
    echo "   Para aumentarlo en Raspberry Pi OS:"
    echo "     sudo dphys-swapfile swapoff"
    echo "     sudo nano /etc/dphys-swapfile  # Cambiar CONF_SWAPSIZE=1024"
    echo "     sudo dphys-swapfile setup"
    echo "     sudo dphys-swapfile swapon"
    echo "--------------------------------------------------------"
fi

# 3. Detectar arquitectura del procesador / sistema operativo
SYS_ARCH=$(uname -m)
echo "ℹ️ Arquitectura del sistema detectada: ${SYS_ARCH}"

# 4. Detectar comando de docker compose
if docker compose version &> /dev/null; then
    COMPOSE_CMD="docker compose"
elif command -v docker-compose &> /dev/null; then
    COMPOSE_CMD="docker-compose"
else
    echo "❌ Error: Docker Compose no está instalado. Instálalo con: sudo apt install docker-compose-plugin"
    exit 1
fi

# 5. Determinar servicios a levantar según arquitectura
SERVICES_TO_UP=""

if [[ "$SYS_ARCH" =~ ^armv7 ]] || [[ "$SYS_ARCH" =~ ^armhf ]]; then
    echo "⚠️ ATENCIÓN: Tu Raspberry Pi OS es de 32 bits (${SYS_ARCH})."
    echo "   MongoDB oficial no compila imágenes para 32 bits (linux/arm/v7)."
    
    # Verificar si el usuario ya configuró una URI externa o Atlas
    if [[ "$MONGODB_URI" =~ mongodb\+srv:\/\/ ]] || [[ "$MONGODB_URI" =~ :27017 ]] && [[ ! "$MONGODB_URI" =~ mongodb:\/\/mongodb:27017 ]]; then
        echo "✅ MONGODB_URI configurada hacia base de datos externa/Atlas."
        echo "   Levantando servicios: backend y frontend (sin contenedor local de MongoDB)..."
        SERVICES_TO_UP="backend frontend"
    else
        echo ""
        echo "❌ No se puede levantar el contenedor local de MongoDB en un sistema de 32 bits."
        echo "👉 SOLUCIÓN RECOMENDADA (Gratis y ahorra 350MB de RAM en la Pi):"
        echo "   1. Crea un cluster gratuito en MongoDB Atlas (https://www.mongodb.com/cloud/atlas)."
        echo "   2. Abre tu archivo .env y configura tu URI de Atlas:"
        echo "      MONGODB_URI=mongodb+srv://<usuario>:<password>@cluster0.xxxxx.mongodb.net/formatos_cuentas?retryWrites=true&w=majority"
        echo "   3. Vuelve a ejecutar este script: ./deploy-pi.sh"
        echo ""
        echo "👉 O si ya tienes un MongoDB en otra máquina de tu red local, pon su IP en MONGODB_URI."
        echo ""
        echo "Si deseas forzar el levantamiento de solo Backend y Frontend ahora:"
        read -p "¿Deseas levantar solo Backend y Frontend ahora? (s/n): " RESP
        if [[ "$RESP" =~ ^[sSyY] ]]; then
            SERVICES_TO_UP="backend frontend"
        else
            exit 1
        fi
    fi
else
    # Sistema de 64 bits (aarch64 o x86_64)
    if [[ "$MONGODB_URI" =~ mongodb\+srv:\/\/ ]]; then
        echo "ℹ️ Usando MongoDB Atlas remoto. Levantando backend y frontend..."
        SERVICES_TO_UP="backend frontend"
    else
        SERVICES_TO_UP="" # Levanta todo el stack (mongodb, backend, frontend)
    fi
fi

# 6. Levantar contenedores
echo "📦 Construyendo y levantando contenedores con $COMPOSE_CMD $SERVICES_TO_UP..."
$COMPOSE_CMD up -d --build $SERVICES_TO_UP

# 7. Estado de los contenedores
echo ""
echo "✅ Despliegue finalizado con éxito."
$COMPOSE_CMD ps

IP_LOCAL=$(hostname -I 2>/dev/null | awk '{print $1}') || IP_LOCAL="localhost"
echo ""
echo "🌐 Aplicación disponible en:"
echo "   http://${IP_LOCAL}:80"
echo "   http://localhost:80"
echo "   Backend API: http://${IP_LOCAL}:5000/api"
