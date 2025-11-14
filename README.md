# 🚦 Intersección de Semáforos

Simulación de una intersección de 4 semáforos que rotan en sentido horario, utilizando Web Workers para ejecución paralela en React + Vite.

## Características

- **4 semáforos independientes** en rotación clockwise (0→1→2→3→0)
- **Web Workers** para ejecutar cada semáforo en paralelo sin bloquear la UI
- **Contador regresivo** que se reinicia y decrementa con cada cambio
- **Parpadeo amarillo** en los últimos 2 segundos antes de cambiar a rojo
- **Interfaz minimalista** con diseño limpio y responsivo
- **Todo en español** - variables, mensajes y comentarios

## Estructura del Proyecto

```
src/
├── App.jsx              # Componente raíz
├── main.jsx             # Punto de entrada de React
├── semaforos.jsx        # Componente principal con lógica de orquestación
├── semaforo.worker.js   # Web Worker que ejecuta ciclos de semáforos en paralelo
├── semaforos.css        # Estilos CSS de la intersección
└── index.css            # Estilos globales
```

## Instalación

```bash
npm install
```

## Desarrollo

```bash
npm run dev
```

Se abrirá en `http://localhost:5173`

## Compilación para producción

```bash
npm run build
```

## Cómo funciona

1. **React (hilo principal)**: Maneja la UI y orquesta a los workers
2. **Web Workers (hilos paralelos)**: Cada worker ejecuta el ciclo completo de un semáforo:
   - Verde durante N segundos (con contador que decrementa cada segundo)
   - Amarillo parpadeando durante 2 segundos
   - Rojo hasta que le toque el turno nuevamente

3. **Comunicación**: El componente se comunica con los workers vía `postMessage()` para iniciar ciclos y recibir actualizaciones de estado

## Tecnologías

- React 18.2.0
- Vite (bundler)
- Web Workers API
- CSS Grid para el layout de la intersección

## Uso

- **Input**: Ajusta la duración en segundos (mínimo 5)
- **Botón Iniciar**: Comienza la simulación
- **Botón Detener**: Pausa y fuerza todos los semáforos a rojo
- **Contador**: Muestra tiempo restante del semáforo actual
