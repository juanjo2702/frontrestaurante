# 🎨 Guía de Despliegue - Frontend (React 19 + Vite + Tailwind 4)

Esta guía detalla los pasos necesarios para compilar y desplegar en producción el frontend de la plataforma de gestión de restaurantes (`frontRestaurante`).

---

## 📋 Requisitos del Sistema

*   **Node.js**: >= 18.x (Recomendado LTS)
*   **Gestor de Paquetes**: npm >= 9.x (incluido con Node) o yarn.

---

## 🛠️ Método 1: Compilación Estática y Servidor Web (Recomendado para Producción)

Dado que es una Single Page Application (SPA), el frontend se compila a archivos estáticos (HTML, JS, CSS) que pueden ser servidos extremadamente rápido por cualquier servidor web como Nginx, Apache o servicios CDN/PaaS.

### Paso 1: Configurar Variables de Entorno
Crea un archivo `.env.production` en la raíz de `frontRestaurante` para apuntar a la URL pública de tu backend:

```env
VITE_API_URL=https://api.tudominio.com
```

> [!IMPORTANT]
> En Vite, todas las variables de entorno destinadas al código del lado del cliente deben comenzar con el prefijo `VITE_`.
> Las variables de entorno se inyectan en el código durante el tiempo de compilación (`build time`), no en tiempo de ejecución.

### Paso 2: Instalar Dependencias
Instala los módulos de Node especificados en el `package.json`:

```bash
npm install
```

### Paso 3: Compilar para Producción
Genera la versión optimizada y minificada del frontend:

```bash
npm run build
```

Este comando creará una carpeta llamada `dist/` en la raíz de tu proyecto, que contiene todo el bundle estático listo para producción.

### Paso 4: Despliegue en un Servidor Web (Nginx)

Sube el contenido de la carpeta `dist/` a tu servidor (ej. `/var/www/restaurante-front`).

Crea un archivo de configuración en `/etc/nginx/sites-available/restaurante-front`:

```nginx
server {
    listen 80;
    server_name tudominio.com www.tudominio.com; # Tus dominios del frontend
    root /var/www/restaurante-front;

    index index.html;

    charset utf-8;

    # Compresión Gzip para mejorar tiempos de carga
    gzip on;
    gzip_vary on;
    gzip_min_length 10240;
    gzip_proxied any;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml application/javascript;
    gzip_disable "MSIE [1-6]\.";

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Caché estática agresiva para assets de Vite
    location ~* \.(?:ico|css|js|gif|jpe?g|png|woff2?|eot|ttf|svg)$ {
        expires 6M;
        access_log off;
        add_header Cache-Control "public, max-age=15552000, immutable";
    }

    location = /favicon.ico { access_log off; log_not_found off; }
    location = /robots.txt  { access_log off; log_not_found off; }

    error_page 404 /index.html;

    location ~ /\. {
        deny all;
    }
}
```

> [!IMPORTANT]
> La directiva `try_files $uri $uri/ /index.html;` es **CRÍTICA** para aplicaciones React Router. Asegura que cualquier ruta ingresada directamente en la barra del navegador (ej. `/waiter/dashboard`) sea redirigida a `index.html` para que React Router maneje la navegación del lado del cliente.

Habilita el sitio y reinicia Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/restaurante-front /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

## 🐋 Método 2: Despliegue con Docker

El frontend viene equipado con un `Dockerfile` y configuración unificada mediante Docker Compose.

### Paso 1: Configurar Variables en Docker
Asegúrate de que `frontRestaurante/.env.docker` tenga la URL correcta del backend (normalmente el puerto expuesto por el contenedor Nginx del backend):

```env
VITE_API_URL=http://localhost:8000
```

### Paso 2: Levantar Contenedor
Si estás desplegando el ecosistema completo desde la raíz del proyecto (`Restaurante`):

```bash
docker compose up -d --build
```

Esto levantará el contenedor de Node sirviendo el frontend en el puerto `5173`. Para un entorno productivo basado en Docker, se recomienda modificar el `Dockerfile` del frontend para usar un Nginx multilongitud que compile y sirva estáticos en vez del servidor de desarrollo de Vite.

---

## 🚀 Método 3: Plataformas PaaS y Estáticos (Vercel / Netlify / Hostinger)

Al ser una aplicación web de frontend estático, puedes hospedarla de forma gratuita o de muy bajo costo en plataformas modernas.

### Configuración en Vercel o Netlify:
1.  Conecta tu repositorio de GitHub (`frontRestaurante`).
2.  **Configuración de Compilación**:
    *   **Build Command**: `npm run build`
    *   **Output Directory**: `dist`
    *   **Install Command**: `npm install`
3.  **Variables de Entorno**: Agrega `VITE_API_URL` con el valor de tu API de Laravel.
4.  **Reescritura de Rutas (Redirects)**:
    *   **Para Vercel**: Crea un archivo `vercel.json` en la raíz del frontend:
        ```json
        {
          "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
        }
        ```
    *   **Para Netlify**: Crea un archivo `_redirects` en la carpeta `public/` con la siguiente línea:
        ```text
        /*    /index.html   200
        ```
