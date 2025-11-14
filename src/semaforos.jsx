import React, { useEffect, useRef, useState } from 'react'
import './semaforos.css'

// Función que crea un Web Worker para que un semáforo se ejecute en paralelo
const crearTrabajador = () => new Worker(new URL('./semaforo.worker.js', import.meta.url), { type: 'module' })

export default function Semaforos() {
  // Índice del semáforo que actualmente tiene luz verde (0, 1, 2 o 3)
  const [indiceVerde, setIndiceVerde] = useState(0)
  // Duración en segundos que dura el verde en cada semáforo
  const [duracionVerde, setDuracionVerde] = useState(8)
  // Booleano que indica si el sistema está en marcha o detenido
  const [ejecutando, setEjecutando] = useState(false)

  // Estado de los 4 semáforos: cada uno tiene si está en rojo, amarillo, verde o parpadeando
  const [estadoSemaforos, setEstadoSemaforos] = useState([
    { rojo: false, amarillo: false, verde: true, parpadeando: false },
    { rojo: true, amarillo: false, verde: false, parpadeando: false },
    { rojo: true, amarillo: false, verde: false, parpadeando: false },
    { rojo: true, amarillo: false, verde: false, parpadeando: false },
  ])

  // Referencias para evitar cierres de variables en los handlers de Web Workers
  const trabajadoresRef = useRef([])
  const ejecutandoRef = useRef(ejecutando)
  const duracionVerdeRef = useRef(duracionVerde)
  const indiceVerdeRef = useRef(indiceVerde)
  // Contador regresivo que muestra el tiempo restante del semáforo actual
  const [restante, setRestante] = useState(duracionVerde)

  // Estos efectos mantienen las referencias sincronizadas con el estado real
  // Esto evita que los Workers lean valores antiguos guardados en cierres
  useEffect(() => { ejecutandoRef.current = ejecutando }, [ejecutando])
  useEffect(() => { duracionVerdeRef.current = duracionVerde }, [duracionVerde])
  useEffect(() => { indiceVerdeRef.current = indiceVerde }, [indiceVerde])

  // Crear y configurar los 4 Web Workers cuando el componente se monta
  useEffect(() => {
    // Creamos 4 workers independientes, uno para cada semáforo
    const trabajadores = [crearTrabajador(), crearTrabajador(), crearTrabajador(), crearTrabajador()]
    trabajadoresRef.current = trabajadores

    // Configurar el manejador de mensajes para cada worker
    trabajadores.forEach((w, idx) => {
      w.onmessage = (ev) => {
        const msg = ev.data
        // Si el sistema no está ejecutando, solo aceptar mensajes que confirmen luz roja
        if (!ejecutandoRef.current) {
          if (msg?.tipo === 'estado' && msg.estado === 'rojo') {
            setEstadoSemaforos((prev) => {
              const siguiente = prev.map((s) => ({ ...s }))
              siguiente[idx] = { rojo: true, amarillo: false, verde: false, parpadeando: false }
              return siguiente
            })
          }
          // Ignorar otros mensajes para evitar que estados retrasados enciendan luces incorrectamente
          return
        }

        // Si el mensaje es de cambio de estado (rojo, verde, amarillo)
        if (msg.tipo === 'estado') {
          setEstadoSemaforos((prev) => {
            const siguiente = prev.map((s) => ({ ...s }))
            if (msg.estado === 'verde') {
              // El semáforo está en verde
              siguiente[idx] = { rojo: false, amarillo: false, verde: true, parpadeando: false }
              // Si este es el semáforo activo, actualizar el contador regresivo
              if (idx === indiceVerdeRef.current) setRestante(msg.restante ?? duracionVerdeRef.current)
            } else if (msg.estado === 'rojo') {
              // El semáforo está en rojo
              siguiente[idx] = { rojo: true, amarillo: false, verde: false, parpadeando: false }
              // Si este es el semáforo activo, poner el contador en 0
              if (idx === indiceVerdeRef.current) setRestante(0)
            } else if (msg.estado === 'amarillo_parpadeo') {
              // El semáforo está en modo parpadeo amarillo (últimos 2 segundos)
              siguiente[idx] = { rojo: false, amarillo: !!msg.encendido, verde: false, parpadeando: true }
              // Actualizar el contador con el tiempo restante del parpadeo
              if (idx === indiceVerdeRef.current && msg.restante !== undefined) setRestante(msg.restante)
            }
            return siguiente
          })
        } else if (msg.tipo === 'terminado') {
          // El semáforo actual completó su ciclo (verde + parpadeo amarillo + rojo)
          // Si seguimos ejecutando, pasar al siguiente semáforo en sentido horario
          if (ejecutandoRef.current) {
            const siguienteIdx = (idx + 1) % 4 // Rotar: 0→1→2→3→0
            // Reiniciar el contador antes de cambiar al siguiente semáforo
            setRestante(duracionVerdeRef.current)
            setIndiceVerde(siguienteIdx)
            const wSiguiente = trabajadoresRef.current[siguienteIdx]
            // Enviar mensaje al siguiente worker para que inicie su ciclo verde
            if (wSiguiente) wSiguiente.postMessage({ tipo: 'iniciarVerde', duracion: duracionVerdeRef.current })
          }
        }
      }
    })

    // Función de limpieza: detener todos los workers cuando el componente se desmonta
    return () => {
      trabajadoresRef.current.forEach((w) => {
        try { w.postMessage({ tipo: 'detener' }) } catch (e) {}
        try { w.terminate() } catch (e) {}
      })
      trabajadoresRef.current = []
    }
  }, [])

  // Este efecto reacciona cuando el usuario presiona Iniciar o Detener
  useEffect(() => {
    if (ejecutando) {
      // El sistema está iniciando: enviar mensaje al worker actual para comenzar ciclo verde
      const w = trabajadoresRef.current[indiceVerde]
      if (w) {
        setRestante(duracionVerdeRef.current)
        w.postMessage({ tipo: 'iniciarVerde', duracion: duracionVerdeRef.current })
      }
    } else {
      // El sistema se está deteniendo: forzar todos los semáforos a rojo
      trabajadoresRef.current.forEach((w) => w && w.postMessage({ tipo: 'forzarRojo' }))
      setEstadoSemaforos((prev) => prev.map((s, i) => ({ rojo: i === indiceVerde ? false : true, amarillo: false, verde: i === indiceVerde, parpadeando: false })))
      setRestante(0)
    }
  }, [ejecutando])

  // Función para iniciar el sistema
  const iniciar = () => setEjecutando(true)
  
  // Función para detener el sistema y forzar todos los semáforos a rojo
  const detener = () => {
    setEjecutando(false)
    // Enviar mensaje a todos los workers para que cambien a rojo inmediatamente
    trabajadoresRef.current.forEach((w) => { try { w.postMessage({ tipo: 'forzarRojo' }) } catch (e) {} })
    // Actualizar la UI: todos en rojo, sin verde encendido
    setEstadoSemaforos([
      { rojo: true, amarillo: false, verde: false, parpadeando: false },
      { rojo: true, amarillo: false, verde: false, parpadeando: false },
      { rojo: true, amarillo: false, verde: false, parpadeando: false },
      { rojo: true, amarillo: false, verde: false, parpadeando: false },
    ])
    // Poner el contador en 0
    setRestante(0)
    // Resetear el índice para que la próxima vez comience desde el primero
    setIndiceVerde(0)
  }

  return (
    <div className="semaforos-app">
      <h1>🚦 Intersección de Semáforos</h1>

      <div className="controls">
        <label>
          Duración por semáforo (seg):
          {/* Input para cambiar la duración: mínimo 5 segundos, deshabilitado mientras el sistema está ejecutando */}
          <input type="number" min={5} disabled={ejecutando} value={duracionVerde} onChange={(e) => setDuracionVerde(Math.max(5, parseInt(e.target.value || '5', 10)))} />
        </label>
        <button onClick={iniciar} disabled={ejecutando} className="btn">Iniciar</button>
        <button onClick={detener} disabled={!ejecutando} className="btn">Detener</button>
        {/* Mostrar el tiempo restante del semáforo actual */}
        <div className="status">Tiempo restante: {restante}s</div>
      </div>

      {/* Grid de 3x3 que simula una intersección de calles con 4 semáforos en los lados */}
      <div className="intersection">
        {/* Renderizar los 4 semáforos usando map */}
        {estadoSemaforos.map((s, i) => (
          <div key={i} className={`light light-${i}`}>
            {/* Contenedor gris opaco que simula el armazón del semáforo */}
            <div className="bulbs">
              {/* Las 3 luces: roja arriba, amarilla en medio, verde abajo */}
              <div className={`bulb bulb-red ${s.rojo ? 'on' : 'off'}`} />
              <div className={`bulb bulb-yellow ${s.amarillo ? 'on' : 'off'}`} />
              <div className={`bulb bulb-green ${s.verde ? 'on' : 'off'}`} />
            </div>
            {/* Etiqueta identificadora del carril */}
            <div className="light-label">Carril {i + 1}</div>
          </div>
        ))}
      </div>

    </div>
  )
}
