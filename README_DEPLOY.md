# Guía de Deploy a Vercel

## Pasos para hacer deploy

### 1. Preparar el repositorio

Asegúrate de que tu código esté en GitHub, GitLab o Bitbucket:

```bash
git add .
git commit -m "Preparar para deploy"
git push origin main
```

### 2. Conectar con Vercel

1. Ve a [vercel.com](https://vercel.com) e inicia sesión (puedes usar tu cuenta de GitHub)
2. Haz clic en **"Add New Project"** o **"Import Project"**
3. Selecciona tu repositorio de GitHub
4. Vercel detectará automáticamente que es un proyecto Vite

### 3. Configurar el proyecto

Vercel debería detectar automáticamente:
- **Framework Preset**: Vite
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Install Command**: `npm install`

Si no lo detecta automáticamente, configura manualmente:
- Framework: Vite
- Root Directory: `./` (raíz del proyecto)
- Build Command: `npm run build`
- Output Directory: `dist`

### 4. Configurar Variables de Entorno

**IMPORTANTE**: Debes agregar las variables de entorno en Vercel:

1. En la configuración del proyecto, ve a **Settings** > **Environment Variables**
2. Agrega las siguientes variables:

```
VITE_SUPABASE_URL=https://vwaohhelvhvzwoyrmhve.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ3YW9oaGVsdmh2endveXJtaHZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMwODE2NTYsImV4cCI6MjA3ODY1NzY1Nn0.0xxYH1xHnkMxyyKLKfaHalc_En7A03R-lYt44foh9o0
```

**Nota**: Reemplaza estos valores con tus propias credenciales de Supabase si son diferentes.

3. Selecciona los ambientes donde aplicar (Production, Preview, Development)
4. Haz clic en **Save**

### 5. Deploy

1. Haz clic en **Deploy**
2. Vercel construirá y desplegará tu aplicación automáticamente
3. Una vez completado, recibirás una URL (ej: `tu-proyecto.vercel.app`)

### 6. Verificar el Deploy

1. Abre la URL proporcionada por Vercel
2. Verifica que la aplicación funcione correctamente
3. Revisa la consola del navegador para asegurarte de que no hay errores

## Configuración Adicional

### Dominio Personalizado (Opcional)

1. Ve a **Settings** > **Domains**
2. Agrega tu dominio personalizado
3. Sigue las instrucciones para configurar los DNS

### Variables de Entorno por Ambiente

Puedes configurar diferentes variables para:
- **Production**: Producción
- **Preview**: Pull requests y branches
- **Development**: Desarrollo local

## Solución de Problemas

### Error: Variables de entorno no encontradas
- Verifica que las variables estén configuradas en Vercel
- Asegúrate de que los nombres comiencen con `VITE_`
- Reinicia el deploy después de agregar variables

### Error: Build falla
- Revisa los logs de build en Vercel
- Asegúrate de que `package.json` tenga el script `build`
- Verifica que todas las dependencias estén en `package.json`

### Error: Página en blanco
- Verifica que el `outputDirectory` sea `dist`
- Revisa la configuración de `rewrites` en `vercel.json`
- Verifica que las rutas de React Router estén configuradas correctamente

## Comandos Útiles

```bash
# Instalar Vercel CLI (opcional)
npm i -g vercel

# Deploy desde terminal
vercel

# Deploy a producción
vercel --prod
```

