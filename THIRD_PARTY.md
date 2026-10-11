# Third-party software

Nexternel stands on the work of many open-source projects. Each keeps its own license.

## Services (run as Docker containers from their official images)

| Component | What it does in Nexternel | License |
|-----------|---------------------------|---------|
| [ESPHome](https://esphome.io) | Builds and updates firmware for ESP32 devices | MIT and GPL-3.0 (see project) |
| [Eclipse Mosquitto](https://mosquitto.org) | MQTT broker that devices send readings to | EPL-2.0 / EDL-1.0 |
| [PostgreSQL](https://www.postgresql.org) | Stores devices, rooms, dashboards and accounts | PostgreSQL License |
| [InfluxDB 2](https://www.influxdata.com) | Stores sensor history for charts | MIT |
| [go2rtc](https://github.com/AlexxIT/go2rtc) | Plays camera streams in the browser | MIT |
| [Node.js](https://nodejs.org) | Runs Nexternel's server | MIT |
| [nginx](https://nginx.org) | Serves Nexternel's web app | BSD-2-Clause |

The exact versions are pinned in `docker-compose.yml` and the `Dockerfile`s.

## Libraries (built into Nexternel)

| Library | License |
|---------|---------|
| [React](https://react.dev), [React Router](https://reactrouter.com) | MIT |
| [MUI (Material UI) and Material Icons](https://mui.com) | MIT (icons: Apache-2.0) |
| [Apache ECharts](https://echarts.apache.org) | Apache-2.0 |
| [react-grid-layout](https://github.com/react-grid-layout/react-grid-layout) | MIT |
| [hls.js](https://github.com/video-dev/hls.js) | Apache-2.0 |
| [Fastify](https://fastify.dev) | MIT |
| [MQTT.js](https://github.com/mqttjs/MQTT.js) | MIT |
| [node-postgres](https://node-postgres.com) | MIT |

The full list, with versions, is in each `package.json` and in `package-lock.json`.
