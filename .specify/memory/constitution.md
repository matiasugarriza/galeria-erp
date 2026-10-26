# 📜 Constitución del Proyecto — Galería de Imágenes (Standalone & ERP Plugin)

> Derivada de [`agents.md`](../../agents.md), [`orchestration.md`](../../orchestration.md) y [`skills.md`](../../skills.md). Todo spec, plan o tarea del proyecto debe cumplir esta constitución; cualquier violación debe escalarse al usuario antes de implementarse.

**Versión:** 1.2.0
**Última actualización:** 2026-10-23

---

## Principios Fundamentales

1. **Protocolo de 5 fases:** el desarrollo sigue el flujo de `orchestration.md` (Explorar → Especificar → Construir → Verificar → Registrar), con verificación independiente antes de cerrar.
2. **Stack cerrado:** solo el stack autorizado; no se agregan dependencias nuevas sin autorización explícita del usuario.
3. **Doble modo por diseño:** todo componente debe funcionar en modo *Standalone* y como *Plugin ERP* sin modificar su código base.

---

## Cláusula I — Stack Tecnológico Inmutable

| Categoría | Versión autorizada |
| :--- | :--- |
| Core | React `^19.3.0` + TypeScript `^7.0.2` |
| Build Tool | Vite `^8.3.1` (Module Type: `"module"`) |
| Styling | Tailwind CSS `^4.3.3` (con `@tailwindcss/vite`) |
| Iconos | `lucide-react` `^1.48.0` |
| Backend | Firebase JS SDK (`firebase/app`, `firebase/storage`) |
| Testing | Vitest `^5.0.2` (ejecutar con `npm run test`) |

**Regla de oro:** ninguna librería UI externa (Shadcn UI, Material UI, Tailwind v3, etc.) sin solicitud explícita del usuario. La UI se construye con componentes nativos de React y clases de utilidad de Tailwind v4.

**Ampliación autorizada (2026-10-23):** procesamiento de imágenes **en servidor** mediante Cloud Functions de Firebase (runtime Python + Pillow), disparado por el evento `onFinalize` del bucket; reutiliza la lógica del pipeline de la feature `006-image-pipeline` para fidelidad total (incluido `rembg` opcional). Cualquier otra pieza de backend o dependencia nueva requiere autorización explícita del usuario.

---

## Cláusula II — Arquitectura de Archivos

* La estructura `src/` definida en `agents.md` es fija: componentes en `src/components/ImageGallery/`, configuración en `src/config/firebase.ts`, servicios en `src/services/storageService.ts`, tipos centralizados en `src/types/gallery.ts`.
* El módulo se expone al exterior solo mediante `src/index.ts` y el componente raíz `ImageGallery.tsx`.
* Los tipos compartidos se declaran exclusivamente en `src/types/gallery.ts`.

---

## Cláusula III — Calidad Obligatoria

* **TypeScript estricto:** prohibido `any` y `@ts-ignore`.
* **Pruebas:** cada feature cuenta con pruebas Vitest que cubren sus callbacks y estados observables; `npm run test` debe quedar en verde.
* **Ciclo de vida:** todo listener o suscripción de Firebase se limpia en el retorno de `useEffect`.
* **Errores visibles:** las operaciones asíncronas de Firebase Storage exponen errores al usuario, no solo a consola.
* **Accesibilidad:** controles con `aria-label` y navegación por teclado (`:focus-visible`).
* **UI:** *Mobile First* con Tailwind v4; iconos de `lucide-react`.

---

## Cláusula IV — Seguridad y Configuración

* Las credenciales de Firebase se inyectan solo mediante variables de entorno con prefijo `VITE_`, leídas exclusivamente en `src/config/firebase.ts`.
* Prohibido hardcodear credenciales en código o documentos del repositorio.
* La configuración interna de Firebase nunca se exporta al consumidor del plugin ERP.

---

## Cláusula V — Proceso Obligatorio

* Toda feature avanza por las 5 fases de `orchestration.md`; la fase 4 (Verificar) es independiente del constructor.
* Ninguna tarea se cierra sin su registro en Engram (fase 5).
* Los cambios de alcance regresan a la fase 2 (Especificar) antes de continuar.

---

## Cláusula VI — Formato y Procesamiento de Imágenes

* Toda imagen residente en el bucket es `.jpg` / `image/jpeg`, en RGB con perfil sRGB embebido, progresiva, optimizada y **sin metadatos EXIF**.
* El pipeline se ejecuta en este orden exacto: (1) orientación EXIF + borrado de EXIF, (2) conversión a sRGB respetando el ICC embebido (intento perceptual), (3) recorte automático al contenido, (4) escala sin agrandar, (5) lienzo 4:3 con padding blanco, (6) JPEG con calidad ajustada al peso. **El recorte va antes de escalar.**
* **Invariantes:** nunca agranda por encima de la resolución original; nunca estira ni deforma; nunca recorta por encima del contenido detectado; nunca comprime por debajo de q60; nunca descarta la imagen por exceso de peso; nunca escribe en disco (todo en RAM, `io.BytesIO`).
* Los nombres en el bucket siguen la convención `{carpeta}/{código}[_N].jpg`; la numeración de variantes es estable entre corridas.
* El pipeline se ejecuta en dos frentes: el **proceso batch de migración** (Drive → bucket) y el **procesamiento en servidor** de las subidas nuevas desde el complemento (Cloud Function `onFinalize`, decisión del usuario del 2026-10-23), de modo que todo el bucket cumple este contrato uniformemente.
* Reglas, constantes y detección de recorte completas: ver [`specs/006-image-pipeline/spec.md`](../../specs/006-image-pipeline/spec.md).

---

## 🚦 Gate de Verificación (Constitution Check)

Cada `plan.md` debe incluir la sección **Verificación de Constitución** evaluando las cláusulas I–VI con estado `PASS`/`FAIL` **antes** de generar tareas. Un `FAIL` bloquea el avance a la fase de construcción hasta su resolución o autorización explícita del usuario.
