# 🎼 ORCHESTRATION.md — Protocolo de Orquestación y Delimitación de Agentes

Este documento define las fases de ejecución del ciclo de desarrollo (basado en el patrón **Gentle AI / Organic Driven Development**) y establece la delimitación estricta de responsabilidades de los subagentes para evitar solapamientos o modificaciones destructivas de código.

> 📎 Las reglas técnicas, el stack tecnológico y la estructura de archivos del proyecto se mantienen en [`agents.md`](./agents.md). Las habilidades exigidas por cada tarea se consultan en [`skills.md`](./skills.md).

---

## 🔄 Protocolo de Desarrollo en 5 Fases

Toda tarea o requerimiento asignado al equipo de IA debe avanzar de manera ordenada por el siguiente flujo coordinado por `Gentle-Orchestrator`:

```text
[1. Explorar (Plan)] ➔ [2. Especificar] ➔ [3. Construir (Build)] ➔ [4. Verificar (Tester)] ➔ [5. Registrar (Engram)]
```

Las fases son **secuenciales**: una fase solo se cierra cuando su entregable está completo y el orquestador lo confirma. La fase 4 puede devolver la tarea hacia atrás con un informe de errores (ver sección *Reingreso ante Fallos*).

### 1. 🔍 Explorar (Plan)

* **Responsable:** Agente Explorador (solo lectura).
* **Objetivo:** Inspeccionar el código existente y los documentos de especificación (`agents.md`, `skills.md`, este archivo) para entender el contexto antes de escribir nada.
* **Entregable:** Un mapa conciso de los archivos a tocar, las dependencias implicadas y las skills requeridas según la matriz de `skills.md`.
* **Regla:** Está prohibido modificar cualquier archivo en esta fase.

### 2. 📝 Especificar

* **Responsable:** `Gentle-Orchestrator`.
* **Objetivo:** Traducir el requerimiento en una especificación concreta: alcance, interfaces, props y criterios de aceptación verificables.
* **Entregable:** Instrucciones de construcción cerradas (qué archivos crear o modificar y qué comportamiento se espera de ellos).
* **Regla:** Ninguna fase posterior puede cambiar el alcance sin volver explícitamente a esta fase.

### 3. 🛠️ Construir (Build)

* **Responsable:** Agente Constructor.
* **Objetivo:** Implementar la especificación respetando el stack estricto y la estructura de archivos definidos en `agents.md`.
* **Entregable:** Código funcional, tipado estricto y los tests unitarios (Vitest) escritos junto a la lógica que cubren.
* **Regla:** El constructor solo escribe dentro de las superficies de edición asignadas por el orquestador; no toca archivos ajenos a la especificación.

### 4. ✅ Verificar (Tester)

* **Responsable:** Agente Verificador (independiente del constructor).
* **Objetivo:** Ejecutar `npm run test`, validar los criterios de aceptación de la fase 2 y detectar regresiones o efectos secundarios.
* **Entregable:** Informe de verificación con estado **aprobado** o una lista de defectos reproducibles indicando archivo y comportamiento esperado.
* **Regla:** El verificador no corrige el código; solo informa. Cada defecto reportado reabre la fase 3.

### 5. 📮 Registrar (Engram)

* **Responsable:** `Gentle-Orchestrator` junto al subagente que produjo el hallazgo.
* **Objetivo:** Persistir en Engram las decisiones, convenciones y aprendizajes no obvios de la tarea, cada uno como una observación propia con su `topic_key`.
* **Entregable:** Observación guardada en Engram y resumen de sesión actualizado.
* **Regla:** Una tarea no se considera cerrada sin su registro en memoria.

---

## 🤝 Delimitación de Responsabilidades

| Agente | Puede | No puede |
| :--- | :--- | :--- |
| **Gentle-Orchestrator** | Coordinar fases, asignar superficies de edición, decidir regresiones, registrar en Engram | Escribir código que ya tiene un constructor asignado para esa misma unidad |
| **Agente Explorador** | Leer cualquier archivo del proyecto | Crear, editar o borrar archivos |
| **Agente Constructor** | Crear y modificar archivos dentro de su superficie asignada | Modificar archivos ajenos a su especificación o ejecutar borrados globales |
| **Agente Verificador** | Ejecutar pruebas, inspeccionar el código y emitir informes | Corregir código o alterar pruebas para hacerlas pasar |

---

## 🚧 Reglas Anti-Solapamiento

1. **Un propietario por archivo:** si dos subagentes necesitan tocar el mismo archivo, el orquestador serializa el trabajo o reasigna ese archivo a un solo constructor.
2. **Superficies de edición explícitas:** toda instrucción de construcción nombra los archivos exactos que el agente puede modificar.
3. **Sin cambios destructivos globales:** prohibido borrar directorios, sobrescribir archivos no listados o ejecutar limpiezas masivas sin autorización del orquestador.
4. **Verificación antes de cerrar:** ninguna tarea avanza a la fase 5 sin el informe favorable de la fase 4.
5. **Contexto por referencia:** los subagentes reciben los documentos de especificación por enlace (`agents.md`, `skills.md`, este archivo), nunca como copias parciales resumidas.

---

## 🔁 Reingreso ante Fallos

| Situación | Regreso a |
| :--- | :--- |
| Defecto de implementación detectado en la fase 4 | Fase 3 (Construir), con el informe de errores adjunto |
| Requerimiento ambiguo o cambio de alcance | Fase 2 (Especificar) |
| Arquitectura insuficiente o archivos mal identificados | Fase 1 (Explorar) |
| Error transitorio de entorno (instalación, red) | Se reintenta la fase actual una sola vez antes de escalar al usuario |
