/**
 * Centralization of the operations to Mongo DB
 */

import { MongoClient } from 'mongodb'

import application from './application.mjs'

class MongoDBManager {
  /**
     * default constructor
     */
  constructor () {
    this.dbName = ''
    this.dbPort = ''
    this.dbUser = ''
    this.dbPassword = ''
    this.stationsCollection = 'chirpstack-stations'
    this.observationsCollection = 'chirpstack-observations'
    this._mongoUri = ''
  }

  /**
     * Must be called to initialize the module
     * @param {string} mongoDbUrl
     */
  setDBInfo (mongoDbUrl) {
    this._mongoURI = mongoDbUrl
    // extract db dbname
    let url_elements = mongoDbUrl.split('/')
    if(url_elements.length != 4){
      application.logger.error(`Configuration error, invalid mongo url ${mongoDbUrl}`)
      process.exit(4)
    } else {
      this.dbName = url_elements[3]
    }
  }

  /**
     * Clean the observations collection; usefull when updating the model
     * @param {string} collectionName collection to delete
     */
  async deleteCollection (collectionName) {
    const client = new MongoClient(this._mongoURI)

    try {
      await client.connect()
      const db = client.db(this.dbName)
      const collection = db.collection(collectionName)

      // delete all objects
      const result = await collection.deleteMany({})
      application.logger.info(`Delete ${result.deletedCount} items from ${collectionName}.`)
    } catch (error) {
      application.logger.warn(`Error cleaning collection ${collectionName}: ${error}`)
    } finally {
      await client.close()
    }
  }

  /**
     * Insert object into mongoDB
     * @param {geojson features} array of geojson features
     */
  async insertGeoJSONFeatures (features) {
    const client = new MongoClient(this._mongoURI)

    try {
      await client.connect()
      application.logger.info(`Connected to MongoDB ${this.dbName}`)
      const db = client.db(this.dbName)
      const collection = db.collection(this.observationsCollection)

      for (const feature of features) {
        await collection.insertOne(feature)
      }
      application.logger.info(`GeoJSON inserted successfully into ${this.observationsCollection}`)
    } catch (error) {
      application.logger.warn('Error inserting GeoJSON:', error)
    } finally {
      await client.close()
      application.logger.info('MongoDB connection closed')
    }
  }

  /**
     * Given the list of the stations write it in the stations collections
     * @param {object} gateways list of stations to write
     *
     */
  async syncStations (gateways) {
    const client = new MongoClient(this._mongoURI)

    try {
      for (const gatewayId in gateways) {
        await client.connect()
        const db = client.db(this.dbName)
        const collection = db.collection(this.stationsCollection)
        // check if stations exists
        const result = await collection.findOne({ 'properties.euid': gatewayId })
        if (!result) {
          const geoJson = {
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [gateways[gatewayId].lon, gateways[gatewayId].lat]
            },
            properties: {
              euid: gatewayId,
              gw_euid: gatewayId,
              name: gateways[gatewayId].desc
            }
          }
          await collection.insertOne(geoJson)
          application.logger.info(`Gateway (${gatewayId}) inserted successfully into ${this.stationsCollection}`)
        }
      }
    } catch (error) {
      application.logger.error(`Error adding gateway in collection ${this.stationsCollection}: ${error}`)
    } finally {
      await client.close()
    }
  }
}

const mongoDBManager = new MongoDBManager()
export default mongoDBManager
