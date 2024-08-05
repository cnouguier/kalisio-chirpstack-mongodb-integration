# MongoDB integration for Chirpstack

This is a [chirpstack](https://www.chirpstack.io/) integration for MongoDB, written in nodejs.
It has been written to connect [Kano](https://kalisio.github.io/kano/) to [Chirpstack](https://github.com/chirpstack/). But it
can be used in more general purpose (without Kano) because it is finally "just" an chirpstack integration that write GeoJSON in the mongDB.

## Description

The microservice has a main loop and the following steps are performed:

  * connect to redis stream `device:stream:event` and listen for new events emitted by the chirpstack network server.
  * unmarshall events using chirpstack protobuf definition
  * convert this events to geojson
  * write to mongo DB in a collection called `chirpstack-observations`

![Chripstack](/schemas/chirpstack-mongodb-integration.drawio.png)

> [!IMPORTANT]
> For the moment only event with type `up` are handled. Event like `log`, `join` and other are not handled (full list of events are visible [here](https://www.chirpstack.io/docs/chirpstack/integrations/events.html)).

## installation

It's possible to use the docker image: `kalisio/chirpstack-mongodb-integration:latest`.
> [!NOTE]
> Latest is a rotating image, so update could occured.

```console
docker run -it harbor.portal.kalisio.com/kalisio/chirpstack-mongodb-integration:latest /app/chirpstack-stream-consumer.mjs --help
```

It's also possible to install from source easily.
```shell
npm install package.json
node ./chirpstack-stream-consumer.mjs
```

## usage

```shell
Usage: chirpstack-stream-consumer CLI help

Chirp stack stream consumer.
  Collect events from chirpstack and write to mongoDB.

Options:
  -c, --config <config>  path to a JSON config file.  (default: default config file, env:
                         MICROSERVICE_CONFIG_FILE)
  -h, --help             display help for command
```

## Config file options


The micro service is configured using a json file, the default file is `config.json`.

| Option         | Default Value | Help                                           |
| ---            | ---           | ---                                            |
| redisHost      | localhost     | Redis hostname                                 |
| redisPort      | 6379          | Redis port                                     |
| redisPassword  |               | Redis password                                 |
| disableWrite   | false         | Don't push to MongoDB                          |
| cleanMongoDB   | false         | Delete objects from Chirpstack collections     |
| mongoUrl       |               | MongoDB url, with the database!                |
| gRPCServer     | 127.0.0.1:8080| Host for gRPC calls (chirpstack server)        |
| apiToken       |               | Token for gRPC calls (found in chirpstack UI)  |
| logLevel       | info          | info, error, warn (see [Winston doc](https://github.com/winstonjs/winston?tab=readme-ov-file#logging-levels))           |

### detailled description

| File                           | Description                                                                                                                                            |
|--------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------|
| chirpstack-stream-consumer.mjs | main entry point   * read configuration from command line and environment variable  * instanciate objects  * main loop waiting for read stream events  |
| chirpstack-events.mjs          | decode event from protobuf                                                                                                                             |
| gatewaymanager.mjs             | fetch info about gateways from gRPC API                                                                                                                |
| mongodbManager.mjs             | common operation to mongodo; delete, insert, synchronize                                                                                               |
| uplinkeventadapter.mjs         | create the geosjon feature                                                                                                                             |

The folder proto contains the protobuf description coming from the official chirstack repo.

## Data model

The micro service **doesn't convert all the protobuf messages** to geoJSON. This is a conscious choice to keep only
what is interesting to display in Kano.

Data are written as GeoJSON features in two collections:

  * `chirpstack-stations`: contains all the stations (i.e gateway in the LoRa jargon), with position latitude, longitude.
  * `chirpstack-observations`: contains all the observations. An observations is one measure in the LoRa protocol. So
  one message in LoRa will result in many observations.

The link between the two collections is done using the attributes `properties.gw_euid` which is close to the gateway id in the
lora protocol.

> [!NOTE]
> For the `chirpstack-observations` an extra field time is needed to have varying-time data.

This is an example of a station, a MileSight gateway:
```json
{   "type": "Feature",
    "geometry": {
      "type": "Point",
      "coordinates": [ 1.419038772583008, 43.600443297757835 ]
    },
    "properties": {
      "euid": "24e124fffef460b4",
      "gw_euid": "24e124fffef460b4",
      "name": "MileSight GW"
    }
}
```

Below is an example of an observation for a sound sensor. Note the additionnal time field
and the `laeq` value returned by the sensor. Note that we also information related to the
tenant and the application.
```json
{
  "type": "Feature",
  "geometry": {
    "type": "Point",
    "coordinates": [ 1.419038772583008, 43.600443297757835 ]
  },
  "properties": {
    "euid": "24e124743d429065",
    "name": "ABP-soundSensor",
    "app_id": "03fa133f-d68c-4aee-94c2-ab63874c3d26",
    "app_name": "KalisioMap",
    "tenant_id": "52f14cd4-c6f1-4fbd-8f87-4025e1d49242",
    "tenant_name": "ChirpStack",
    "gw_euid": "24e124fffef460b4",
    "laeq": 42.9
  },
  "time": "2024-04-09T16:42:28.382Z"
}
```

> [!IMPORTANT]
> The micro service has no codec notion and it make a copy all the fields of the object, in the properties field.
> It means that if the values are not scalar but object, the value associated with this field is `null`.



## build docker images

A shell script `build.sh` is provided to aggregate command to build and push on the kalisio Harbor.

```shell
./build.sh
```

## roadmap

As the micro-service is in its early stages, some point can be improved.
Consider the following list as potential futures evolutions:

  * [X] use a logging service like [winston](https://github.com/winstonjs/winston)
  * [X] use a JSON config file to replace too many command line opions. Probable use of [config](https://www.npmjs.com/package/config)
  * [ ] add a support for tenant. The idea behind is to separate the storage of the different data in different database. To isolate data that can come from different users.
  * [ ] add a TTL support for the observations collection
  * [ ] have a more complete support for events. `Join` and `Status`are interesting
  * [ ] add tests for the project
  * [ ] add CI and fix version image

## development

The easiest  way to develop is:
  * running locally the microservice, to be able to debug with **code**
  * use a remote redis configuration and remote GRPC configuration, with a real chirpstack platform
  * use a local mongodb to avoid pollution on the remote mongodb.

Example of commande line:
```shell
node ./chirpstack-stream-consumer.mjs -c config-debug.js
```

A simple docker compose can be used:
```yaml
version: '3.1'
services:

  mongo:
    image: mongo
    restart: always
    environment:
      MONGO_INITDB_ROOT_USERNAME: root
      MONGO_INITDB_ROOT_PASSWORD: toto
    ports:
      - 27017:27017
    volumes:
      - ./datadir:/data/db
```

## context

This microservice has been written to display LoraWAN data in [Kano](https://github.com/kalisio/kano), a data explorer in 2D/3D.
Data management is done with [Chirpstack](https://www.chirpstack.io/), a popular LoraWAN network server.

![Chirpstack](/pictures/chirpstack-temperature.png)

This is part of R&D of [Kalisio](https://kalisio.com/).
