# ship the micro service to integrate Kano in Chirpstack
FROM node:18

WORKDIR /app

COPY package*.json ./
RUN mkdir ./proto ./config
COPY proto/ ./proto
RUN npm install

COPY *.mjs ./

# Specify the entry point command
CMD ["node", "main.mjs"]
