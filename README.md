<p align="center">
  <img src="assets/brand/fluxa-logo.png" alt="Fluxa" width="300" />
</p>

<p align="center">
  <b>Sistema de turnos y filas de espera, open source y autoalojado.</b><br />
  Para cualquier negocio que atiende por orden de llegada, en español, English y português.
</p>

> **Estado: MVP listo (fase 1).** Kiosco, ticketera, pantalla de llamado, panel para atender y seguimiento por QR funcionando. Próximo: citas.

**Fluxa** organiza la atención por orden de llegada: el cliente saca su número en un kiosco o con un QR, una pantalla lo llama con sonido y voz, y cada empleado atiende desde su panel. Sirve para carnicerías, charcuterías, pescaderías, panaderías, barberías, peluquerías, autolavados, consultorios, farmacias, bancos y oficinas de atención al público.

## Hoja de ruta

| Fase | Contenido | Estado |
|---|---|---|
| 0. Base | Proyecto independiente a partir de [Resolvo](https://github.com/jmobandod2000/resolvo-helpdesk): usuarios, negocio, sucursales, 3 idiomas, Docker e instalador | ✅ |
| 1. MVP | Tipo de negocio en el asistente inicial (con secciones y vocabulario sugeridos), secciones con prefijo, kiosco, ticketera térmica 58/80 mm, pantalla de llamado en tiempo real con voz, panel del empleado y seguimiento por QR | ✅ |
| 2. Completo | Citas (peluquerías, consultorios) integradas con la fila, llamado por voz, reportes de espera y atención, varias tiendas | ⏳ |
| 3. Lanzamiento | Marca definitiva, paquete de instalación, Release v1.0 | ⏳ |

## Instalación

Solo necesitas [Docker](https://docs.docker.com/get-docker/):

```bash
./fluxa install        # Linux / macOS
fluxa install          # Windows (PowerShell: .\fluxa install)
```

Comandos: `start`, `stop`, `restart`, `status`, `logs`, `backup`, `restore`, `update`, `config`, `db` y `dev`. Puerto web por defecto: `8081`.

## Desarrollo

Requisitos: Node.js 22.22+ (recomendado 24 LTS), pnpm 10, Docker.

```bash
./fluxa dev            # base en Docker + API y web con recarga automática
```

- Web: `http://localhost:9020`
- API: `http://localhost:3020/api` · Swagger: `http://localhost:3020/docs`
- PostgreSQL de desarrollo: `127.0.0.1:5438` (usuario y contraseña en `api/.env`)

Puertos distintos a los de Resolvo, para que ambos proyectos corran a la vez.

## Licencia

[Apache-2.0](LICENSE). Copyright 2026 Juan M. Obando. Ver [NOTICE](NOTICE).
