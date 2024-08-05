/*
* main entry point
*/

import application from "./application.mjs"


console.log("Starting.")
await application.initialize()
await application.run()
await application.finalize()
console.log("End of micro service.")