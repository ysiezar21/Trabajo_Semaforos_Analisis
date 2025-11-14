// Web Worker que simula el ciclo de un semáforo individual en paralelo
// Este código se ejecuta en un hilo separado del hilo principal de React
// 
// Mensajes que puede recibir:
// - { tipo: 'iniciarVerde', duracion } -> Inicia ciclo: verde (duracion seg) → parpadeo amarillo (2 seg) → rojo
// - { tipo: 'forzarRojo' } -> Interrumpe y cambia a rojo inmediatamente
// - { tipo: 'detener' } -> Detiene la ejecución

// Bandera para interrumpir el ciclo cuando se recibe un mensaje de pausa o fuerza a rojo
let abortar = false

// Función auxiliar para pausar la ejecución (simula un temporizador)
const dormir = (ms) => new Promise((res) => setTimeout(res, ms))

// Manejador de mensajes del hilo principal
self.onmessage = async (e) => {
  const msg = e.data
  try {
    if (msg?.tipo === 'iniciarVerde') {
      // Recibimos instrucción de iniciar el ciclo verde
      abortar = false
      await ejecutarCiclo(msg.duracion)
    } else if (msg?.tipo === 'forzarRojo') {
      // Recibimos instrucción de cambiar a rojo inmediatamente (botón Detener)
      abortar = true
      postMessage({ tipo: 'estado', estado: 'rojo' })
      postMessage({ tipo: 'terminado' })
    } else if (msg?.tipo === 'detener') {
      // Recibimos instrucción de detener sin reportar nada
      abortar = true
    }
  } catch (err) {
    postMessage({ tipo: 'error', mensaje: String(err) })
  }
}

// Función principal que ejecuta el ciclo completo del semáforo
async function ejecutarCiclo(duracionSeg) {
  // Asegurar que la duración sea al menos 1 segundo
  let restante = Math.max(1, Math.floor(duracionSeg))
  
  // FASE 1: LUZ VERDE (durante 'duracion' segundos)
  // Reportar que está en verde y enviar el tiempo restante
  postMessage({ tipo: 'estado', estado: 'verde', restante })

  // Ir decrementando cada segundo hasta quedar 2 segundos (entonces cambia a amarillo)
  while (restante > 2) {
    // Si recibimos una orden de parar, interrumpir
    if (abortar) return
    // Esperar 1 segundo
    await dormir(1000)
    // Decrementar el contador
    restante -= 1
    // Reportar el nuevo tiempo restante
    postMessage({ tipo: 'estado', estado: 'verde', restante })
  }

  // FASE 2: PARPADEO AMARILLO (últimos 2 segundos)
  // En los últimos 2 segundos, la luz amarilla parpadea cada 500ms (alternando encendida/apagada)
  let parpadeoRestante = 2
  const intervaloParpadeo = 500 // Alternar cada 500 ms (encender, apagar, encender, apagar)
  
  while (parpadeoRestante > 0) {
    if (abortar) return
    
    // Encender la luz amarilla
    postMessage({ tipo: 'estado', estado: 'amarillo_parpadeo', encendido: true, restante: parpadeoRestante })
    await dormir(intervaloParpadeo)
    
    if (abortar) return
    
    // Apagar la luz amarilla
    postMessage({ tipo: 'estado', estado: 'amarillo_parpadeo', encendido: false, restante: parpadeoRestante })
    await dormir(intervaloParpadeo)
    
    // Decrementar el contador del parpadeo
    parpadeoRestante -= 1
  }

  // FASE 3: LUZ ROJA
  // El ciclo terminó, cambiar a rojo
  if (abortar) return
  postMessage({ tipo: 'estado', estado: 'rojo' })
  // Enviar mensaje de "terminado" para que el componente React pase al siguiente semáforo
  postMessage({ tipo: 'terminado' })
}
